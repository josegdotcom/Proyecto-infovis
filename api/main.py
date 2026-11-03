import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.services.test_1 import GatosPerrosPredictor

MODEL_DIR = ROOT_DIR / "data" / "modelos"
_predictor_test_1 = None


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
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        rutas_validas = {"/api/test_1", "/api/evaluar", "/api/predict", "/predict", "/evaluar"}
        rutas_dibujo = {"/api/test_1/predecir"}
        ruta = self.path.split("?")[0].rstrip("/")

        if ruta not in rutas_validas and ruta not in rutas_dibujo:
            self._responder_json(404, {"error": f"Ruta no encontrada: {self.path}"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            cuerpo = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(cuerpo) if cuerpo else {}
            if ruta in rutas_dibujo:
                resultados = procesar_prediccion_dibujo(payload)
            else:
                resultados = procesar_evaluacion_test_1(payload)
            self._responder_json(200, resultados)
        except ValueError as err:
            self._responder_json(400, {"error": str(err)})
        except Exception as err:
            self._responder_json(500, {"error": f"Error al procesar la predicción: {err}"})

    def _responder_json(self, status_code, data):
        respuesta = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(respuesta)))
        self.end_headers()
        self.wfile.write(respuesta)


def iniciar_servidor(host="0.0.0.0", port=8000):
    # Pre-cargar los modelos al levantar el servidor
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
