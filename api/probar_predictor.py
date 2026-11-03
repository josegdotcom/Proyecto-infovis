"""
Prueba rápida del predictor de gatos y perros, sin levantar el servidor.

Evalúa los modelos CNN y MLP con las primeras imágenes del conjunto de test
y muestra en consola las predicciones y métricas.

Uso, desde la raíz del repositorio:
    python -m api.probar_predictor
"""

import numpy as np

from api.services.test_1 import GatosPerrosPredictor

# Cantidad de imágenes de test a evaluar
N_MUESTRAS = 10

predictor = GatosPerrosPredictor(model_dir="data/modelos")

data = np.load("data/datos/datos-test.npz")
X_muestra = data["X_test"][:N_MUESTRAS]
y_muestra = data["y_test"][:N_MUESTRAS]

resultados = predictor.evaluar(X_muestra, y_muestra)

print("\nEtiquetas reales (0 = Gato, 1 = Perro):")
print(resultados["etiquetas_reales"])

print("\nPredicciones:")
for modelo, predicciones in resultados["predicciones"].items():
    print(f"{modelo}: {predicciones}")

print("\nMétricas:")
for modelo, metricas in resultados["metricas"].items():
    print(f"\n{modelo}")
    for metrica, valor in metricas.items():
        print(f"{metrica}: {valor:.4f}")
