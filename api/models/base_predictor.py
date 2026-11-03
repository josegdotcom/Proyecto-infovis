"""
Clase base común para los predictores de cada prueba.

Cada prueba (gatos y perros, actividades humanas, ...) hereda de
BasePredictor e implementa cómo cargar sus modelos, preparar los datos y
predecir. La evaluación y el cálculo de métricas son compartidos.
"""

from abc import ABC, abstractmethod
from pathlib import Path

from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
)


class BasePredictor(ABC):
    """Interfaz de un predictor con varios modelos que se comparan entre sí."""

    def __init__(self, model_dir):
        # Carpeta donde están los archivos de los modelos entrenados
        self.model_dir = Path(model_dir)
        # Nombre del modelo -> objeto del modelo; lo llena load_models()
        self.models = {}

    @abstractmethod
    def load_models(self):
        """Carga los modelos en self.models."""

    @abstractmethod
    def preprocess(self, data):
        """Convierte los datos crudos al formato que esperan los modelos."""

    @abstractmethod
    def predict(self, data):
        """Devuelve {modelo: [predicciones]} para datos ya preprocesados."""

    def calcular_metricas(self, y_real, y_pred):
        """
        Calcula accuracy, precision, recall y F1 de unas predicciones.

        Precision, recall y F1 se ponderan por clase ("weighted") y valen 0
        cuando una clase no tiene predicciones, en vez de lanzar un aviso.
        """
        return {
            "accuracy": accuracy_score(y_real, y_pred),
            "precision": precision_score(
                y_real,
                y_pred,
                average="weighted",
                zero_division=0
            ),
            "recall": recall_score(
                y_real,
                y_pred,
                average="weighted",
                zero_division=0
            ),
            "f1_score": f1_score(
                y_real,
                y_pred,
                average="weighted",
                zero_division=0
            )
        }

    def evaluar(self, data, y_real):
        """
        Preprocesa los datos, predice con todos los modelos y calcula las
        métricas de cada uno frente a las etiquetas reales.
        """
        X = self.preprocess(data)
        predicciones = self.predict(X)
        metricas = {}

        for nombre_modelo, y_pred in predicciones.items():
            metricas[nombre_modelo] = self.calcular_metricas(y_real, y_pred)

        return {
            "etiquetas_reales": list(y_real),
            "predicciones": predicciones,
            "metricas": metricas
        }
