from pathlib import Path
import numpy as np

from .test_2 import ActividadPredictor

ROOT_DIR = Path(__file__).resolve().parents[2]

MODEL_DIR = ROOT_DIR / "data" / "modelos"
DATA_FILE = ROOT_DIR / "data" / "datos" / "har_dataset_individual.npz"

ACTIVIDADES = {
    1: "Walking",
    2: "Walking Upstairs",
    3: "Walking Downstairs",
    4: "Sitting",
    5: "Standing",
    6: "Laying",
}

def cargar_datos():

    print("Cargando datos...")

    datos = np.load(DATA_FILE)

    print("Archivos dentro del .npz:")

    for nombre in datos.files:
        print(f"  - {nombre}")

    if "X_individual" in datos:
        X = datos["X_individual"]
    elif "X" in datos:
        X = datos["X"]
    else:
        raise KeyError(
            "No se encontro X_individual ni X dentro del archivo .npz"
        )

    if "y_individual" in datos:
        y = datos["y_individual"]
    elif "y" in datos:
        y = datos["y"]
    else:
        raise KeyError(
            "No se encontro y_individual ni y dentro del archivo .npz"
        )

    return X, y

def main():

    print("=" * 60)
    print("PRUEBA LOCAL - TEST 2 UCI HAR")
    print("=" * 60)

    print()
    print(f"Proyecto : {ROOT_DIR}")
    print(f"Modelos  : {MODEL_DIR}")
    print(f"Datos    : {DATA_FILE}")

    if not MODEL_DIR.exists():
        raise FileNotFoundError(
            f"No existe la carpeta de modelos:\n{MODEL_DIR}"
        )

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"No existe el archivo de datos:\n{DATA_FILE}"
        )

    print()
    print("Cargando datos...")

    X, y = cargar_datos()

    print()
    print(f"Forma de X: {X.shape}")
    print(f"Forma de y: {y.shape}")

    if X.ndim != 2:
        raise ValueError(
            f"X deberia tener 2 dimensiones, pero tiene {X.ndim}"
        )

    if X.shape[1] != 561:
        raise ValueError(
            f"Se esperaban 561 características, "
            f"pero X tiene {X.shape[1]}"
        )

    if len(X) != len(y):
        raise ValueError(
            "La cantidad de muestras de X y y no coincide."
        )

    print()
    print("Los datos tienen 561 caracteristicas.")
    print(f"Cantidad de muestras: {len(X)}")

    print()
    print("Cargando modelos...")

    predictor = ActividadPredictor(model_dir=MODEL_DIR)

    print("CNN cargada.")
    print("MLP cargado.")

    print()
    print("Informacion de los modelos:")

    print(f"  CNN input : {predictor.models['CNN'].input_shape}")
    print(f"  CNN output: {predictor.models['CNN'].output_shape}")
    print(
        f"  MLP input : "
        f"{getattr(predictor.models['MLP'], 'n_features_in_', 'desconocido')}"
    )
    print(
        f"  MLP output: "
        f"{getattr(predictor.models['MLP'], 'n_outputs_', 'desconocido')}"
    )

    print()
    print("Realizando predicciones...")
    print()

    resultados = predictor.evaluar(X, y)

    predicciones = resultados["predicciones"]
    metricas = resultados["metricas"]

    print("=" * 60)
    print("PREDICCIONES")
    print("=" * 60)

    for i in range(len(y)):

        real = int(y[i])

        pred_cnn = int(predicciones["CNN"][i])
        pred_mlp = int(predicciones["MLP"][i])

        nombre_real = ACTIVIDADES.get(
            real,
            f"Clase {real}"
        )

        nombre_cnn = ACTIVIDADES.get(
            pred_cnn,
            f"Clase {pred_cnn}"
        )

        nombre_mlp = ACTIVIDADES.get(
            pred_mlp,
            f"Clase {pred_mlp}"
        )

        print()
        print(f"Muestra {i + 1}")
        print(f"  Real : {real} - {nombre_real}")
        print(f"  CNN  : {pred_cnn} - {nombre_cnn}")
        print(f"  MLP  : {pred_mlp} - {nombre_mlp}")

    print()
    print("=" * 60)
    print("MÉTRICAS")
    print("=" * 60)

    for modelo, valores in metricas.items():

        print()
        print(modelo)

        print(
            f"  Accuracy : {valores['accuracy']:.4f}"
        )

        print(
            f"  Precision: {valores['precision']:.4f}"
        )

        print(
            f"  Recall   : {valores['recall']:.4f}"
        )

        print(
            f"  F1-Score : {valores['f1_score']:.4f}"
        )

if __name__ == "__main__":
    main()