import json
import os
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.test_1 import GatosPerrosPredictor
from api.services.sesion_prueba_2 import SesionPrueba2

MODEL_DIR = ROOT_DIR / "data" / "modelos"
ETIQUETAS_CLASE = {0: "Gato", 1: "Perro"}

_predictor_test_1 = None
_puerto_http_activo = 8000
_puerto_https_activo = None

# Estado compartido en tiempo real cuando el teléfono actúa como sensor de cámara
_estado_camara_lock = threading.Lock()
_estado_camara = {
    "seq": 0,
    "timestamp": 0.0,
    "conectado": False,
    "tiene_dibujo": False,
    "pixeles": None,
    "modelos": None,
    "captura_seq": 0,
    "ultima_captura": None,
}

# =====================================================
# PRUEBA 2 - SESIÓN (teléfono <-> pantalla <-> modelos)
# =====================================================
# La lógica vive en api/services/sesion_prueba_2.py. TensorFlow y el pipeline
# del teléfono se cargan solo la primera vez que se analiza una grabación.

_predictor_test_2 = None
_pipeline_test_2 = None
_carga_test_2_lock = threading.Lock()


def obtener_predictor_test_2():
    global _predictor_test_2
    with _carga_test_2_lock:
        if _predictor_test_2 is None:
            from api.services.test_2 import ActividadPredictor
            _predictor_test_2 = ActividadPredictor(model_dir=MODEL_DIR)
    return _predictor_test_2


def obtener_pipeline_test_2():
    global _pipeline_test_2
    with _carga_test_2_lock:
        if _pipeline_test_2 is None:
            from api.services.sensor_har import PipelineTelefono
            _pipeline_test_2 = PipelineTelefono()
    return _pipeline_test_2


sesion_prueba_2 = SesionPrueba2(
    obtener_predictor=obtener_predictor_test_2,
    obtener_pipeline=obtener_pipeline_test_2,
)


def obtener_ip_local():
    """
    Obtiene la IP IPv4 de la interfaz de red local real.
    Evita interfaces virtuales como Cloudflare WARP.
    """

    try:
        conexiones = socket.getaddrinfo(
            socket.gethostname(),
            None,
            socket.AF_INET
        )

        for conexion in conexiones:
            ip = conexion[4][0]

            # Ignorar localhost
            if ip.startswith("127."):
                continue

            # Ignorar Cloudflare WARP
            if ip.startswith("172.16."):
                continue

            # Preferir redes privadas normales
            if (
                ip.startswith("192.168.") or
                ip.startswith("10.") or
                (
                    ip.startswith("172.")
                    and not ip.startswith("172.16.")
                )
            ):
                return ip

    except Exception:
        pass

    return "127.0.0.1"


def obtener_predictor_test_1():
    global _predictor_test_1
    if _predictor_test_1 is None:
        _predictor_test_1 = GatosPerrosPredictor(model_dir=MODEL_DIR)
    return _predictor_test_1


def procesar_evaluacion_test_1(payload):
    imagenes = payload.get("imagenes", payload.get("data"))
    etiquetas = payload.get("etiquetas", payload.get("y_real"))

    if not imagenes or etiquetas is None:
        raise ValueError("Se requieren 'imagenes' y 'etiquetas' para evaluar la prueba.")

    if len(imagenes) < 5 or len(etiquetas) < 5:
        raise ValueError("Se requieren al menos 5 imágenes y etiquetas para evaluar la prueba.")

    if len(imagenes) != len(etiquetas):
        raise ValueError("La cantidad de imágenes y etiquetas debe coincidir.")

    predictor = obtener_predictor_test_1()
    resultados = predictor.evaluar(imagenes, etiquetas)

    return {
        "etiquetas_reales": [int(y) for y in resultados["etiquetas_reales"]],
        "predicciones": {
            modelo: [int(p) for p in preds]
            for modelo, preds in resultados["predicciones"].items()
        },
        "metricas": {
            modelo: {
                metrica: float(valor)
                for metrica, valor in valores.items()
            }
            for modelo, valores in resultados["metricas"].items()
        },
    }


def procesar_prediccion_dibujo(payload):
    """Evalúa un único dibujo de 28x28 (784 píxeles) en tiempo real y entrega predicción y confianza."""
    imagen = payload.get("imagen", payload.get("pixeles"))

    if not imagen or len(imagen) != 784:
        raise ValueError("Se requiere 'imagen' con 784 píxeles (28 x 28).")

    predictor = obtener_predictor_test_1()
    probabilidades = predictor.predecir_con_confianza([imagen])

    # Clase 0 = Gato, Clase 1 = Perro
    resultado = {}
    for modelo, probs in probabilidades.items():
        prob_perro = float(probs[0])
        prob_gato = float(1.0 - prob_perro)
        prediccion = int(prob_perro >= 0.5)
        confianza = prob_perro if prediccion == 1 else prob_gato

        resultado[modelo] = {
            "prediccion": prediccion,
            "etiqueta": ETIQUETAS_CLASE[prediccion],
            "confianza": confianza,
            "prob_perro": prob_perro,
            "prob_gato": prob_gato,
        }

    etiqueta = payload.get("etiqueta")
    tiene_dibujo = bool(max(imagen) > 0)
    return {
        "tiene_dibujo": tiene_dibujo,
        "etiqueta_real": None if etiqueta is None else int(etiqueta),
        "modelos": resultado,
        "predicciones": resultado,
    }


_MAX_IMAGEN_ORIGINAL = 400_000  # ~300 KB en base64; un JPEG de 320 px pesa ~15-40 KB


def _imagen_original_valida(valor):
    """Acepta solo una data URL JPEG/PNG de tamaño razonable; si no, None."""
    if not isinstance(valor, str) or len(valor) > _MAX_IMAGEN_ORIGINAL:
        return None
    if not valor.startswith(("data:image/jpeg;base64,", "data:image/png;base64,")):
        return None
    return valor


def procesar_frame_camara(payload):
    """Recibe un frame 28x28 desde la cámara del teléfono, predice en tiempo real y sincroniza con el PC."""
    global _estado_camara

    tiene_dibujo = bool(payload.get("tiene_dibujo", True))
    imagen = payload.get("imagen", payload.get("pixeles"))
    capturar = bool(payload.get("capturar", False))
    etiqueta = payload.get("etiqueta")

    modelos_res = None
    pixeles_limpios = None

    if imagen and len(imagen) == 784:
        pixeles_limpios = [int(max(0, min(255, round(v)))) for v in imagen]
        if tiene_dibujo and max(pixeles_limpios) > 0:
            pred = procesar_prediccion_dibujo({"imagen": pixeles_limpios, "etiqueta": etiqueta})
            modelos_res = pred["modelos"]
        else:
            tiene_dibujo = False

    ahora = time.time()
    with _estado_camara_lock:
        _estado_camara["seq"] += 1
        _estado_camara["timestamp"] = ahora
        _estado_camara["conectado"] = True
        _estado_camara["tiene_dibujo"] = tiene_dibujo
        _estado_camara["pixeles"] = pixeles_limpios
        _estado_camara["modelos"] = modelos_res

        if capturar and tiene_dibujo and pixeles_limpios and modelos_res:
            _estado_camara["captura_seq"] += 1
            _estado_camara["ultima_captura"] = {
                "captura_seq": _estado_camara["captura_seq"],
                "timestamp": ahora,
                "pixeles": pixeles_limpios,
                "etiqueta": None if etiqueta is None else int(etiqueta),
                "id_captura": payload.get("id_captura"),
                "imagen_original": _imagen_original_valida(
                    payload.get("imagen_original")
                ),
                "modelos": modelos_res,
            }

        respuesta = {
            "ok": True,
            "seq": _estado_camara["seq"],
            "timestamp": ahora,
            "tiene_dibujo": tiene_dibujo,
            "modelos": modelos_res,
            "predicciones": modelos_res,
            "captura_seq": _estado_camara["captura_seq"],
            "solicitud_captura": _estado_camara["captura_seq"],
        }

    return respuesta


class ServidorExclusivo(ThreadingHTTPServer):
    """
    En Windows, SO_REUSEADDR (activado por HTTPServer) permite que DOS procesos
    escuchen en el mismo puerto y se repartan las peticiones en silencio
    (p. ej. si se ejecuta `python -m api.main` dos veces). Aquí se pide el
    puerto en exclusiva para que el segundo falle con un error claro.
    """

    if sys.platform == "win32":
        allow_reuse_address = False

        def server_bind(self):
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                self.socket.setsockopt(
                    socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1
                )
            super().server_bind()


class APIRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def log_message(self, format, *args):
        # Evitar saturar la consola con peticiones de polling
        if (
            self.path.startswith("/api/camara")
            or self.path.startswith("/api/test_1/predecir")
            or self.path.startswith("/api/prueba_2/estado")
            or self.path.startswith("/api/prueba_2/sensor")
        ):
            return

        super().log_message(format, *args)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        ruta = self.path.split("?")[0].rstrip("/")

        if ruta == "/api/info":
            self._responder_json(200, {
                "ip_local": obtener_ip_local(),
                "puerto_http": _puerto_http_activo,
                "puerto_https": _puerto_https_activo,
            })
            return

        if ruta == "/api/camara/estado":
            ahora = time.time()
            with _estado_camara_lock:
                activo = (ahora - _estado_camara["timestamp"]) < 6.0
                ultima_cap = _estado_camara["ultima_captura"]
                datos = {
                    "seq": _estado_camara["seq"],
                    "timestamp": _estado_camara["timestamp"],
                    "conectado": bool(_estado_camara["conectado"] and activo),
                    "tiene_dibujo": _estado_camara["tiene_dibujo"] if activo else False,
                    "pixeles": _estado_camara["pixeles"] if activo else None,
                    "modelos": _estado_camara["modelos"] if activo else None,
                    "predicciones": _estado_camara["modelos"] if activo else None,
                    "captura_seq": _estado_camara["captura_seq"],
                    "solicitud_captura": _estado_camara["captura_seq"],
                    "etiqueta_captura": ultima_cap["etiqueta"] if ultima_cap else None,
                    "ultima_captura": ultima_cap,
                }
            self._responder_json(200, datos)
            return

        if ruta == "/api/prueba_2/estado":
            self._responder_json(200, sesion_prueba_2.estado())
            return

        if ruta == "/api/prueba_2/url":
            ip_local = obtener_ip_local()

            if _puerto_https_activo:
                url = (
                    f"https://{ip_local}:{_puerto_https_activo}"
                    "/exploracion/sensor_prueba_2.html"
                )
            else:
                url = (
                    f"http://{ip_local}:{_puerto_http_activo}"
                    "/exploracion/sensor_prueba_2.html"
                )

            self._responder_json(200, {
                "url": url
            })

            return

        super().do_GET()

    def do_POST(self):
        rutas_lote = {
            "/api/test_1",
            "/api/evaluar",
            "/api/predict",
            "/predict",
            "/evaluar"
        }
        rutas_individual = {
            "/api/test_1/predecir",
            "/api/predecir_dibujo"
        }
        rutas_camara = {
            "/api/camara/frame"
        }
        # Prueba 2: cada ruta llama a un método de la sesión compartida.
        rutas_prueba_2 = {
            "/api/prueba_2/sensor": lambda p: sesion_prueba_2.recibir(p),
            "/api/prueba_2/iniciar": lambda p: sesion_prueba_2.iniciar(
                p.get("actividad"), p.get("cuenta_regresiva", 5)
            ),
            "/api/prueba_2/cancelar": lambda p: sesion_prueba_2.cancelar(),
            "/api/prueba_2/eliminar": lambda p: sesion_prueba_2.eliminar(p.get("id")),
            "/api/prueba_2/reiniciar": lambda p: sesion_prueba_2.reiniciar(),
            "/api/prueba_2/metricas": lambda p: sesion_prueba_2.metricas(),
        }
        rutas_test_2 = {
            "/api/test_2",
        }

        ruta = self.path.split("?")[0].rstrip("/")

        if (
            ruta not in rutas_lote
            and ruta not in rutas_individual
            and ruta not in rutas_camara
            and ruta not in rutas_prueba_2
            and ruta not in rutas_test_2
        ):
            self._responder_json(
                404,
                {"error": f"Ruta no encontrada: {self.path}"}
            )
            return

        try:
            content_length = int(
                self.headers.get("Content-Length", 0)
            )

            cuerpo = (
                self.rfile
                .read(content_length)
                .decode("utf-8")
            )

            payload = json.loads(cuerpo) if cuerpo else {}

            if ruta in rutas_individual:
                resultados = procesar_prediccion_dibujo(payload)

            elif ruta in rutas_camara:
                resultados = procesar_frame_camara(payload)

            elif ruta in rutas_prueba_2:
                if not isinstance(payload, dict):
                    raise ValueError("El cuerpo debe ser un objeto JSON.")
                resultados = rutas_prueba_2[ruta](payload)

            elif ruta in rutas_test_2:
                # Evaluación directa (sin sesión): sensores + etiqueta -> predicción.
                # Import diferido: TensorFlow solo se carga al usar la prueba 2.
                from api.services.test_2 import procesar_test_2

                resultados = procesar_test_2(payload, model_dir=MODEL_DIR)

            else:
                resultados = procesar_evaluacion_test_1(payload)

            self._responder_json(200, resultados)

        except ValueError as err:
            self._responder_json(
                400,
                {"error": str(err)}
            )

        except Exception as err:
            self._responder_json(
                500,
                {"error": f"Error al procesar la predicción: {err}"}
            )

    def _responder_json(self, status_code, data):
        respuesta = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )
        self.send_header(
            "Content-Length",
            str(len(respuesta))
        )
        self.end_headers()
        self.wfile.write(respuesta)


def _generar_certificado_https(ip_local):
    """Genera un certificado autofirmado temporal para que el navegador móvil permita abrir la cámara en red local."""
    candidatas_openssl = [
        shutil.which("openssl"),
        r"C:\Program Files\Git\usr\bin\openssl.exe",
        r"C:\Program Files (x86)\Git\usr\bin\openssl.exe",
    ]
    openssl_bin = next(
        (c for c in candidatas_openssl if c and Path(c).is_file()),
        None
    )

    if not openssl_bin:
        print(
            "[HTTPS] No se encontró openssl (instala Git para Windows); "
            "la cámara del teléfono no funcionará sin HTTPS."
        )
        return None

    cert_dir = Path(tempfile.gettempdir()) / "infovis_camara_ssl"
    cert_dir.mkdir(parents=True, exist_ok=True)
    cert_file = cert_dir / f"cert_{ip_local.replace('.', '_')}.pem"
    key_file = cert_dir / f"key_{ip_local.replace('.', '_')}.pem"

    if cert_file.is_file() and key_file.is_file():
        return cert_file, key_file

    cmd = [
        openssl_bin,
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        str(key_file),
        "-out",
        str(cert_file),
        "-days",
        "30",
        "-nodes",
        "-subj",
        f"/CN={ip_local}",
        "-addext",
        f"subjectAltName=IP:{ip_local},IP:127.0.0.1,DNS:localhost",
    ]

    # Algunos programas (p. ej. PostgreSQL/psqlODBC) dejan OPENSSL_CONF
    # apuntando a un archivo que no existe y openssl falla al leerlo.
    # Se usa la configuración que trae el propio openssl (la de Git) o ninguna.
    entorno = os.environ.copy()
    conf_actual = entorno.get("OPENSSL_CONF")
    if conf_actual and not Path(conf_actual).is_file():
        entorno.pop("OPENSSL_CONF", None)
        raiz_git = Path(openssl_bin).resolve().parents[2]
        for conf in (
            raiz_git / "usr" / "ssl" / "openssl.cnf",
            raiz_git / "mingw64" / "etc" / "ssl" / "openssl.cnf",
            raiz_git / "mingw64" / "ssl" / "openssl.cnf",
        ):
            if conf.is_file():
                entorno["OPENSSL_CONF"] = str(conf)
                break

    try:
        subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            env=entorno
        )
        return cert_file, key_file
    except Exception as err:
        detalle = getattr(err, "stderr", b"") or b""
        if isinstance(detalle, bytes):
            detalle = detalle.decode("utf-8", errors="replace")
        print(
            "[HTTPS] No se pudo generar el certificado local; la cámara del "
            f"teléfono no funcionará sin HTTPS.\n        {detalle.strip()[:300] or err}"
        )
        return None


def iniciar_servidor(host="0.0.0.0", port=8000):
    global _puerto_http_activo, _puerto_https_activo
    _puerto_http_activo = port

    # Pre-cargar los modelos al levantar el servidor
    obtener_predictor_test_1()
    ip_local = obtener_ip_local()

    try:
        servidor = ServidorExclusivo(
            (host, port),
            APIRequestHandler
        )
    except OSError as err:
        print(
            f"\nNo se pudo abrir el puerto {port}: ya está en uso "
            "(¿hay otro `python -m api.main` abierto?).\n"
            f"Ciérralo o usa otro puerto: python -m api.main {port + 1}\n"
            f"Detalle: {err}"
        )
        sys.exit(1)

    # Levantar también un puerto HTTPS (port + 443, ej. 8443)
    # para que iOS/Android permitan getUserMedia en WiFi.
    cert_pair = _generar_certificado_https(ip_local)

    if cert_pair is not None:
        puerto_https = port + 443

        try:
            servidor_https = ServidorExclusivo(
                (host, puerto_https),
                APIRequestHandler
            )

            contexto_ssl = ssl.SSLContext(
                ssl.PROTOCOL_TLS_SERVER
            )

            contexto_ssl.load_cert_chain(
                certfile=str(cert_pair[0]),
                keyfile=str(cert_pair[1])
            )

            servidor_https.socket = contexto_ssl.wrap_socket(
                servidor_https.socket,
                server_side=True
            )

            hilo_https = threading.Thread(
                target=servidor_https.serve_forever,
                daemon=True
            )

            hilo_https.start()
            _puerto_https_activo = puerto_https

        except Exception as err:
            _puerto_https_activo = None
            print(
                f"[HTTPS] No se pudo abrir el puerto {puerto_https} ({err}); "
                "la cámara del teléfono no funcionará sin HTTPS."
            )

    print(
        f"Servidor API local activo en http://localhost:{port}"
    )

    print(
        f"Abre http://localhost:{port}/exploracion/prueba_1.html "
        "en tu navegador"
    )

    if _puerto_https_activo:
        print(
            "Sensor de cámara para teléfono (WiFi): "
            f"https://{ip_local}:{_puerto_https_activo}"
            "/exploracion/sensor_camara.html"
        )
        print(
            "Para usar también Protobject (WebRTC), abre la pantalla en: "
            f"https://{ip_local}:{_puerto_https_activo}"
            "/exploracion/prueba_1.html y escanea su QR"
        )
        print(
            f"Prueba 2 (actividades): http://localhost:{port}"
            "/exploracion/prueba_2.html"
        )
    else:
        print(
            "Sensor de cámara para teléfono (WiFi): "
            f"http://{ip_local}:{port}"
            "/exploracion/sensor_camara.html"
        )

    try:
        servidor.serve_forever()

    except KeyboardInterrupt:
        print("\nServidor detenido.")

    finally:
        servidor.server_close()


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    iniciar_servidor(port=puerto)
