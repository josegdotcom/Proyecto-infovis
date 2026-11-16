from pathlib import Path
import sys
from collections import Counter

import joblib
import numpy as np
from tensorflow.keras.models import load_model

# Permite ejecutar:
#   python api/services/test_2.py
# desde la raíz del proyecto.
ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.models.base_predictor import BasePredictor
from api.services.uci_har_recovery import HARConverter


ACTIVIDADES = {
    1: "Walking",
    2: "Walking Upstairs",
    3: "Walking Downstairs",
    4: "Sitting",
    5: "Standing",
    6: "Laying",
}


class ActividadPredictor(BasePredictor):
    """Predictor para UCI HAR usando 561 características."""

    def __init__(self, model_dir=None):
        if model_dir is None:
            model_dir = ROOT_DIR / "data" / "modelos"

        super().__init__(Path(model_dir))

        # BasePredictor no carga los modelos automáticamente.
        self.load_models()

    def load_models(self):
        cnn_path = self.model_dir / "test-2_cnn.keras"
        mlp_path = self.model_dir / "test-2_mlp.joblib"

        faltantes = [
            str(p)
            for p in (cnn_path, mlp_path)
            if not p.is_file()
        ]

        if faltantes:
            raise FileNotFoundError(
                "No se encontraron los modelos de la prueba 2: "
                + ", ".join(faltantes)
            )

        self.models = {
            "CNN": load_model(cnn_path),
            "MLP": joblib.load(mlp_path),
        }

    def preprocess(self, data):
        X = np.asarray(data, dtype=np.float32)

        if X.ndim == 1:
            X = X.reshape(1, -1)

        if X.ndim != 2 or X.shape[1] != 561:
            raise ValueError(
                "Se esperaba una matriz de forma (n, 561); "
                f"se recibió {X.shape}."
            )

        if not np.isfinite(X).all():
            raise ValueError(
                "Los datos contienen valores NaN o infinitos."
            )

        return X

    @staticmethod
    def _adaptar_entrada_cnn(model, X):
        """Adapta las 561 variables a la forma de entrada de Keras."""
        input_shape = model.input_shape

        if isinstance(input_shape, list):
            if len(input_shape) != 1:
                raise ValueError(
                    "La CNN tiene múltiples entradas y no es compatible."
                )
            input_shape = input_shape[0]

        if len(input_shape) == 2 and input_shape[-1] == 561:
            return X

        if len(input_shape) == 3 and input_shape[1:] == (561, 1):
            return X.reshape(-1, 561, 1)

        if len(input_shape) == 4 and input_shape[1:] == (561, 1, 1):
            return X.reshape(-1, 561, 1, 1)

        raise ValueError(
            f"Forma de entrada CNN no reconocida: {input_shape}."
        )

    def predict(self, data):
        X = self.preprocess(data)

        # CNN
        cnn_input = self._adaptar_entrada_cnn(
            self.models["CNN"],
            X
        )

        cnn_output = np.asarray(
            self.models["CNN"].predict(
                cnn_input,
                verbose=0
            )
        )

        if cnn_output.ndim == 1:
            pred_cnn = np.rint(
                cnn_output
            ).astype(int)

        elif cnn_output.shape[-1] == 1:
            pred_cnn = np.rint(
                cnn_output.reshape(-1)
            ).astype(int)

        else:
            pred_cnn = np.argmax(
                cnn_output,
                axis=1
            ) + 1

        # MLP
        pred_mlp = np.asarray(
            self.models["MLP"].predict(X)
        ).reshape(-1).astype(int)

        return {
            "CNN": pred_cnn.tolist(),
            "MLP": pred_mlp.tolist(),
        }

    @staticmethod
    def nombre_actividad(etiqueta):
        return ACTIVIDADES.get(
            int(etiqueta),
            f"Clase {etiqueta}"
        )


def predecir_csv(ruta_csv):
    """
    Flujo completo:

        CSV
         ↓
        HARConverter
         ↓
        (N, 561)
         ↓
        CNN + MLP
         ↓
        predicciones
    """
    converter = HARConverter(sampling_rate=50)

    print("\n[1/3] Convirtiendo CSV a características UCI HAR...")

    features = converter.transformar_csv(ruta_csv)

    print(
        f"      Características generadas: {features.shape}"
    )

    predictor = ActividadPredictor()

    print("[2/3] Ejecutando modelos...")

    predicciones = predictor.predict(features)

    print("[3/3] Resultados por ventana:\n")

    for i in range(len(features)):
        print(f"Ventana {i + 1}:")

        for modelo, valores in predicciones.items():
            etiqueta = valores[i]
            actividad = predictor.nombre_actividad(etiqueta)

            print(
                f"  {modelo}: {etiqueta} -> {actividad}"
            )

        print()

    # La predicción final representa todo el registro, no una sola ventana.
    # Se usa votación mayoritaria entre las ventanas de 2.56 s.
    resultados_finales = {}

    for modelo, valores in predicciones.items():
        conteo = Counter(int(v) for v in valores)
        etiqueta_final, votos = conteo.most_common(1)[0]
        total = len(valores)

        resultados_finales[modelo] = {
            "etiqueta": etiqueta_final,
            "actividad": predictor.nombre_actividad(etiqueta_final),
            "votos": votos,
            "total": total,
            "porcentaje": 100.0 * votos / total,
        }

    print("=" * 55)
    print("PREDICCIÓN FINAL DEL REGISTRO")
    print("=" * 55)

    for modelo, resultado in resultados_finales.items():
        print(f"\n{modelo}:")
        print(f"  Actividad: {resultado['actividad']}")
        print(f"  Votos: {resultado['votos']}/{resultado['total']}")
        print(f"  Consistencia: {resultado['porcentaje']:.1f}%")

    print()

    return features, predicciones, resultados_finales


def main():
    if len(sys.argv) >= 2:
        ruta_csv = Path(sys.argv[1])
    else:
        ruta_csv = Path(
            input("Ruta del CSV a predecir: ").strip()
        )

    if not ruta_csv.is_file():
        print(
            f"\nError: no existe el archivo:\n{ruta_csv}"
        )
        sys.exit(1)

    try:
        predecir_csv(ruta_csv)

    except Exception as error:
        print(
            "\nERROR durante la predicción:"
        )
        print(f"  {type(error).__name__}: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
