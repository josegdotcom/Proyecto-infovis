"""
Exporta las 10 imagenes del experimento individual a JSON para la pagina web.

Las etiquetas reales no se guardaron en el notebook, pero se reconstruyen
repitiendo la misma seleccion aleatoria de prueba_1.ipynb:
X = [10.000 gatos, 10.000 perros] -> indice >= 10.000 es perro.

Ejecutar desde la carpeta data/:
    python exportar_web.py
"""

import json
from pathlib import Path

import numpy as np

N_PER_CLASS = 10_000
N_SOBRANTES = 10

imagenes = np.load("resultados/experimento_individual_imagenes.npz")["imagenes"]

# El npz repite las mismas 10 imagenes una vez por modelo
imagenes = imagenes[:N_SOBRANTES]

rng = np.random.default_rng(42)
indices_sobrantes = rng.choice(2 * N_PER_CLASS, size=N_SOBRANTES, replace=False)
etiquetas_reales = (indices_sobrantes >= N_PER_CLASS).astype(int)

salida = {
    "etiquetas": {"0": "gato", "1": "perro", "-1": "ruido"},
    "etiquetas_reales": etiquetas_reales.tolist(),
    "imagenes": [img.astype(int).tolist() for img in imagenes],
}

ruta = Path("resultados/dibujos.json")
ruta.write_text(json.dumps(salida, separators=(",", ":")), encoding="utf-8")

print(f"Etiquetas reales: {etiquetas_reales.tolist()}")
print(f"Archivo guardado en: {ruta}")
