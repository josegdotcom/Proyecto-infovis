"""
Pipeline del teléfono para la Prueba 2: replica el preprocesamiento de UCI HAR.

UCI HAR (Anguita et al., 2013) grabó un Samsung Galaxy S II en la cintura a 50 Hz:
    1. Filtro de mediana + Butterworth pasa bajos de 20 Hz (ruido).
    2. Butterworth pasa bajos de 0,3 Hz para separar la gravedad.
    3. Ventanas de 2,56 s (128 muestras) con 50 % de solapamiento.
    4. 561 características por ventana, normalizadas a [-1, 1].

El teléfono del usuario entrega `devicemotion` a ~60 Hz con otra orientación y
otras unidades, así que aquí se:
    - remuestrea a 50 Hz exactos sobre una malla uniforme,
    - rotan los ejes del teléfono a los ejes del teléfono de UCI,
    - convierten unidades (m/s² -> g, °/s -> rad/s),
    - filtra la señal COMPLETA (no ventana por ventana, como hacía el
      conversor original: un filtro de 0,3 Hz sobre 2,56 s no separa bien
      la gravedad),
    - aplica la normalización calibrada con data/calibrar_har.py.

Ejes (verificado con la gravedad media de UCI por actividad, ver
data/calibrar_har.py): de pie, la gravedad de UCI cae en +x. Con el teléfono
vertical (borde superior hacia arriba), la gravedad del navegador cae en +y.
Rotación de 90° sobre z (conserva la mano derecha):
    x_uci =  y_tel      y_uci = -x_tel      z_uci = z_tel
El mismo giro se aplica al giroscopio. En `devicemotion`, rotationRate.beta
gira en torno a x, gamma en torno a y y alpha en torno a z.
"""

from pathlib import Path

import numpy as np
from scipy.signal import butter, filtfilt, medfilt

from api.services.uci_har_recovery import HARConverter

ROOT_DIR = Path(__file__).resolve().parents[2]
RUTA_NORMALIZACION = ROOT_DIR / "data" / "modelos" / "har_normalizacion.npz"

FRECUENCIA = 50.0
VENTANA = 128
PASO = 64
GRAVEDAD = 9.80665

# Duración mínima de una grabación para obtener al menos una ventana.
DURACION_MINIMA_S = VENTANA / FRECUENCIA


def rotar_a_ejes_uci(xyz):
    """(N, 3) en ejes del teléfono (vertical, pantalla al frente) -> ejes UCI."""
    xyz = np.asarray(xyz, dtype=np.float64)
    return np.column_stack([xyz[:, 1], -xyz[:, 0], xyz[:, 2]])


def rotar_a_ejes_telefono(xyz):
    """Inversa de rotar_a_ejes_uci (se usa para pruebas con datos de UCI)."""
    xyz = np.asarray(xyz, dtype=np.float64)
    return np.column_stack([-xyz[:, 1], xyz[:, 0], xyz[:, 2]])


def remuestrear(timestamps_ms, valores, frecuencia=FRECUENCIA):
    """Interpola linealmente a una malla uniforme de `frecuencia` Hz."""
    t = np.asarray(timestamps_ms, dtype=np.float64) / 1000.0
    v = np.asarray(valores, dtype=np.float64)

    orden = np.argsort(t, kind="stable")
    t, v = t[orden], v[orden]
    # Timestamps repetidos (pasa en algunos navegadores): conservar el primero.
    unicos = np.concatenate([[True], np.diff(t) > 0])
    t, v = t[unicos], v[unicos]

    if len(t) < 2:
        raise ValueError("Se necesitan al menos 2 muestras con tiempos distintos.")

    malla = np.arange(t[0], t[-1] + 1e-9, 1.0 / frecuencia)
    salida = np.column_stack([np.interp(malla, t, v[:, k]) for k in range(v.shape[1])])
    return malla, salida


def _pasa_bajos(senal, corte_hz, orden=3):
    b, a = butter(N=orden, Wn=corte_hz / (FRECUENCIA / 2.0), btype="low")
    return np.column_stack([filtfilt(b, a, senal[:, k]) for k in range(senal.shape[1])])


def _filtrar_ruido(senal):
    """Mediana de 3 + Butterworth de 20 Hz, como en UCI HAR."""
    mediana = np.column_stack([medfilt(senal[:, k], kernel_size=3) for k in range(senal.shape[1])])
    return _pasa_bajos(mediana, 20.0)


class PipelineTelefono:
    """Convierte una grabación del teléfono en características UCI normalizadas."""

    def __init__(self, ruta_normalizacion=RUTA_NORMALIZACION):
        """`ruta_normalizacion=None` solo se usa al calibrar (características crudas)."""
        self.conversor = HARConverter(sampling_rate=int(FRECUENCIA))
        self.escala = None
        self.desplazamiento = None
        if ruta_normalizacion is None:
            return

        ruta = Path(ruta_normalizacion)
        if not ruta.is_file():
            raise FileNotFoundError(
                f"No existe {ruta}. Genérala con: python data/calibrar_har.py "
                "<carpeta 'UCI HAR Dataset'>"
            )
        datos = np.load(ruta)
        self.escala = np.asarray(datos["escala"], dtype=np.float64)
        self.desplazamiento = np.asarray(datos["desplazamiento"], dtype=np.float64)
        if self.escala.shape != (561,) or self.desplazamiento.shape != (561,):
            raise ValueError("La normalización debe tener 561 valores.")

    def normalizar(self, crudas):
        if self.escala is None:
            raise RuntimeError("Pipeline creado sin normalización (modo calibración).")
        return np.clip(self.escala * crudas + self.desplazamiento, -1.0, 1.0)

    def senales_uci(self, timestamps_ms, acelerometro_ms2, giroscopio_grados):
        """
        Devuelve las señales preprocesadas en ejes y unidades de UCI:
            total_acc (g), body_acc (g), gravedad (g), giroscopio (rad/s)
        a 50 Hz exactos.
        """
        acc = np.asarray(acelerometro_ms2, dtype=np.float64)
        gyro = np.asarray(giroscopio_grados, dtype=np.float64)
        if acc.ndim != 2 or acc.shape[1] != 3 or gyro.shape != acc.shape:
            raise ValueError("Acelerómetro y giroscopio deben tener forma (N, 3).")
        if not (np.isfinite(acc).all() and np.isfinite(gyro).all()):
            raise ValueError("Los sensores contienen valores NaN o infinitos.")

        _, juntos = remuestrear(timestamps_ms, np.hstack([acc, gyro]))
        if len(juntos) < VENTANA:
            raise ValueError(
                f"La grabación dura {len(juntos) / FRECUENCIA:.2f} s; se necesitan "
                f"al menos {DURACION_MINIMA_S:.2f} s."
            )

        total = rotar_a_ejes_uci(juntos[:, :3]) / GRAVEDAD
        giro = np.deg2rad(rotar_a_ejes_uci(juntos[:, 3:]))

        total = _filtrar_ruido(total)
        giro = _filtrar_ruido(giro)
        gravedad = _pasa_bajos(total, 0.3)
        cuerpo = total - gravedad

        return {"total_acc": total, "body_acc": cuerpo, "gravedad": gravedad, "giroscopio": giro}

    def caracteristicas(self, timestamps_ms, acelerometro_ms2, giroscopio_grados):
        """(n_ventanas, 561) normalizadas, listas para los modelos."""
        return self.normalizar(
            self.caracteristicas_crudas(timestamps_ms, acelerometro_ms2, giroscopio_grados)
        )

    def caracteristicas_crudas(self, timestamps_ms, acelerometro_ms2, giroscopio_grados):
        """(n_ventanas, 561) sin normalizar."""
        s = self.senales_uci(timestamps_ms, acelerometro_ms2, giroscopio_grados)
        return self.crudas_desde_senales(s)

    def crudas_desde_senales(self, s):
        n = len(s["total_acc"])
        filas = []
        for inicio in range(0, n - VENTANA + 1, PASO):
            fin = inicio + VENTANA
            crudas = self.conversor._extraer_ventana_preprocesada(
                s["body_acc"][inicio:fin],
                s["gravedad"][inicio:fin],
                s["giroscopio"][inicio:fin],
            )
            filas.append(np.asarray(crudas, dtype=np.float64).reshape(561))
        return np.asarray(filas)
