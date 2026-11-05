from pathlib import Path

import joblib
import numpy as np
from tensorflow.keras.models import load_model

from api.models.base_predictor import BasePredictor

ACTIVIDADES = {
    1: "Walking",
    2: "Walking Upstairs",
    3: "Walking Downstairs",
    4: "Sitting",
    5: "Standing",
    6: "Laying",
}


class ActividadPredictor(BasePredictor):
    
    # Predictor para la prueba 2: UCI HAR.


    def __init__(self, model_dir):
        super().__init__(Path(model_dir))
        self.load_models()

    def load_models(self):
        cnn_path = self.model_dir / "test-2_cnn.keras"
        mlp_path = self.model_dir / "test-2_mlp.joblib"

        faltantes = []

        if not cnn_path.is_file():
            faltantes.append(str(cnn_path))

        if not mlp_path.is_file():
            faltantes.append(str(mlp_path))

        if faltantes:
            raise FileNotFoundError(
                "No se encontraron los modelos de la prueba 2:\n"
                + "\n".join(faltantes)
            )

        self.models = {
            "CNN": load_model(cnn_path),
            "MLP": joblib.load(mlp_path),
        }

    def preprocess(self, data):
        
        # Convierte los datos a numpy y verifica que tengan exactamente 561 características.

        X = np.asarray(data, dtype=np.float32)

        if X.ndim == 1:
            X = X.reshape(1, -1)

        if X.ndim != 2:
            raise ValueError(
                f"Los datos deben tener 2 dimensiones. "
                f"Forma recibida: {X.shape}"
            )

        if X.shape[1] != 561:
            raise ValueError(
                f"Se esperaban 561 caracteristicas, "
                f"pero se recibieron {X.shape[1]}."
            )

        if not np.isfinite(X).all():
            raise ValueError("Los datos contienen valores NaN o infinitos.")

        return X

    def _adaptar_entrada_cnn(self, X):
        
        # Adapta X a la forma que espera la CNN.

        model = self.models["CNN"]

        input_shape = model.input_shape

        # Algunas redes pueden devolver una lista de entradas.

        if isinstance(input_shape, list):

            if len(input_shape) != 1:
                raise ValueError(
                    "La CNN tiene múltiples entradas y "
                    "no es compatible con este predictor."
                )

            input_shape = input_shape[0]

        if len(input_shape) == 2 and input_shape[-1] == 561:
            return X

        if len(input_shape) == 3 and input_shape[1:] == (561, 1):
            return X.reshape(-1, 561, 1)

        if len(input_shape) == 4 and input_shape[1:] == (561, 1, 1):
            return X.reshape(-1, 561, 1, 1)

        raise ValueError(f"Forma de entrada de CNN no reconocida: {input_shape}")

    def predict(self, data):

        X = self.preprocess(data)


        # CNN

        cnn_input = self._adaptar_entrada_cnn(X)

        cnn_output = np.asarray(
            self.models["CNN"].predict(
                cnn_input,
                verbose=0
            )
        )

        if cnn_output.ndim == 1:
            pred_cnn = np.rint(cnn_output).astype(int)

        elif cnn_output.shape[-1] == 1:
            pred_cnn = np.rint(cnn_output.reshape(-1)).astype(int)

        else:
            pred_cnn = (np.argmax(cnn_output, axis=1) + 1)


        # MLP

        pred_mlp = np.asarray(self.models["MLP"].predict(X)).reshape(-1).astype(int)

        return {"CNN": pred_cnn.tolist(), "MLP": pred_mlp.tolist(),}

    def evaluar(self, data, etiquetas):

        X = self.preprocess(data)

        y_real = np.asarray(etiquetas, dtype=int).reshape(-1)

        if len(X) != len(y_real):
            raise ValueError("La cantidad de muestras y etiquetas debe coincidir.")

        predicciones = self.predict(X)

        metricas = {}

        for nombre, pred in predicciones.items():
            metricas[nombre] = self.calcular_metricas(y_real, pred)

        return {
            "etiquetas_reales": list(y_real),
            "predicciones": predicciones,
            "metricas": metricas
        }

    @staticmethod
    def nombre_actividad(etiqueta):

        return ACTIVIDADES.get(int(etiqueta),f"Clase {etiqueta}")