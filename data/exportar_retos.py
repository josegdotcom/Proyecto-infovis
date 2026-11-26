"""Genera exploracion/datos_retos.js para la hoja de resultados de la experiencia (experiencia.html).

Con los modelos guardados (los mismos que usa la API) calcula cuántos dibujos de test
aciertan la CNN y la MLP cuando los dibujos:
  - están como en los datos (en el centro),
  - se mueven 3 casillas hacia abajo y a la derecha,
  - se achican a la mitad y se ponen en la esquina de arriba a la izquierda.
También exporta el «gato promedio» y el «perro promedio»: el promedio, píxel por píxel,
de los dibujos de entrenamiento de cada clase.

Uso, desde la carpeta raíz y con el entorno activado:
    python data/exportar_retos.py
"""

import json
import sys
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from api.services.test_1 import GatosPerrosPredictor  # noqa: E402

DATOS = RAIZ / "data" / "datos" / "gatos_perros_dataset.npz"
SALIDA = RAIZ / "exploracion" / "datos_retos.js"


def mover(imgs, casillas):
    out = np.zeros_like(imgs)
    out[:, casillas:, casillas:] = imgs[:, :28 - casillas, :28 - casillas]
    return out


def chico_en_esquina(imgs):
    mitad = imgs.reshape(-1, 14, 2, 14, 2).mean(axis=(2, 4))
    out = np.zeros_like(imgs)
    out[:, 1:15, 1:15] = mitad
    return out


def main():
    d = np.load(DATOS)
    X_test, y_test = d["X_test"], d["y_test"]
    X_train, y_train = d["X_train"], d["y_train"]
    predictor = GatosPerrosPredictor(model_dir=RAIZ / "data" / "modelos")

    imgs = X_test.reshape(-1, 28, 28)
    variantes = {
        "centro": imgs,
        "movidos": mover(imgs, 3),
        "esquina": chico_en_esquina(imgs),
    }

    aciertos = {}
    for nombre, X in variantes.items():
        prob = predictor.predecir_con_confianza(X.reshape(-1, 784))
        aciertos[nombre] = {
            modelo: round(float(((np.asarray(p) >= 0.5).astype(int) == y_test).mean()), 3)
            for modelo, p in prob.items()
        }
        print(f"{nombre:8s} CNN {aciertos[nombre]['CNN']:.1%}  MLP {aciertos[nombre]['MLP']:.1%}")

    def promedio(clase):
        dibujos = X_train[y_train == clase]
        m = dibujos.mean(axis=0)
        return len(dibujos), np.round(m / m.max() * 255).astype(int).tolist()

    n_gatos, gato = promedio(0)
    n_perros, perro = promedio(1)

    datos = {
        "dibujos_test": int(len(y_test)),
        "gatos_promedio": int(n_gatos),
        "perros_promedio": int(n_perros),
        "aciertos": aciertos,
        "gato_promedio": gato,
        "perro_promedio": perro,
    }
    SALIDA.write_text(
        "// Generado por data/exportar_retos.py. No editar a mano.\n"
        f"const DATOS_RETOS = {json.dumps(datos, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    print(f"Guardado en {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
