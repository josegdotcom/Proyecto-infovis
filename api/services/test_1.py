"""
Predictor de la Prueba 1: clasificación de dibujos de gatos y perros.

Carga los dos modelos entrenados en data/Prueba_1.ipynb:
    - CNN: data/modelos/test-1_cnn.keras  (Keras)
    - MLP: data/modelos/test-1_mlp.joblib (scikit-learn)

Entrada: imágenes de 28 x 28 píxeles en escala de grises (784 valores),
con el trazo en valores altos y el fondo en 0, como en Quick, Draw!.
Salida: 0 = Gato, 1 = Perro.
"""

import re
import struct
import zipfile

import joblib
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

# TensorFlow es opcional: si no está instalado se usa _KerasCNNFallback
try:
    from tensorflow.keras.models import load_model
except ModuleNotFoundError:
    load_model = None

from api.models.base_predictor import BasePredictor


class _KerasCNNFallback:
    """
    Ejecuta la inferencia exacta de test-1_cnn.keras usando NumPy cuando
    TensorFlow no está instalado.

    Arquitectura replicada (debe coincidir con la del notebook):
        Conv2D(32, 3x3, ReLU) -> MaxPool(2x2)
        Conv2D(64, 3x3, ReLU) -> MaxPool(2x2)
        Flatten (5*5*64 = 1600) -> Dense(128, ReLU) -> Dense(1, sigmoide)
    """

    def __init__(self, keras_path):
        # Un .keras es un zip; los pesos están en model.weights.h5 (HDF5)
        with zipfile.ZipFile(keras_path, "r") as z:
            raw = z.read("model.weights.h5")

        # Cada dataset HDF5 contiguo de float32 tiene un mensaje de layout
        # que empieza con esta firma, seguida de (offset, tamaño) en bytes.
        # Así se leen los pesos sin depender de h5py.
        pat = b"\x00\x00\x03\x01"
        bloques = [
            struct.unpack("<QQ", raw[m.end() : m.end() + 16])
            for m in re.finditer(re.escape(pat), raw)
        ]

        def leer_tensor(indice, shape):
            """Lee el tensor número `indice` del archivo con la forma dada."""
            offset, size = bloques[indice]
            return np.frombuffer(
                raw, dtype=np.float32, count=size // 4, offset=offset
            ).reshape(shape)

        # Pesos (kernel) y sesgos (bias) de cada capa, en orden
        self.w1 = leer_tensor(0, (3, 3, 1, 32))
        self.b1 = leer_tensor(1, (32,))
        self.w2 = leer_tensor(2, (3, 3, 32, 64))
        self.b2 = leer_tensor(3, (64,))
        self.w3 = leer_tensor(4, (1600, 128))
        self.b3 = leer_tensor(5, (128,))
        self.w4 = leer_tensor(6, (128, 1))
        self.b4 = leer_tensor(7, (1,))

    def predict(self, X_cnn, verbose=0):
        """
        Devuelve la probabilidad de "Perro" con forma (n, 1), igual que
        model.predict de Keras. `verbose` se ignora (compatibilidad).
        """
        X = np.asarray(X_cnn, dtype=np.float32)

        # Conv 1: 28x28x1 -> 26x26x32 (ventanas 3x3 sin relleno)
        c1 = np.maximum(
            0.0,
            np.einsum(
                "nhwcij,ijco->nhwo",
                sliding_window_view(X, (3, 3), axis=(1, 2)),
                self.w1,
            )
            + self.b1,
        )
        # MaxPool 2x2: 26x26 -> 13x13
        p1 = c1[:, :26, :26, :].reshape(-1, 13, 2, 13, 2, 32).max(axis=(2, 4))

        # Conv 2: 13x13x32 -> 11x11x64
        c2 = np.maximum(
            0.0,
            np.einsum(
                "nhwcij,ijco->nhwo",
                sliding_window_view(p1, (3, 3), axis=(1, 2)),
                self.w2,
            )
            + self.b2,
        )
        # MaxPool 2x2: 11x11 -> 5x5 (se descarta la última fila/columna)
        p2 = c2[:, :10, :10, :].reshape(-1, 5, 2, 5, 2, 64).max(axis=(2, 4))

        # Capas densas
        fl = p2.reshape(-1, 1600)
        d1 = np.maximum(0.0, fl @ self.w3 + self.b3)
        logits = d1 @ self.w4 + self.b4
        return 1.0 / (1.0 + np.exp(-logits))


class GatosPerrosPredictor(BasePredictor):
    """Predictor con los modelos CNN y MLP de la Prueba 1."""

    def __init__(self, model_dir):
        super().__init__(model_dir)
        self.load_models()

    def load_models(self):
        """Carga la CNN (Keras o fallback NumPy) y el MLP (joblib)."""
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
        """Convierte a float32 y escala a [0, 1] si viene en 0-255."""
        X = np.asarray(data, dtype=np.float32)

        # Los modelos se entrenaron con píxeles en [0, 1]
        if X.max() > 1:
            X = X / 255.0

        return X

    def predict(self, data):
        """Devuelve la clase predicha (0/1) por cada modelo e imagen."""
        # Cada arquitectura espera una forma distinta
        X_cnn = data.reshape(-1, 28, 28, 1)
        X_mlp = data.reshape(-1, 784)

        prob_cnn = self.models["CNN"].predict(
            X_cnn,
            verbose=0
        )

        # La CNN entrega probabilidades: se corta en 0,5
        pred_cnn = (prob_cnn >= 0.5).astype(int).flatten()

        pred_mlp = self.models["MLP"].predict(X_mlp)

        return {
            "CNN": pred_cnn.tolist(),
            "MLP": pred_mlp.tolist()
        }

    def predecir_con_confianza(self, data):
        """
        Devuelve la probabilidad de "Perro" (clase 1) de cada modelo para
        cada imagen. A diferencia de predict, aplica el preprocesado.
        """
        X = self.preprocess(data)

        prob_cnn = self.models["CNN"].predict(
            X.reshape(-1, 28, 28, 1),
            verbose=0
        ).flatten()

        prob_mlp = self.models["MLP"].predict_proba(
            X.reshape(-1, 784)
        )[:, 1]

        return {
            "CNN": prob_cnn.tolist(),
            "MLP": prob_mlp.tolist()
        }
