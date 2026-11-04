from abc import ABC, abstractmethod
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)
from pathlib import Path

class BasePredictor(ABC):
    def __init__(self, model_dir):
        self.model_dir = Path(model_dir)
        self.models = {}

    @abstractmethod
    def load_models(self):
        #cargar los modelos
        pass

    @abstractmethod
    def preprocess(self, data):
        #preparar los datos
        pass

    @abstractmethod
    def predict(self, data):
        #realizar prediccion
        pass

    def calcular_metricas(self, y_real, y_pred):

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

        X = self.preprocess(data)
        predicciones = self.predict(X)
        metricas = {}

        for nombre_modelo, y_pred in predicciones.items():
            metricas[nombre_modelo] = (self.calcular_metricas(y_real, y_pred))

        return {
            "etiquetas_reales": list(y_real),
            "predicciones": predicciones,
            "metricas": metricas
        }