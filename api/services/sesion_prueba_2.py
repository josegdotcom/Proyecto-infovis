"""
Sesión de la Prueba 2 (actividades con el teléfono): coordina teléfono, pantalla y modelos.

Flujo:
    1. El teléfono abre exploracion/sensor_prueba_2.html, activa sus sensores y
       envía un "latido" con la última lectura (la pantalla muestra que está vivo).
    2. Desde la pantalla o el teléfono se elige la actividad real y se inicia:
       cuenta regresiva (para guardar el teléfono) -> grabación de ~10 s.
    3. Durante la grabación el teléfono envía todas sus muestras crudas.
    4. Al completar la duración se calculan las características UCI
       (api/services/sensor_har.py), se predice con la CNN y la MLP por ventana
       y se resume por voto mayoritario. El intento se agrega al historial.
    5. Con al menos MINIMO_INTENTOS se calculan las métricas de ambos modelos.

Todo el estado vive aquí (una sola sesión por servidor), protegido por un lock,
para que la pantalla y el teléfono vean lo mismo aunque se recarguen.
"""

import csv
import threading
import time
from collections import Counter
from pathlib import Path

import numpy as np

from api.services.sensor_har import FRECUENCIA, PASO, VENTANA

ROOT_DIR = Path(__file__).resolve().parents[2]
CARPETA_GRABACIONES = ROOT_DIR / "grabaciones"

ACTIVIDADES = {
    1: "Caminar",
    2: "Subir escaleras",
    3: "Bajar escaleras",
    4: "Sentado",
    5: "De pie",
    6: "Acostado",
}

# 512 muestras a 50 Hz = 10,24 s = 7 ventanas de 2,56 s con 50 % de solapamiento.
VENTANAS_OBJETIVO = 7
DURACION_S = (VENTANA + PASO * (VENTANAS_OBJETIVO - 1)) / FRECUENCIA
CUENTA_REGRESIVA_S = 5
CUENTA_REGRESIVA_MAX_S = 15
# Margen tras la duración prevista antes de dar la grabación por perdida.
MARGEN_SIN_DATOS_S = 6.0
# El teléfono se considera conectado si envió algo en los últimos segundos.
TIEMPO_CONEXION_S = 3.0
MINIMO_INTENTOS = 5
MAX_MUESTRAS = int(DURACION_S * 200)  # tope defensivo (200 Hz)

CAMPOS = ("t", "ax", "ay", "az", "gx", "gy", "gz")


def _muestra_valida(m):
    if not isinstance(m, dict):
        return None
    try:
        fila = tuple(float(m[c]) for c in CAMPOS)
    except (KeyError, TypeError, ValueError):
        return None
    return fila if all(np.isfinite(fila)) else None


class SesionPrueba2:
    def __init__(self, obtener_predictor, obtener_pipeline):
        # Se inyectan para cargar TensorFlow solo cuando se usa la prueba 2.
        self._obtener_predictor = obtener_predictor
        self._obtener_pipeline = obtener_pipeline
        self._lock = threading.Lock()
        self._ultimo_contacto = 0.0
        self._ultima_muestra = None
        self._calibracion = None
        self._fase = "espera"  # espera | cuenta_regresiva | grabando | procesando
        self._actividad = None
        self._id_intento = 0
        self._inicio_grabacion = 0.0
        self._muestras = []
        self._resultado = None
        self._error = None
        self._intentos = []

    # ------------------------------------------------------------------
    # Transiciones que dependen del tiempo
    # ------------------------------------------------------------------

    def _actualizar_fase(self, ahora):
        if self._fase == "cuenta_regresiva" and ahora >= self._inicio_grabacion:
            self._fase = "grabando"
        if self._fase == "grabando":
            limite = self._inicio_grabacion + DURACION_S + MARGEN_SIN_DATOS_S
            if ahora > limite:
                self._fase = "espera"
                self._error = (
                    "El teléfono dejó de enviar datos durante la grabación. "
                    "Mantén la página abierta y la pantalla encendida, y vuelve a intentarlo."
                )
                self._muestras = []

    # ------------------------------------------------------------------
    # Acciones
    # ------------------------------------------------------------------

    def iniciar(self, actividad, cuenta_regresiva=CUENTA_REGRESIVA_S):
        try:
            actividad = int(actividad)
        except (TypeError, ValueError):
            raise ValueError("Elige la actividad que vas a realizar (1 a 6).")
        if actividad not in ACTIVIDADES:
            raise ValueError("La actividad debe estar entre 1 y 6.")
        try:
            cuenta = float(cuenta_regresiva)
        except (TypeError, ValueError):
            cuenta = CUENTA_REGRESIVA_S
        cuenta = min(max(cuenta, 0.0), CUENTA_REGRESIVA_MAX_S)

        ahora = time.time()
        with self._lock:
            self._actualizar_fase(ahora)
            if self._fase in ("cuenta_regresiva", "grabando", "procesando"):
                raise ValueError("Ya hay una grabación en curso.")
            if not self._conectado(ahora):
                raise ValueError("No hay un teléfono conectado. Escanea el QR y activa los sensores.")
            self._id_intento += 1
            self._actividad = actividad
            self._inicio_grabacion = ahora + cuenta
            self._fase = "cuenta_regresiva" if cuenta > 0 else "grabando"
            self._muestras = []
            self._error = None
            return {"ok": True, "id_intento": self._id_intento}

    def cancelar(self):
        with self._lock:
            if self._fase in ("cuenta_regresiva", "grabando"):
                self._fase = "espera"
                self._muestras = []
                self._error = "Grabación cancelada."
            return {"ok": True}

    def recibir(self, payload):
        """Latidos y muestras del teléfono."""
        if not isinstance(payload, dict):
            raise ValueError("Cuerpo inválido.")
        ahora = time.time()
        tipo = payload.get("tipo")
        terminar = False

        with self._lock:
            self._ultimo_contacto = ahora
            ultima = _muestra_valida(payload.get("ultima"))
            if ultima:
                self._ultima_muestra = dict(zip(CAMPOS, ultima))
            if isinstance(payload.get("calibracion"), dict):
                self._calibracion = {
                    k: payload["calibracion"].get(k) for k in ("signo", "eje", "plataforma")
                }

            self._actualizar_fase(ahora)

            if tipo == "muestras" and self._fase == "grabando":
                if payload.get("id_intento") != self._id_intento:
                    return {"ok": True, "ignorado": "intento distinto"}
                for m in payload.get("muestras", [])[:2000]:
                    fila = _muestra_valida(m)
                    if fila:
                        self._muestras.append(fila)
                del self._muestras[MAX_MUESTRAS:]

                if len(self._muestras) >= 2:
                    tiempos = [f[0] for f in self._muestras]
                    duracion = (max(tiempos) - min(tiempos)) / 1000.0
                    if duracion >= DURACION_S:
                        self._fase = "procesando"
                        terminar = True
                        muestras = list(self._muestras)
                        id_intento = self._id_intento
                        actividad = self._actividad

        if terminar:
            hilo = threading.Thread(
                target=self._procesar, args=(id_intento, actividad, muestras), daemon=True
            )
            hilo.start()

        return {"ok": True, "fase": self._fase}

    def _procesar(self, id_intento, actividad, muestras):
        try:
            datos = np.asarray(muestras, dtype=np.float64)
            datos = datos[np.argsort(datos[:, 0], kind="stable")]
            pipeline = self._obtener_pipeline()
            predictor = self._obtener_predictor()
            X = pipeline.caracteristicas(datos[:, 0], datos[:, 1:4], datos[:, 4:7])
            X = X[:VENTANAS_OBJETIVO]
            preds = predictor.predict(X)

            modelos = {}
            for modelo, valores in preds.items():
                valores = [int(v) for v in valores]
                conteo = Counter(valores)
                # Empate: gana la actividad que apareció primero (orden estable).
                etiqueta, votos = max(conteo.items(), key=lambda kv: (kv[1], -valores.index(kv[0])))
                modelos[modelo] = {
                    "prediccion": etiqueta,
                    "actividad": ACTIVIDADES.get(etiqueta, f"Clase {etiqueta}"),
                    "votos": votos,
                    "ventanas": valores,
                    "correcto": etiqueta == actividad,
                }

            t = datos[:, 0]
            resultado = {
                "id": id_intento,
                "actividad_real": actividad,
                "nombre_real": ACTIVIDADES[actividad],
                "ventanas": len(X),
                "muestras": len(datos),
                "frecuencia_hz": round(float((len(t) - 1) / ((t[-1] - t[0]) / 1000.0)), 1),
                "modelos": modelos,
                "hora": time.strftime("%H:%M:%S"),
            }
            self._guardar_csv(resultado, datos)

            with self._lock:
                if self._id_intento == id_intento:
                    self._resultado = resultado
                    self._intentos.append(resultado)
                    self._fase = "espera"
                    self._muestras = []
        except Exception as err:  # el teléfono y la pantalla deben enterarse
            with self._lock:
                if self._id_intento == id_intento:
                    self._fase = "espera"
                    self._muestras = []
                    self._error = f"No se pudo analizar la grabación: {err}"

    def _guardar_csv(self, resultado, datos):
        """Guarda la grabación cruda (evidencia para el informe). Fallar aquí no es crítico."""
        try:
            CARPETA_GRABACIONES.mkdir(parents=True, exist_ok=True)
            nombre = (
                f"prueba2_{time.strftime('%Y%m%d_%H%M%S')}_"
                f"{resultado['nombre_real'].replace(' ', '-').lower()}.csv"
            )
            with open(CARPETA_GRABACIONES / nombre, "w", newline="", encoding="utf-8") as f:
                escritor = csv.writer(f)
                escritor.writerow(["# actividad_real", resultado["nombre_real"]])
                for modelo, r in resultado["modelos"].items():
                    escritor.writerow([f"# {modelo}", r["actividad"], f"{r['votos']}/{resultado['ventanas']}"])
                escritor.writerow(["t_ms", "ax_ms2", "ay_ms2", "az_ms2", "gx_grados_s", "gy_grados_s", "gz_grados_s"])
                escritor.writerows(datos.tolist())
        except OSError:
            pass

    def eliminar(self, id_intento):
        with self._lock:
            antes = len(self._intentos)
            self._intentos = [i for i in self._intentos if i["id"] != id_intento]
            if self._resultado and self._resultado["id"] == id_intento:
                self._resultado = None
            return {"ok": True, "eliminados": antes - len(self._intentos)}

    def reiniciar(self):
        with self._lock:
            self._intentos = []
            self._resultado = None
            self._error = None
            if self._fase in ("cuenta_regresiva", "grabando"):
                self._fase = "espera"
                self._muestras = []
            return {"ok": True}

    def metricas(self):
        with self._lock:
            intentos = list(self._intentos)
        if len(intentos) < MINIMO_INTENTOS:
            raise ValueError(f"Se necesitan al menos {MINIMO_INTENTOS} intentos para evaluar.")

        from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

        reales = [i["actividad_real"] for i in intentos]
        salida = {"intentos": len(intentos), "etiquetas_reales": reales, "metricas": {}, "predicciones": {}}
        for modelo in ("CNN", "MLP"):
            pred = [i["modelos"][modelo]["prediccion"] for i in intentos]
            salida["predicciones"][modelo] = pred
            salida["metricas"][modelo] = {
                "accuracy": float(accuracy_score(reales, pred)),
                "precision": float(precision_score(reales, pred, average="weighted", zero_division=0)),
                "recall": float(recall_score(reales, pred, average="weighted", zero_division=0)),
                "f1_score": float(f1_score(reales, pred, average="weighted", zero_division=0)),
            }
        return salida

    # ------------------------------------------------------------------
    # Estado para la pantalla y el teléfono
    # ------------------------------------------------------------------

    def _conectado(self, ahora):
        return self._ultimo_contacto > 0 and (ahora - self._ultimo_contacto) < TIEMPO_CONEXION_S

    def estado(self):
        ahora = time.time()
        with self._lock:
            self._actualizar_fase(ahora)
            progreso = 0.0
            if self._fase == "grabando" and len(self._muestras) >= 2:
                tiempos = [f[0] for f in self._muestras]
                progreso = min(1.0, (max(tiempos) - min(tiempos)) / 1000.0 / DURACION_S)
            elif self._fase == "procesando":
                progreso = 1.0
            return {
                "conectado": self._conectado(ahora),
                "fase": self._fase,
                "id_intento": self._id_intento,
                "actividad": self._actividad,
                "nombre_actividad": ACTIVIDADES.get(self._actividad),
                "segundos_para_iniciar": max(0.0, round(self._inicio_grabacion - ahora, 2))
                if self._fase == "cuenta_regresiva" else 0.0,
                "duracion_s": DURACION_S,
                "progreso": round(progreso, 3),
                "ultima_muestra": self._ultima_muestra,
                "calibracion": self._calibracion,
                "resultado": self._resultado,
                "error": self._error,
                "intentos": self._intentos,
                "minimo_intentos": MINIMO_INTENTOS,
                "actividades": ACTIVIDADES,
            }
