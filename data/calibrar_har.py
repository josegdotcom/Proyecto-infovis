"""
Calibra la Prueba 2 (actividades con el teléfono) y genera
data/modelos/har_normalizacion.npz.

Por qué hace falta:
    Los modelos se entrenaron con las 561 características OFICIALES de UCI HAR,
    normalizadas a [-1, 1]. El teléfono produce características "crudas" con
    api/services/sensor_har.py. Este script ajusta, para cada característica,
    la recta  oficial ≈ escala * cruda + desplazamiento  usando las señales
    crudas de UCI (Inertial Signals) pasadas por el MISMO pipeline del teléfono.

Requisitos:
    Descargar y descomprimir UCI HAR (≈60 MB):
    https://archive.ics.uci.edu/dataset/240/human+activity+recognition+using+smartphones
    (el zip contiene "UCI HAR Dataset.zip"; descomprímelo también).

Uso (desde la raíz del proyecto, con el entorno activado):
    python data/calibrar_har.py "ruta/a/UCI HAR Dataset"

Tarda varios minutos. Al final imprime la precisión de los modelos con
grabaciones de teléfono simuladas (UCI test remuestreado a ~60 Hz con ruido).
"""

import os
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

from api.services.sensor_har import (  # noqa: E402
    GRAVEDAD,
    PipelineTelefono,
    _filtrar_ruido,
    _pasa_bajos,
    rotar_a_ejes_telefono,
)

SALIDA = RAIZ / "data" / "modelos" / "har_normalizacion.npz"
NOMBRES = {1: "Caminar", 2: "Subir esc.", 3: "Bajar esc.", 4: "Sentado", 5: "De pie", 6: "Acostado"}


def cargar(uci, split):
    base = uci / split / "Inertial Signals"

    def senal(nombre):
        return np.stack(
            [np.loadtxt(base / f"{nombre}_{eje}_{split}.txt") for eje in "xyz"], axis=-1
        )

    return {
        "total": senal("total_acc"),
        "gyro": senal("body_gyro"),
        "X": np.loadtxt(uci / split / f"X_{split}.txt"),
        "y": np.loadtxt(uci / split / f"y_{split}.txt").astype(int),
        "sujeto": np.loadtxt(uci / split / f"subject_{split}.txt").astype(int),
    }


def grabaciones_continuas(d, minimo=4):
    """Agrupa ventanas consecutivas que se solapan exactamente 50 % (misma persona y actividad)."""
    corridas, actual = [], [0]
    for i in range(1, len(d["y"])):
        contigua = (
            d["y"][i] == d["y"][i - 1]
            and d["sujeto"][i] == d["sujeto"][i - 1]
            and np.allclose(d["total"][i, :64], d["total"][i - 1, 64:], atol=1e-7)
        )
        if contigua:
            actual.append(i)
        else:
            corridas.append(actual)
            actual = [i]
    corridas.append(actual)
    return [c for c in corridas if len(c) >= minimo]


def senal_continua(d, corrida, clave):
    return np.vstack([d[clave][i, :64] for i in corrida[:-1]] + [d[clave][corrida[-1]]])


def crudas_de_corrida(pipeline, d, corrida):
    """Características crudas de una grabación UCI pasada por el pipeline del teléfono (50 Hz)."""
    total = _filtrar_ruido(senal_continua(d, corrida, "total"))
    giro = _filtrar_ruido(senal_continua(d, corrida, "gyro"))
    gravedad = _pasa_bajos(total, 0.3)
    s = {"total_acc": total, "body_acc": total - gravedad, "gravedad": gravedad, "giroscopio": giro}
    return pipeline.crudas_desde_senales(s)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    uci = Path(sys.argv[1])

    t0 = time.time()
    tr, te = cargar(uci, "train"), cargar(uci, "test")
    proyecto = np.load(RAIZ / "data" / "datos" / "har_dataset.npz")
    if not np.allclose(proyecto["X_train"], tr["X"], atol=1e-6):
        raise SystemExit("har_dataset.npz no coincide con UCI HAR train: revisa la carpeta.")
    print(f"UCI HAR cargado ({time.time() - t0:.0f}s).")

    grav = (tr["total"]).mean(axis=1)
    print("Gravedad media (g) en ejes x, y, z del teléfono UCI, por actividad:")
    for k, n in NOMBRES.items():
        print(f"  {n:11s}", np.round(grav[tr["y"] == k].mean(axis=0), 2))

    # 1) Pares (cruda del pipeline, oficial) en TRAIN
    pipeline = PipelineTelefono(ruta_normalizacion=None)
    t0 = time.time()
    crudas, oficiales = [], []
    for c in grabaciones_continuas(tr):
        F = crudas_de_corrida(pipeline, tr, c)
        crudas.append(F)
        oficiales.append(tr["X"][c[: len(F)]])
    crudas, oficiales = np.vstack(crudas), np.vstack(oficiales)
    print(f"{len(crudas)} ventanas de train procesadas ({time.time() - t0:.0f}s).")

    # 2) Recta por característica (mínimos cuadrados)
    escala = np.zeros(561)
    desplazamiento = np.zeros(561)
    for j in range(561):
        x, yv = crudas[:, j], oficiales[:, j]
        if np.std(x) < 1e-12:
            escala[j], desplazamiento[j] = 0.0, float(np.mean(yv))
        else:
            escala[j], desplazamiento[j] = np.polyfit(x, yv, 1)

    from sklearn.preprocessing import StandardScaler

    escalador_cnn = StandardScaler().fit(tr["X"])
    np.savez(
        SALIDA,
        escala=escala,
        desplazamiento=desplazamiento,
        cnn_media=escalador_cnn.mean_,
        cnn_escala=escalador_cnn.scale_,
        descripcion=np.array(
            "x_norm = clip(escala * x_cruda + desplazamiento, -1, 1). Ajustado con "
            "data/calibrar_har.py sobre UCI HAR train pasado por api/services/sensor_har.py. "
            "cnn_media/cnn_escala: StandardScaler de X_train con el que se entrenó la CNN."
        ),
    )
    print(f"Guardado {SALIDA.relative_to(RAIZ)}")

    # 3) Verificación: grabaciones de teléfono simuladas a partir de UCI TEST
    from api.services.test_2 import ActividadPredictor

    pipeline = PipelineTelefono()
    predictor = ActividadPredictor()
    rng = np.random.default_rng(7)
    aciertos_v, aciertos_g, n_v = Counter(), Counter(), 0
    por_clase = {k: Counter() for k in NOMBRES}
    corridas = [c for c in grabaciones_continuas(te, minimo=6)]
    for c in corridas:
        acc50 = senal_continua(te, c, "total")[:512]  # ~10 s, como la prueba física
        gyr50 = senal_continua(te, c, "gyro")[:512]
        t50 = np.arange(len(acc50)) / 50.0
        dt = np.clip(rng.normal(1 / 60, 0.002, int(len(acc50) * 1.3)), 0.008, 0.03)
        t = np.cumsum(dt)
        t = t[t <= t50[-1]]
        interp = lambda s: np.column_stack([np.interp(t, t50, s[:, k]) for k in range(3)])  # noqa: E731
        acc = rotar_a_ejes_telefono(interp(acc50)) * GRAVEDAD + rng.normal(0, 0.05, (len(t), 3))
        gyr = np.rad2deg(rotar_a_ejes_telefono(interp(gyr50)))
        X = pipeline.caracteristicas(t * 1000.0, acc, gyr)
        pred = predictor.predict(X)
        real = te["y"][c[0]]
        n_v += len(X)
        for m, p in pred.items():
            aciertos_v[m] += sum(int(v) == real for v in p)
            voto = Counter(p).most_common(1)[0][0]
            aciertos_g[m] += int(voto == real)
            if m == "MLP":
                por_clase[real][voto == real] += 1

    n = len(corridas)
    print(f"\nTeléfono simulado, por ventana ({n_v}): "
          + " | ".join(f"{m} {aciertos_v[m] / n_v:.3f}" for m in sorted(aciertos_v)))
    print(f"Teléfono simulado, por grabación ({n}, voto): "
          + " | ".join(f"{m} {aciertos_g[m] / n:.3f}" for m in sorted(aciertos_g)))
    print("MLP por actividad:", {NOMBRES[k]: f"{v[True]}/{v[True] + v[False]}" for k, v in por_clase.items()})


if __name__ == "__main__":
    main()
