"""Reentrena la MLP de la Prueba 1 (gatos y perros) y la guarda en data/modelos/test-1_mlp.joblib.

El archivo anterior respondía «Perro» para todos los dibujos de test (50 % de aciertos).
Esta MLP usa los mismos datos de Quick, Draw! (data/datos/gatos_perros_dataset.npz), con
píxeles entre 0 y 1, igual que la API (api/services/test_1.py).

Uso, desde la carpeta raíz y con el entorno activado:
    python data/reentrenar_mlp_dibujos.py

Después conviene regenerar los datos de la experiencia (experiencia.html):
    python data/exportar_retos.py
"""

import time
import warnings
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.neural_network import MLPClassifier

RAIZ = Path(__file__).resolve().parent
DATOS = RAIZ / "datos" / "gatos_perros_dataset.npz"
SALIDA = RAIZ / "modelos" / "test-1_mlp.joblib"


def main():
    d = np.load(DATOS)
    X_train, y_train = d["X_train"], d["y_train"]
    X_test, y_test = d["X_test"], d["y_test"]

    modelo = MLPClassifier(hidden_layer_sizes=(64,), max_iter=30, random_state=42)
    inicio = time.perf_counter()
    with warnings.catch_warnings():
        # 30 épocas bastan; sklearn avisa que no llegó a converger del todo
        warnings.simplefilter("ignore")
        modelo.fit(X_train, y_train)
    segundos = time.perf_counter() - inicio

    pred = modelo.predict(X_test)
    print(f"Entrenamiento: {segundos:.1f} s")
    print(f"Aciertos en test: {accuracy_score(y_test, pred):.1%}")
    print("Matriz de confusión (filas = real Gato/Perro):")
    print(confusion_matrix(y_test, pred))

    joblib.dump(modelo, SALIDA)
    print(f"Guardado en {SALIDA.relative_to(RAIZ.parent)}")


if __name__ == "__main__":
    main()
