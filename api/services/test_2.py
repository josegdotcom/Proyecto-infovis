from pathlib import Path

import joblib
import numpy as np
from tensorflow.keras.models import load_model

from api.models.base_predictor import BasePredictor
from api.services.har_converter import HARConverter


ACTIVIDADES = {
    1: "Walking",
    2: "Walking Upstairs",
    3: "Walking Downstairs",
    4: "Sitting",
    5: "Standing",
    6: "Laying",
}


class ActividadPredictor(BasePredictor):
    def __init__(self, model_dir):
        self.model_dir = Path(model_dir)
        self.models = {}
        self.load_models()

    def load_models(self):
        cnn_path = self.model_dir / "test-2_cnn.keras"
        mlp_path = self.model_dir / "test-2_mlp.joblib"

        faltantes = [str(p) for p in (cnn_path, mlp_path) if not p.is_file()]
        if faltantes:
            raise FileNotFoundError(
                "No se encontraron los modelos de la prueba 2: " + ", ".join(faltantes)
            )

        self.models = {"CNN": load_model(cnn_path), "MLP": joblib.load(mlp_path)}
        if "CNN" not in self.models or "MLP" not in self.models:
            raise RuntimeError("Los modelos no se cargaron correctamente.")

    def preprocess(self, data):
        X = np.asarray(data, dtype=np.float32)
        if X.ndim == 1:
            X = X.reshape(1, -1)
        if X.ndim != 2 or X.shape[1] != 561:
            raise ValueError(
                f"Se esperaba una matriz de forma (n, 561); se recibió {X.shape}."
            )
        if not np.isfinite(X).all():
            raise ValueError("Los datos contienen valores NaN o infinitos.")
        return X

    @staticmethod
    def _adaptar_entrada_cnn(model, X):
        """Adapta las 561 variables a la forma de entrada declarada por Keras."""
        input_shape = model.input_shape
        if isinstance(input_shape, list):
            if len(input_shape) != 1:
                raise ValueError("La CNN tiene múltiples entradas y no es compatible con este endpoint.")
            input_shape = input_shape[0]

        if len(input_shape) == 2 and input_shape[-1] == 561:
            return X
        if len(input_shape) == 3 and input_shape[1:] == (561, 1):
            return X.reshape(-1, 561, 1)
        if len(input_shape) == 4 and input_shape[1:] == (561, 1, 1):
            return X.reshape(-1, 561, 1, 1)
        raise ValueError(
            f"Forma de entrada CNN no reconocida: {input_shape}. "
            "Se esperaba (None, 561), (None, 561, 1) o (None, 561, 1, 1)."
        )

    def predict(self, data):
        X = self.preprocess(data)

        cnn = self.models.get("CNN")
        mlp = self.models.get("MLP")
        if cnn is None or mlp is None:
            raise RuntimeError("Los modelos CNN y MLP no estan cargados correctamente.")
        cnn_input = self._adaptar_entrada_cnn(cnn, X)
        cnn_output = np.asarray(cnn.predict(cnn_input, verbose=0))
        if cnn_output.ndim == 1:
            pred_cnn = np.rint(cnn_output).astype(int)
        elif cnn_output.shape[-1] == 1:
            pred_cnn = np.rint(cnn_output.reshape(-1)).astype(int)
        else:
            pred_cnn = np.argmax(cnn_output, axis=1) + 1

        pred_mlp = np.asarray(mlp.predict(X)).reshape(-1).astype(int)

        return {"CNN": pred_cnn.tolist(), "MLP": pred_mlp.tolist()}

    def evaluar(self, data, etiquetas):
        X = self.preprocess(data)
        y_real = np.asarray(etiquetas, dtype=int).reshape(-1)
        if len(X) != len(y_real):
            raise ValueError("La cantidad de muestras y etiquetas debe coincidir.")



        predicciones = self.predict(X)
        from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

        metricas = {}
        for nombre, pred in predicciones.items():
            metricas[nombre] = {
                "accuracy": float(accuracy_score(y_real, pred)),
                "precision": float(precision_score(y_real, pred, average="weighted", zero_division=0)),
                "recall": float(recall_score(y_real, pred, average="weighted", zero_division=0)),
                "f1_score": float(f1_score(y_real, pred, average="weighted", zero_division=0)),
            }

        return {
            "cantidad": len(X),
            "etiquetas_reales": y_real.tolist(),
            "predicciones": predicciones,
            "metricas": metricas,
        }

    @staticmethod
    def nombre_actividad(etiqueta):
        return ACTIVIDADES.get(int(etiqueta), f"Clase {etiqueta}")


def procesar_test_2(datos, model_dir, sampling_rate=50):
    #Convierte los sensores del telefono, predice y evalúa contra la etiqueta real

    if not isinstance(datos, dict):
        raise ValueError("El cuerpo de la solicitud debe ser un objeto JSON.")

    acelerometro = datos.get("accelerometer")
    giroscopio = datos.get("gyroscope")
    etiqueta_real = datos.get("etiqueta_real")

    if acelerometro is None or giroscopio is None:
        raise ValueError("Se requieren los datos de accelerometer y gyroscope.")

    if etiqueta_real is None:
        raise ValueError("Se requiere la etiqueta real de la actividad.")

    try:
        etiqueta_real = int(etiqueta_real)
    except (TypeError, ValueError):
        raise ValueError("La etiqueta real debe ser un entero entre 1 y 6.")

    if etiqueta_real not in ACTIVIDADES:
        raise ValueError("La etiqueta real debe estar entre 1 y 6.")

    if not isinstance(acelerometro, list) or not isinstance(giroscopio, list):
        raise ValueError("Los sensores deben enviarse como listas de muestras.")

    if len(acelerometro) == 0 or len(giroscopio) == 0:
        raise ValueError("No hay datos del acelerómetro o del giroscopio.")

    if len(acelerometro) != len(giroscopio):
        raise ValueError("Acelerómetro y giroscopio deben tener la misma cantidad de muestras.")

    def convertir_sensor(nombre, muestras):
        valores = []
        for i, muestra in enumerate(muestras):
            if not isinstance(muestra, dict):
                raise ValueError(f"{nombre}[{i}] no es un objeto válido.")
            try:
                valores.append([
                    float(muestra["x"]),
                    float(muestra["y"]),
                    float(muestra["z"]),
                ])
            except (KeyError, TypeError, ValueError):
                raise ValueError(f"{nombre}[{i}] debe contener (x,y,z)")

        array = np.asarray(valores, dtype=np.float64)
        if not np.isfinite(array).all():
            raise ValueError(f"{nombre} contiene valores NaN o infinitos.")
        return array

    acc = convertir_sensor("accelerometer", acelerometro)
    gyro = convertir_sensor("gyroscope", giroscopio)

    converter = HARConverter(sampling_rate=sampling_rate)
    features = converter.transformar(acc, gyro)

    if features.ndim != 2 or features.shape[1] != 561:
        raise ValueError(
            f"El conversor produjo una forma inesperada: {features.shape}. "
        )

    predictor = ActividadPredictor(model_dir=model_dir)
    resultados = predictor.evaluar(features, [etiqueta_real] * len(features))

    actividades = {
        modelo: [predictor.nombre_actividad(p) for p in predicciones]
        for modelo, predicciones in resultados["predicciones"].items()
    }

    return {
        "muestras": len(acc),
        "sampling_rate": sampling_rate,
        "ventanas": len(features),
        "caracteristicas": int(features.shape[1]),
        "etiqueta_real": etiqueta_real,
        "actividad_real": ACTIVIDADES[etiqueta_real],
        "predicciones": resultados["predicciones"],
        "actividades": actividades,
        "metricas": resultados["metricas"],
        "features": features.tolist(),
    }
