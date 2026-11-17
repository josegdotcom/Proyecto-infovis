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

    def evaluar(self, data, etiquetas):
        X = self.preprocess(data)
        y_real = np.asarray(etiquetas, dtype=int).reshape(-1)

        if len(X) != len(y_real):
            raise ValueError(
                "La cantidad de muestras y etiquetas debe coincidir."
            )

        predicciones = self.predict(X)

        metricas = {
            nombre: {
                metrica: float(valor)
                for metrica, valor in self.calcular_metricas(y_real, pred).items()
            }
            for nombre, pred in predicciones.items()
        }

        return {
            "cantidad": len(X),
            "etiquetas_reales": y_real.tolist(),
            "predicciones": predicciones,
            "metricas": metricas,
        }

    @staticmethod
    def nombre_actividad(etiqueta):
        return ACTIVIDADES.get(
            int(etiqueta),
            f"Clase {etiqueta}"
        )


_predictores = {}


def obtener_predictor(model_dir=None):
    """Carga los modelos una sola vez por carpeta y los reutiliza."""
    clave = str(model_dir or ROOT_DIR / "data" / "modelos")

    if clave not in _predictores:
        _predictores[clave] = ActividadPredictor(model_dir=clave)

    return _predictores[clave]


def votacion_mayoritaria(predictor, predicciones):
    """Resume las predicciones por ventana en una sola actividad por modelo."""
    resultados = {}

    for modelo, valores in predicciones.items():
        conteo = Counter(int(v) for v in valores)
        etiqueta, votos = conteo.most_common(1)[0]
        total = len(valores)

        resultados[modelo] = {
            "etiqueta": etiqueta,
            "actividad": predictor.nombre_actividad(etiqueta),
            "votos": votos,
            "total": total,
            "porcentaje": 100.0 * votos / total,
        }

    return resultados


def procesar_test_2(datos, model_dir=None, sampling_rate=50):
    """
    Endpoint /api/test_2: recibe acelerómetro y giroscopio del teléfono
    (listas de {x, y, z}) y la etiqueta real (1-6), predice con CNN y MLP
    y evalúa contra la etiqueta.
    """
    if not isinstance(datos, dict):
        raise ValueError("El cuerpo de la solicitud debe ser un objeto JSON.")

    acelerometro = datos.get("accelerometer")
    giroscopio = datos.get("gyroscope")
    etiqueta_real = datos.get("etiqueta_real")

    if acelerometro is None or giroscopio is None:
        raise ValueError("Se requieren los datos de accelerometer y gyroscope.")

    if etiqueta_real is None:
        raise ValueError("Se requiere la etiqueta real de la actividad.")

    try:
        etiqueta_real = int(etiqueta_real)
    except (TypeError, ValueError):
        raise ValueError("La etiqueta real debe ser un entero entre 1 y 6.")

    if etiqueta_real not in ACTIVIDADES:
        raise ValueError("La etiqueta real debe estar entre 1 y 6.")

    if not isinstance(acelerometro, list) or not isinstance(giroscopio, list):
        raise ValueError("Los sensores deben enviarse como listas de muestras.")

    if len(acelerometro) == 0 or len(giroscopio) == 0:
        raise ValueError("No hay datos del acelerómetro o del giroscopio.")

    if len(acelerometro) != len(giroscopio):
        raise ValueError(
            "Acelerómetro y giroscopio deben tener la misma cantidad de muestras."
        )

    def convertir_sensor(nombre, muestras):
        valores = []

        for i, muestra in enumerate(muestras):
            if not isinstance(muestra, dict):
                raise ValueError(f"{nombre}[{i}] no es un objeto válido.")
            try:
                valores.append([
                    float(muestra["x"]),
                    float(muestra["y"]),
                    float(muestra["z"]),
                ])
            except (KeyError, TypeError, ValueError):
                raise ValueError(f"{nombre}[{i}] debe contener (x, y, z).")

        array = np.asarray(valores, dtype=np.float64)

        if not np.isfinite(array).all():
            raise ValueError(f"{nombre} contiene valores NaN o infinitos.")

        return array

    acc = convertir_sensor("accelerometer", acelerometro)
    gyro = convertir_sensor("gyroscope", giroscopio)

    converter = HARConverter(sampling_rate=sampling_rate)
    features = converter.transformar(acc, gyro)

    if features.ndim != 2 or features.shape[1] != 561:
        raise ValueError(
            f"El conversor produjo una forma inesperada: {features.shape}."
        )

    predictor = obtener_predictor(model_dir)
    resultados = predictor.evaluar(features, [etiqueta_real] * len(features))

    actividades = {
        modelo: [predictor.nombre_actividad(p) for p in preds]
        for modelo, preds in resultados["predicciones"].items()
    }

    return {
        "muestras": len(acc),
        "sampling_rate": sampling_rate,
        "ventanas": len(features),
        "caracteristicas": int(features.shape[1]),
        "etiqueta_real": etiqueta_real,
        "actividad_real": ACTIVIDADES[etiqueta_real],
        "predicciones": resultados["predicciones"],
        "actividades": actividades,
        "resultado_final": votacion_mayoritaria(
            predictor, resultados["predicciones"]
        ),
        "metricas": resultados["metricas"],
    }


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
