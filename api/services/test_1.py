
import joblib
import numpy as np

from tensorflow.keras.models import load_model
from api.models.base_predictor import BasePredictor


class GatosPerrosPredictor(BasePredictor):

    def __init__(self, model_dir):
        super().__init__(model_dir)
        self.load_models()

    def load_models(self):

        self.models = {
            "CNN": load_model(
                self.model_dir / "test-1_cnn.keras"
            ),
            "MLP": joblib.load(
                self.model_dir / "test-1_mlp.joblib"
            )
        }

    def preprocess(self, data):
        X = np.asarray(data, dtype=np.float32)

        # normalizar en caso de
        if X.max() > 1:
            X = X / 255.0

        return X

    def predict(self, data):

        # Preparar datos para cada arquitectura
        X_cnn = data.reshape(-1, 28, 28, 1)
        X_mlp = data.reshape(-1, 784)


        prob_cnn = self.models["CNN"].predict(
            X_cnn,
            verbose=0
        )

        pred_cnn = (prob_cnn >= 0.5).astype(int).flatten()

        pred_mlp = self.models["MLP"].predict(X_mlp)

        return {
            "CNN": pred_cnn.tolist(),
            "MLP": pred_mlp.tolist()
        }
