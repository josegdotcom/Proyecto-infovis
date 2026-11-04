import re
import struct
import zipfile
import joblib
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

try:
    from tensorflow.keras.models import load_model
except ModuleNotFoundError:
    load_model = None

from api.models.base_predictor import BasePredictor


class _KerasCNNFallback:
    """Ejecuta la inferencia exacta de test-1_cnn.keras usando NumPy cuando TensorFlow no está instalado."""

    def __init__(self, keras_path):
        with zipfile.ZipFile(keras_path, "r") as z:
            raw = z.read("model.weights.h5")

        pat = b"\x00\x00\x03\x01"
        bloques = [
            struct.unpack("<QQ", raw[m.end() : m.end() + 16])
            for m in re.finditer(re.escape(pat), raw)
        ]

        def leer_tensor(indice, shape):
            offset, size = bloques[indice]
            return np.frombuffer(
                raw, dtype=np.float32, count=size // 4, offset=offset
            ).reshape(shape)

        self.w1 = leer_tensor(0, (3, 3, 1, 32))
        self.b1 = leer_tensor(1, (32,))
        self.w2 = leer_tensor(2, (3, 3, 32, 64))
        self.b2 = leer_tensor(3, (64,))
        self.w3 = leer_tensor(4, (1600, 128))
        self.b3 = leer_tensor(5, (128,))
        self.w4 = leer_tensor(6, (128, 1))
        self.b4 = leer_tensor(7, (1,))

    def predict(self, X_cnn, verbose=0):
        X = np.asarray(X_cnn, dtype=np.float32)
        c1 = np.maximum(
            0.0,
            np.einsum(
                "nhwcij,ijco->nhwo",
                sliding_window_view(X, (3, 3), axis=(1, 2)),
                self.w1,
            )
            + self.b1,
        )
        p1 = c1[:, :26, :26, :].reshape(-1, 13, 2, 13, 2, 32).max(axis=(2, 4))
        c2 = np.maximum(
            0.0,
            np.einsum(
                "nhwcij,ijco->nhwo",
                sliding_window_view(p1, (3, 3), axis=(1, 2)),
                self.w2,
            )
            + self.b2,
        )
        p2 = c2[:, :10, :10, :].reshape(-1, 5, 2, 5, 2, 64).max(axis=(2, 4))
        fl = p2.reshape(-1, 1600)
        d1 = np.maximum(0.0, fl @ self.w3 + self.b3)
        logits = d1 @ self.w4 + self.b4
        return 1.0 / (1.0 + np.exp(-logits))


class GatosPerrosPredictor(BasePredictor):

    def __init__(self, model_dir):
        super().__init__(model_dir)
        self.load_models()

    def load_models(self):
        ruta_cnn = self.model_dir / "test-1_cnn.keras"
        modelo_cnn = (
            load_model(ruta_cnn)
            if load_model is not None
            else _KerasCNNFallback(ruta_cnn)
        )

        self.models = {
            "CNN": modelo_cnn,
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
