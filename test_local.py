import numpy as np
from api.services.test_1 import GatosPerrosPredictor

predictor = GatosPerrosPredictor(model_dir="data/modelos")

data = np.load("data/datos/datos-test.npz")

X_test = data["X_test"]
y_test = data["y_test"]

X_muestra = X_test[:10]
y_muestra = y_test[:10]

resultados = predictor.evaluar(
    X_muestra,
    y_muestra
)


print("\nEtiquetas reales:")
print(resultados["etiquetas_reales"])

print("\nPredicciones:")
for modelo, predicciones in resultados["predicciones"].items():
    print(f"{modelo}: {predicciones}")

print("\nMetricas:")
for modelo, metricas in resultados["metricas"].items():
    print(f"\n{modelo}")
    for metrica, valor in metricas.items():
        print(f"{metrica}: {valor:.4f}")
