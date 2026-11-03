"""
Servidor local de la API de predicción.

Sirve los archivos estáticos del proyecto (HTML, CSS, JS) y expone endpoints
POST para que la página de la Prueba 1 consulte a los modelos CNN y MLP.

Uso, desde la raíz del repositorio:
    python -m api.main          # puerto 8000
    python -m api.main 8080     # otro puerto

Endpoints:
    POST /api/test_1/predecir
        Un dibujo -> predicción y confianza de cada modelo.
        Cuerpo: {"imagen": [784 enteros 0-255], "etiqueta": 0|1 (opcional)}
    POST /api/test_1   (alias: /api/evaluar, /api/predict, /predict, /evaluar)
        Varios dibujos -> predicciones y métricas de cada modelo.
        Cuerpo: {"imagenes": [[784 enteros], ...], "etiquetas": [0|1, ...]}

Etiquetas: 0 = Gato, 1 = Perro.
"""

import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Raíz del repositorio; se agrega al path para poder importar "api.*"
# aunque el archivo se ejecute directamente.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.test_1 import GatosPerrosPredictor  # noqa: E402

MODEL_DIR = ROOT_DIR / "data" / "modelos"

# Mínimo de dibujos para que las métricas de la evaluación tengan sentido
MINIMO_IMAGENES_EVALUACION = 5

# Rutas aceptadas por cada endpoint
RUTAS_EVALUACION = {"/api/test_1", "/api/evaluar", "/api/predict", "/predict", "/evaluar"}
RUTAS_DIBUJO = {"/api/test_1/predecir"}

# Instancia única del predictor (cargar los modelos es lento)
_predictor_test_1 = None


def obtener_predictor_test_1():
    """Devuelve el predictor de gatos y perros, cargándolo la primera vez."""
    global _predictor_test_1
    if _predictor_test_1 is None:
        _predictor_test_1 = GatosPerrosPredictor(model_dir=MODEL_DIR)
    return _predictor_test_1


def procesar_evaluacion_test_1(payload):
    """
    Evalúa un lote de dibujos con ambos modelos.

    Acepta también los nombres de campo "data" e "y_real" por compatibilidad.
    Devuelve las etiquetas reales, las predicciones por modelo y sus métricas
    (accuracy, precision, recall, f1_score) como tipos nativos serializables.
    Lanza ValueError si el cuerpo no es válido.
    """
    imagenes = payload.get("imagenes", payload.get("data"))
    etiquetas = payload.get("etiquetas", payload.get("y_real"))

    if not imagenes or etiquetas is None:
        raise ValueError("Se requieren 'imagenes' y 'etiquetas' para evaluar la prueba.")

    if len(imagenes) < MINIMO_IMAGENES_EVALUACION or len(etiquetas) < MINIMO_IMAGENES_EVALUACION:
        raise ValueError(
            f"Se requieren al menos {MINIMO_IMAGENES_EVALUACION} imágenes y etiquetas para evaluar la prueba."
        )

    if len(imagenes) != len(etiquetas):
        raise ValueError("La cantidad de imágenes y etiquetas debe coincidir.")

    predictor = obtener_predictor_test_1()
    resultados = predictor.evaluar(imagenes, etiquetas)

    # Convertir tipos de NumPy a int/float para poder serializar a JSON
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
    """
    Predice un único dibujo con ambos modelos.

    Devuelve, por modelo, la clase predicha y su confianza (probabilidad de
    la clase elegida, entre 0,5 y 1). La etiqueta real solo se devuelve de
    vuelta para que el cliente compare; no influye en la predicción.
    Lanza ValueError si la imagen no tiene 784 píxeles.
    """
    imagen = payload.get("imagen")

    if not imagen or len(imagen) != 784:
        raise ValueError("Se requiere 'imagen' con 784 píxeles (28 x 28).")

    predictor = obtener_predictor_test_1()
    probabilidades = predictor.predecir_con_confianza([imagen])

    # Clase 1 = Perro; la confianza es la probabilidad de la clase elegida
    resultado = {}
    for modelo, probs in probabilidades.items():
        prob_perro = float(probs[0])
        prediccion = int(prob_perro >= 0.5)
        resultado[modelo] = {
            "prediccion": prediccion,
            "confianza": prob_perro if prediccion == 1 else 1.0 - prob_perro,
        }

    etiqueta = payload.get("etiqueta")
    return {
        "etiqueta_real": None if etiqueta is None else int(etiqueta),
        "modelos": resultado,
    }


class APIRequestHandler(SimpleHTTPRequestHandler):
    """
    Manejador HTTP: GET sirve archivos estáticos desde la raíz del
    repositorio y POST atiende los endpoints de predicción.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def end_headers(self):
        # CORS abierto para que la página funcione también desde otro
        # servidor local (por ejemplo, Live Server en otro puerto)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        """Responde la petición previa (preflight) de CORS."""
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        """Lee el JSON del cuerpo y lo envía al endpoint que corresponda."""
        ruta = self.path.split("?")[0].rstrip("/")

        if ruta not in RUTAS_EVALUACION and ruta not in RUTAS_DIBUJO:
            self._responder_json(404, {"error": f"Ruta no encontrada: {self.path}"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            cuerpo = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(cuerpo) if cuerpo else {}
            if ruta in RUTAS_DIBUJO:
                resultados = procesar_prediccion_dibujo(payload)
            else:
                resultados = procesar_evaluacion_test_1(payload)
            self._responder_json(200, resultados)
        except ValueError as err:
            # Errores de validación del cliente
            self._responder_json(400, {"error": str(err)})
        except Exception as err:
            self._responder_json(500, {"error": f"Error al procesar la predicción: {err}"})

    def _responder_json(self, status_code, data):
        """Envía `data` como respuesta JSON con el código indicado."""
        respuesta = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(respuesta)))
        self.end_headers()
        self.wfile.write(respuesta)


def iniciar_servidor(host="0.0.0.0", port=8000):
    """Carga los modelos y deja el servidor escuchando hasta Ctrl+C."""
    # Pre-cargar los modelos para que la primera petición no tarde
    obtener_predictor_test_1()
    servidor = ThreadingHTTPServer((host, port), APIRequestHandler)
    print(f"Servidor API local activo en http://localhost:{port}")
    print(f"Abre http://localhost:{port}/exploracion/prueba_1.html en tu navegador")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    iniciar_servidor(port=puerto)
