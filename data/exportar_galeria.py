"""
Exporta los resultados de las dos pruebas a un solo archivo JS para la
galeria de graficos (exploracion/index.html).

Las matrices de confusion y el historial por epoca de la CNN no se guardan
en resultados/, asi que se leen desde las salidas de los notebooks.

Ejecutar desde la carpeta data/:
    python exportar_galeria.py
"""

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

ACTIVIDADES = ["Camina", "Sube", "Baja", "Sentado", "Parado", "Acostado"]


def salidas_notebook(ruta):
    """Devuelve el texto de salida de cada celda de codigo del notebook."""
    notebook = json.loads(Path(ruta).read_text(encoding="utf-8"))
    textos = []

    for celda in notebook["cells"]:
        texto = ""
        for salida in celda.get("outputs", []):
            texto += "".join(salida.get("text", []))
        textos.append(texto)

    return textos


def leer_matrices(salidas):
    """Busca las matrices impresas como 'Matriz de confusión CNN:\n[[..]]'."""
    matrices = {}

    for texto in salidas:
        for modelo, cuerpo in re.findall(r"Matriz de confusi.n (\w+):\s*(\[\[.*?\]\])", texto, re.S):
            filas = re.findall(r"\[([\d\s]+)\]", cuerpo)
            matrices[modelo] = [[int(n) for n in fila.split()] for fila in filas]

    return matrices


def leer_epocas(salidas):
    """Historial de Keras: accuracy y val_accuracy por epoca."""
    patron = r"accuracy: ([\d.]+) - loss: ([\d.]+) - val_accuracy: ([\d.]+) - val_loss: ([\d.]+)"

    for texto in salidas:
        if "Epoch 1/" in texto:
            filas = re.findall(patron, texto)
            return {
                "entrenamiento": [float(f[0]) for f in filas],
                "validacion": [float(f[2]) for f in filas],
            }

    return None


def generales(ruta):
    tabla = pd.read_csv(ruta)
    columnas = ["accuracy", "precision", "recall", "f1_score",
                "tiempo_entrenamiento_s", "tiempo_prediccion_s"]
    return {fila["modelo"]: {c: float(fila[c]) for c in columnas} for _, fila in tabla.iterrows()}


# ---------------------------------------------------------------
# Prueba 1: dibujos de gatos y perros
# ---------------------------------------------------------------

salidas_1 = salidas_notebook("Prueba_1.ipynb")
npz = np.load("resultados/resultados_individuales_1.npz")

reales_1 = npz["etiquetas_reales"].tolist()
prob_perro = npz["probabilidades_CNN"]

prueba_1 = {
    "nombre": "Prueba 1 · Dibujos",
    "descripcion": "Gato o perro en dibujos de Quick, Draw! (2.999 dibujos de test)",
    "azar": 0.5,
    "clases": ["Gato", "Perro"],
    "generales": generales("resultados/resultados_generales_1.csv"),
    "matrices": leer_matrices(salidas_1),
    "epocas_cnn": leer_epocas(salidas_1),
    "individuales": {
        "real": reales_1,
        "CNN": npz["predicciones_CNN"].tolist(),
        "MLP": npz["predicciones_MLP"].tolist(),
        # La CNN entrega P(perro); la confianza es la probabilidad de la clase que eligio
        "confianza_CNN": np.maximum(prob_perro, 1 - prob_perro).tolist(),
        "tiempo_CNN": npz["tiempos_CNN"].tolist(),
        "tiempo_MLP": npz["tiempos_MLP"].tolist(),
        "imagenes": [img.astype(int).ravel().tolist() for img in npz["imagenes"]],
    },
}

# ---------------------------------------------------------------
# Prueba 2: actividad humana con sensores del celular (HAR)
# ---------------------------------------------------------------

salidas_2 = salidas_notebook("Prueba_2.ipynb")
ind = pd.read_csv("resultados/resultados_individuales_2.csv")

# Las 561 variables de cada caso individual (ya vienen entre -1 y 1)
senales = np.load("datos/har_dataset_individual.npz")["X_individual"]

prueba_2 = {
    "nombre": "Prueba 2 · Actividad",
    "descripcion": "Actividad física a partir de sensores del celular (2.947 muestras de test)",
    "azar": 1 / 6,
    "clases": ACTIVIDADES,
    "generales": generales("resultados/resultados_generales_2.csv"),
    "matrices": leer_matrices(salidas_2),
    "epocas_cnn": leer_epocas(salidas_2),
    "individuales": {
        # Las etiquetas del dataset van de 1 a 6
        "real": (ind["etiqueta_real"] - 1).tolist(),
        "CNN": (ind["prediccion_CNN"] - 1).tolist(),
        "MLP": (ind["prediccion_MLP"] - 1).tolist(),
        "confianza_CNN": ind["confianza_CNN"].tolist(),
        "tiempo_CNN": ind["tiempo_prediccion_CNN_s"].tolist(),
        "tiempo_MLP": ind["tiempo_prediccion_MLP_s"].tolist(),
        "senales": np.round(senales.astype(float), 2).tolist(),
    },
}

ruta = Path("../exploracion/datos.js")
ruta.parent.mkdir(exist_ok=True)
ruta.write_text(
    "// Generado por data/exportar_galeria.py. No editar a mano.\n"
    "const DATOS = " + json.dumps({"p1": prueba_1, "p2": prueba_2}, separators=(",", ":"), ensure_ascii=False) + ";\n",
    encoding="utf-8",
)

print(f"Archivo guardado en: {ruta}")
