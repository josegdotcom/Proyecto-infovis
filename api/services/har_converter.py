import numpy as np

from scipy.signal import butter, filtfilt
from scipy.stats import skew, kurtosis


class HARConverter:
    """
    Conversor de señales de sensores para UCI HAR.

    Entrada del teléfono:
        acelerómetro: m/s²
        giroscopio:   grados/s

    El acelerómetro debe ser aceleración total,
    incluyendo gravedad.

    Conversión:
        acelerómetro -> g
        giroscopio   -> rad/s

    Procesamiento:
        - ventanas de 128 muestras
        - 50% de solapamiento
        - separación gravedad / aceleración corporal
        - jerk
        - magnitudes
        - características temporales
        - FFT
        - características frecuenciales
        - ángulos

    Salida:
        (numero_de_ventanas, 561)
    """

    GRAVITY = 9.80665

    WINDOW_SIZE = 128
    WINDOW_STEP = 64

    def __init__(self, sampling_rate=50):
        if sampling_rate != 50:
            raise ValueError(
                "UCI HAR utiliza una frecuencia de muestreo de 50 Hz."
            )

        self.sampling_rate = sampling_rate

    # ==========================================================
    # CONVERSIÓN DE UNIDADES
    # ==========================================================

    def convertir_acelerometro(self, acelerometro):
        acelerometro = np.asarray(
            acelerometro,
            dtype=np.float64
        )

        self._validar_sensores(
            acelerometro,
            "acelerómetro"
        )

        # m/s² -> g
        return acelerometro / self.GRAVITY

    def convertir_giroscopio(self, giroscopio):
        giroscopio = np.asarray(
            giroscopio,
            dtype=np.float64
        )

        self._validar_sensores(
            giroscopio,
            "giroscopio"
        )

        # grados/s -> rad/s
        return np.deg2rad(giroscopio)

    def convertir(self, acelerometro, giroscopio):
        acelerometro = self.convertir_acelerometro(
            acelerometro
        )

        giroscopio = self.convertir_giroscopio(
            giroscopio
        )

        if len(acelerometro) != len(giroscopio):
            raise ValueError(
                "El acelerómetro y el giroscopio "
                "deben tener la misma cantidad de muestras."
            )

        return {
            "accelerometer": acelerometro,
            "gyroscope": giroscopio
        }

    # ==========================================================
    # PROCESAMIENTO DEL TELÉFONO
    # ==========================================================

    def transformar(self, acelerometro, giroscopio):
        """
        Procesa las señales del teléfono.

        Entrada:
            acelerómetro en m/s²
            giroscopio en grados/s

        Devuelve:
            matriz (N, 561)
        """

        datos = self.convertir(
            acelerometro,
            giroscopio
        )

        acc = datos["accelerometer"]
        gyro = datos["gyroscope"]

        if len(acc) < self.WINDOW_SIZE:
            raise ValueError(
                f"Se necesitan al menos {self.WINDOW_SIZE} "
                "muestras para crear una ventana UCI HAR."
            )

        ventanas = []

        for inicio in range(
            0,
            len(acc) - self.WINDOW_SIZE + 1,
            self.WINDOW_STEP
        ):
            fin = inicio + self.WINDOW_SIZE

            acc_window = acc[inicio:fin]
            gyro_window = gyro[inicio:fin]

            features = self._extraer_ventana(
                acc_window,
                gyro_window
            )

            if len(features) != 561:
                raise RuntimeError(
                    f"El extractor produjo {len(features)} "
                    "características en lugar de 561."
                )

            ventanas.append(features)

        if not ventanas:
            raise ValueError(
                "No se pudo crear ninguna ventana."
            )

        return np.asarray(
            ventanas,
            dtype=np.float64
        )

    # ==========================================================
    # PROCESAMIENTO DIRECTO UCI
    # ==========================================================

    def transformar_uci(
        self,
        total_acc,
        body_acc,
        giroscopio
    ):
        """
        Procesa una ventana UCI HAR ya preprocesada.

        Entrada UCI:
            total_acc : g
            body_acc  : g
            giroscopio: rad/s

        No vuelve a convertir unidades.
        No vuelve a separar gravedad mediante filtro.

        Devuelve:
            (1, 561)
        """

        total_acc = np.asarray(
            total_acc,
            dtype=np.float64
        )

        body_acc = np.asarray(
            body_acc,
            dtype=np.float64
        )

        giroscopio = np.asarray(
            giroscopio,
            dtype=np.float64
        )

        self._validar_sensores(
            total_acc,
            "total_acc UCI"
        )

        self._validar_sensores(
            body_acc,
            "body_acc UCI"
        )

        self._validar_sensores(
            giroscopio,
            "giroscopio UCI"
        )

        if not (
            len(total_acc)
            == len(body_acc)
            == len(giroscopio)
        ):
            raise ValueError(
                "Las tres señales UCI deben tener "
                "la misma cantidad de muestras."
            )

        if len(total_acc) != self.WINDOW_SIZE:
            raise ValueError(
                "Una ventana UCI debe tener exactamente "
                f"{self.WINDOW_SIZE} muestras."
            )

        # UCI:
        #
        # total_acc = body_acc + gravity
        #
        gravity = total_acc - body_acc

        features = self._extraer_ventana_preprocesada(
            body_acc,
            gravity,
            giroscopio
        )

        return features.reshape(1, 561)

    def transformar_uci_batch(
        self,
        total_acc,
        body_acc,
        giroscopio
    ):
        """
        Procesa N ventanas UCI.

        Entrada:
            (N, 128, 3)

        Salida:
            (N, 561)
        """

        total_acc = np.asarray(
            total_acc,
            dtype=np.float64
        )

        body_acc = np.asarray(
            body_acc,
            dtype=np.float64
        )

        giroscopio = np.asarray(
            giroscopio,
            dtype=np.float64
        )

        if (
            total_acc.ndim != 3
            or total_acc.shape[1:] != (128, 3)
        ):
            raise ValueError(
                "total_acc debe tener forma (N, 128, 3)."
            )

        if body_acc.shape != total_acc.shape:
            raise ValueError(
                "body_acc debe tener la misma forma "
                "que total_acc."
            )

        if giroscopio.shape != total_acc.shape:
            raise ValueError(
                "giroscopio debe tener la misma forma "
                "que total_acc."
            )

        resultados = []

        for i in range(len(total_acc)):
            resultado = self.transformar_uci(
                total_acc[i],
                body_acc[i],
                giroscopio[i]
            )

            resultados.append(
                resultado[0]
            )

        return np.asarray(
            resultados,
            dtype=np.float64
        )

    # ==========================================================
    # NORMALIZACIÓN
    # ==========================================================

    def ajustar_normalizacion(self, features_train):
        """
        Calcula mínimo y máximo por característica.

        features_train:
            (N, 561)

        Se utilizan solamente los datos TRAIN.
        """

        features_train = np.asarray(
            features_train,
            dtype=np.float64
        )

        if (
            features_train.ndim != 2
            or features_train.shape[1] != 561
        ):
            raise ValueError(
                "features_train debe tener forma (N, 561)."
            )

        self.feature_min = np.min(
            features_train,
            axis=0
        )

        self.feature_max = np.max(
            features_train,
            axis=0
        )

        return self

    def normalizar_features(self, features):
        """
        Normalización por característica:

            x_norm =
                2 * (x - min) / (max - min) - 1

        """

        if not hasattr(
            self,
            "feature_min"
        ) or not hasattr(
            self,
            "feature_max"
        ):
            raise RuntimeError(
                "No hay parámetros de normalización. "
                "Ejecuta ajustar_normalizacion() "
                "o cargar_normalizacion()."
            )

        features = np.asarray(
            features,
            dtype=np.float64
        )

        if features.shape[-1] != 561:
            raise ValueError(
                "Se esperaban 561 características."
            )

        rango = (
            self.feature_max
            -
            self.feature_min
        )

        resultado = np.zeros_like(
            features,
            dtype=np.float64
        )

        validos = rango > 1e-12

        resultado[..., validos] = (
            2.0
            *
            (
                features[..., validos]
                -
                self.feature_min[validos]
            )
            /
            rango[validos]
            -
            1.0
        )

        resultado[..., ~validos] = 0.0

        return resultado

    def guardar_normalizacion(self, ruta):
        if not hasattr(
            self,
            "feature_min"
        ):
            raise RuntimeError(
                "Primero debes ejecutar "
                "ajustar_normalizacion()."
            )

        np.savez(
            ruta,
            feature_min=self.feature_min,
            feature_max=self.feature_max
        )

    def cargar_normalizacion(self, ruta):
        datos = np.load(ruta)

        self.feature_min = np.asarray(
            datos["feature_min"],
            dtype=np.float64
        )

        self.feature_max = np.asarray(
            datos["feature_max"],
            dtype=np.float64
        )

        if (
            self.feature_min.shape != (561,)
            or
            self.feature_max.shape != (561,)
        ):
            raise ValueError(
                "Los parámetros de normalización "
                "deben tener 561 valores."
            )

        return self

    def transformar_normalizado(
        self,
        acelerometro,
        giroscopio
    ):
        """
        Pipeline completo para teléfono:

            sensores
                ↓
            conversión unidades
                ↓
            ventanas
                ↓
            561 features
                ↓
            normalización
        """

        features = self.transformar(
            acelerometro,
            giroscopio
        )

        return self.normalizar_features(
            features
        )

    def transformar_uci_normalizado(
        self,
        total_acc,
        body_acc,
        giroscopio
    ):
        """
        Pipeline para una ventana UCI:

            señales UCI
                ↓
            561 features
                ↓
            normalización
        """

        features = self.transformar_uci(
            total_acc,
            body_acc,
            giroscopio
        )

        return self.normalizar_features(
            features
        )

    # ==========================================================
    # EXTRACCIÓN DE VENTANA UCI PREPROCESADA
    # ==========================================================

    def _extraer_ventana_preprocesada(
        self,
        body_acc,
        gravity,
        gyro
    ):
        """
        Recibe directamente:

            body_acc
            gravity
            gyro

        ya preparados.

        No vuelve a aplicar el filtro de gravedad.
        """

        # Jerk = derivada discreta.
        body_acc_jerk = (
            np.diff(
                body_acc,
                axis=0
            )
            *
            self.sampling_rate
        )

        body_gyro_jerk = (
            np.diff(
                gyro,
                axis=0
            )
            *
            self.sampling_rate
        )

        # Se agrega una primera muestra nula
        # para conservar 128 muestras.
        body_acc_jerk = np.vstack([
            np.zeros(
                3,
                dtype=np.float64
            ),
            body_acc_jerk
        ])

        body_gyro_jerk = np.vstack([
            np.zeros(
                3,
                dtype=np.float64
            ),
            body_gyro_jerk
        ])

        return self._construir_features(
            body_acc,
            gravity,
            gyro,
            body_acc_jerk,
            body_gyro_jerk
        )

    # ==========================================================
    # EXTRACCIÓN DE VENTANA DEL TELÉFONO
    # ==========================================================

    def _extraer_ventana(
        self,
        acc,
        gyro
    ):
        """
        Procesa una ventana de 128 muestras
        proveniente del teléfono.
        """

        gravity = self._separar_gravedad(
            acc
        )

        body_acc = (
            acc - gravity
        )

        body_acc_jerk = (
            np.diff(
                body_acc,
                axis=0
            )
            *
            self.sampling_rate
        )

        body_gyro_jerk = (
            np.diff(
                gyro,
                axis=0
            )
            *
            self.sampling_rate
        )

        body_acc_jerk = np.vstack([
            np.zeros(
                3,
                dtype=np.float64
            ),
            body_acc_jerk
        ])

        body_gyro_jerk = np.vstack([
            np.zeros(
                3,
                dtype=np.float64
            ),
            body_gyro_jerk
        ])

        return self._construir_features(
            body_acc,
            gravity,
            gyro,
            body_acc_jerk,
            body_gyro_jerk
        )

    # ==========================================================
    # CONSTRUCCIÓN DE LAS 561 FEATURES
    # ==========================================================

    def _construir_features(
        self,
        body_acc,
        gravity,
        gyro,
        body_acc_jerk,
        body_gyro_jerk
    ):

        # ------------------------------------------------------
        # MAGNITUDES
        # ------------------------------------------------------

        body_acc_mag = np.linalg.norm(
            body_acc,
            axis=1
        )

        gravity_acc_mag = np.linalg.norm(
            gravity,
            axis=1
        )

        body_acc_jerk_mag = np.linalg.norm(
            body_acc_jerk,
            axis=1
        )

        body_gyro_mag = np.linalg.norm(
            gyro,
            axis=1
        )

        body_gyro_jerk_mag = np.linalg.norm(
            body_gyro_jerk,
            axis=1
        )

        features = []

        # ------------------------------------------------------
        # 1 - 200
        #
        # tBodyAcc
        # tGravityAcc
        # tBodyAccJerk
        # tBodyGyro
        # tBodyGyroJerk
        #
        # 40 features cada uno.
        # ------------------------------------------------------

        señales_xyz = [
            body_acc,
            gravity,
            body_acc_jerk,
            gyro,
            body_gyro_jerk
        ]

        for señal in señales_xyz:
            features.extend(
                self._features_time_xyz(
                    señal
                )
            )

        # ------------------------------------------------------
        # 201 - 265
        #
        # Magnitudes temporales.
        #
        # 13 features cada una.
        # ------------------------------------------------------

        señales_magnitud = [
            body_acc_mag,
            gravity_acc_mag,
            body_acc_jerk_mag,
            body_gyro_mag,
            body_gyro_jerk_mag
        ]

        for señal in señales_magnitud:
            features.extend(
                self._features_time_magnitude(
                    señal
                )
            )

        # ------------------------------------------------------
        # FFT XYZ
        # ------------------------------------------------------

        f_body_acc = self._fft_signal(
            body_acc
        )

        f_body_acc_jerk = self._fft_signal(
            body_acc_jerk
        )

        f_body_gyro = self._fft_signal(
            gyro
        )

        # ------------------------------------------------------
        # 266 - 344
        # fBodyAcc
        # ------------------------------------------------------

        features.extend(
            self._features_frequency_xyz(
                f_body_acc
            )
        )

        # ------------------------------------------------------
        # 345 - 423
        # fBodyAccJerk
        # ------------------------------------------------------

        features.extend(
            self._features_frequency_xyz(
                f_body_acc_jerk
            )
        )

        # ------------------------------------------------------
        # 424 - 502
        # fBodyGyro
        # ------------------------------------------------------

        features.extend(
            self._features_frequency_xyz(
                f_body_gyro
            )
        )

        # ------------------------------------------------------
        # FFT MAGNITUDES
        # ------------------------------------------------------

        f_body_acc_mag = self._fft_magnitude(
            body_acc_mag
        )

        f_body_acc_jerk_mag = self._fft_magnitude(
            body_acc_jerk_mag
        )

        f_body_gyro_mag = self._fft_magnitude(
            body_gyro_mag
        )

        f_body_gyro_jerk_mag = self._fft_magnitude(
            body_gyro_jerk_mag
        )

        # ------------------------------------------------------
        # 503 - 515
        # fBodyAccMag
        # ------------------------------------------------------

        features.extend(
            self._features_frequency_magnitude(
                f_body_acc_mag
            )
        )

        # ------------------------------------------------------
        # 516 - 528
        # fBodyAccJerkMag
        # ------------------------------------------------------

        features.extend(
            self._features_frequency_magnitude(
                f_body_acc_jerk_mag
            )
        )

        # ------------------------------------------------------
        # 529 - 541
        # fBodyGyroMag
        # ------------------------------------------------------

        features.extend(
            self._features_frequency_magnitude(
                f_body_gyro_mag
            )
        )

        # ------------------------------------------------------
        # 542 - 554
        # fBodyGyroJerkMag
        # ------------------------------------------------------

        features.extend(
            self._features_frequency_magnitude(
                f_body_gyro_jerk_mag
            )
        )

        # ------------------------------------------------------
        # 555 - 561
        # ÁNGULOS
        # ------------------------------------------------------

        body_acc_mean = np.mean(
            body_acc,
            axis=0
        )

        gravity_mean = np.mean(
            gravity,
            axis=0
        )

        body_acc_jerk_mean = np.mean(
            body_acc_jerk,
            axis=0
        )

        body_gyro_mean = np.mean(
            gyro,
            axis=0
        )

        body_gyro_jerk_mean = np.mean(
            body_gyro_jerk,
            axis=0
        )

        features.append(
            self._angle(
                body_acc_mean,
                gravity_mean
            )
        )

        features.append(
            self._angle(
                body_acc_jerk_mean,
                gravity_mean
            )
        )

        features.append(
            self._angle(
                body_gyro_mean,
                gravity_mean
            )
        )

        features.append(
            self._angle(
                body_gyro_jerk_mean,
                gravity_mean
            )
        )

        features.append(
            self._angle(
                np.array(
                    [1.0, 0.0, 0.0]
                ),
                gravity_mean
            )
        )

        features.append(
            self._angle(
                np.array(
                    [0.0, 1.0, 0.0]
                ),
                gravity_mean
            )
        )

        features.append(
            self._angle(
                np.array(
                    [0.0, 0.0, 1.0]
                ),
                gravity_mean
            )
        )

        if len(features) != 561:
            raise RuntimeError(
                f"El extractor produjo {len(features)} "
                "características en lugar de 561."
            )

        return np.asarray(
            features,
            dtype=np.float64
        )

    # ==========================================================
    # SEPARACIÓN DE GRAVEDAD
    # ==========================================================

    def _separar_gravedad(
        self,
        acelerometro
    ):
        """
        Filtro Butterworth pasa bajos de 0.3 Hz.

        UCI HAR utiliza este filtro para
        separar la componente de gravedad.
        """

        cutoff = 0.3

        nyquist = (
            self.sampling_rate / 2.0
        )

        normal_cutoff = (
            cutoff / nyquist
        )

        b, a = butter(
            N=3,
            Wn=normal_cutoff,
            btype="low"
        )

        gravity = np.zeros_like(
            acelerometro
        )

        for eje in range(3):
            gravity[:, eje] = filtfilt(
                b,
                a,
                acelerometro[:, eje]
            )

        return gravity

    # ==========================================================
    # FEATURES TEMPORALES XYZ
    # ==========================================================

    def _features_time_xyz(
        self,
        signal
    ):
        features = []

        # mean: 3
        features.extend(
            np.mean(
                signal,
                axis=0
            )
        )

        # std: 3
        features.extend(
            np.std(
                signal,
                axis=0,
                ddof=1
            )
        )

        # mad: 3
        for eje in range(3):
            features.append(
                self._mad(
                    signal[:, eje]
                )
            )

        # max: 3
        features.extend(
            np.max(
                signal,
                axis=0
            )
        )

        # min: 3
        features.extend(
            np.min(
                signal,
                axis=0
            )
        )

        # sma: 1
        features.append(
            self._sma(
                signal
            )
        )

        # energy: 3
        for eje in range(3):
            features.append(
                self._energy(
                    signal[:, eje]
                )
            )

        # iqr: 3
        for eje in range(3):
            features.append(
                np.percentile(
                    signal[:, eje],
                    75
                )
                -
                np.percentile(
                    signal[:, eje],
                    25
                )
            )

        # entropy: 3
        for eje in range(3):
            features.append(
                self._entropy(
                    signal[:, eje]
                )
            )

        # arCoeff: 12
        for eje in range(3):
            features.extend(
                self._burg(
                    signal[:, eje],
                    order=4
                )
            )

        # correlation: 3
        features.append(
            self._safe_corr(
                signal[:, 0],
                signal[:, 1]
            )
        )

        features.append(
            self._safe_corr(
                signal[:, 0],
                signal[:, 2]
            )
        )

        features.append(
            self._safe_corr(
                signal[:, 1],
                signal[:, 2]
            )
        )

        return features

    # ==========================================================
    # FEATURES TEMPORALES MAGNITUD
    # ==========================================================

    def _features_time_magnitude(
        self,
        signal
    ):
        features = []

        # mean
        features.append(
            np.mean(signal)
        )

        # std
        features.append(
            np.std(
                signal,
                ddof=1
            )
        )

        # mad
        features.append(
            self._mad(signal)
        )

        # max
        features.append(
            np.max(signal)
        )

        # min
        features.append(
            np.min(signal)
        )

        # sma
        features.append(
            self._sma_magnitude(
                signal
            )
        )

        # energy
        features.append(
            self._energy(signal)
        )

        # iqr
        features.append(
            np.percentile(
                signal,
                75
            )
            -
            np.percentile(
                signal,
                25
            )
        )

        # entropy
        features.append(
            self._entropy(signal)
        )

        # arCoeff
        features.extend(
            self._burg(
                signal,
                order=4
            )
        )

        return features

    # ==========================================================
    # FFT
    # ==========================================================

    def _fft_signal(
        self,
        signal
    ):
        """
        Calcula la FFT de cada eje.

        Se eliminan las componentes:
            - DC
        y se conservan:
            - bins 1 a 64
        """

        resultado = np.zeros(
            (64, 3),
            dtype=np.float64
        )

        for eje in range(3):
            fft = np.fft.fft(
                signal[:, eje],
                n=self.WINDOW_SIZE
            )

            resultado[:, eje] = np.abs(
                fft[1:65]
            )

        return resultado

    def _fft_magnitude(
        self,
        signal
    ):
        fft = np.fft.fft(
            signal,
            n=self.WINDOW_SIZE
        )

        return np.abs(
            fft[1:65]
        )

    # ==========================================================
    # FEATURES FRECUENCIALES XYZ
    # ==========================================================

    def _features_frequency_xyz(
        self,
        fft_signal
    ):
        features = []

        # mean: 3
        for eje in range(3):
            features.append(
                np.mean(
                    fft_signal[:, eje]
                )
            )

        # std: 3
        for eje in range(3):
            features.append(
                np.std(
                    fft_signal[:, eje],
                    ddof=1
                )
            )

        # mad: 3
        for eje in range(3):
            features.append(
                self._mad(
                    fft_signal[:, eje]
                )
            )

        # max: 3
        for eje in range(3):
            features.append(
                np.max(
                    fft_signal[:, eje]
                )
            )

        # min: 3
        for eje in range(3):
            features.append(
                np.min(
                    fft_signal[:, eje]
                )
            )

        # sma: 1
        features.append(
            self._sma(
                fft_signal
            )
        )

        # energy: 3
        for eje in range(3):
            features.append(
                self._energy(
                    fft_signal[:, eje]
                )
            )

        # iqr: 3
        for eje in range(3):
            features.append(
                np.percentile(
                    fft_signal[:, eje],
                    75
                )
                -
                np.percentile(
                    fft_signal[:, eje],
                    25
                )
            )

        # entropy: 3
        for eje in range(3):
            features.append(
                self._entropy(
                    fft_signal[:, eje]
                )
            )

        # maxInds: 3
        for eje in range(3):
            features.append(
                float(
                    np.argmax(
                        fft_signal[:, eje]
                    )
                    + 1
                )
            )

        # meanFreq: 3
        frequencies = (
            np.arange(1, 65)
            *
            (
                self.sampling_rate
                /
                self.WINDOW_SIZE
            )
        )

        for eje in range(3):
            magnitud = (
                fft_signal[:, eje]
            )

            denominador = np.sum(
                magnitud
            )

            if denominador == 0:
                mean_freq = 0.0
            else:
                mean_freq = (
                    np.sum(
                        frequencies
                        *
                        magnitud
                    )
                    /
                    denominador
                )

            features.append(
                mean_freq
            )

        # skewness: 3
        for eje in range(3):
            features.append(
                self._safe_skew(
                    fft_signal[:, eje]
                )
            )

        # kurtosis: 3
        for eje in range(3):
            features.append(
                self._safe_kurtosis(
                    fft_signal[:, eje]
                )
            )

        # bandsEnergy: 42
        bands = [
            (1, 8),
            (9, 16),
            (17, 24),
            (25, 32),
            (33, 40),
            (41, 48),
            (49, 56),
            (57, 64),
            (1, 16),
            (17, 32),
            (33, 48),
            (49, 64),
            (1, 24),
            (25, 48)
        ]

        for eje in range(3):
            magnitud = (
                fft_signal[:, eje]
            )

            for inicio, fin in bands:
                segmento = magnitud[
                    inicio - 1:fin
                ]

                features.append(
                    np.sum(
                        segmento ** 2
                    )
                    /
                    self.WINDOW_SIZE
                )

        return features

    # ==========================================================
    # FEATURES FRECUENCIALES MAGNITUD
    # ==========================================================

    def _features_frequency_magnitude(
        self,
        fft_signal
    ):
        features = []

        # mean
        features.append(
            np.mean(
                fft_signal
            )
        )

        # std
        features.append(
            np.std(
                fft_signal,
                ddof=1
            )
        )

        # mad
        features.append(
            self._mad(
                fft_signal
            )
        )

        # max
        features.append(
            np.max(
                fft_signal
            )
        )

        # min
        features.append(
            np.min(
                fft_signal
            )
        )

        # sma
        features.append(
            self._sma_magnitude(
                fft_signal
            )
        )

        # energy
        features.append(
            self._energy(
                fft_signal
            )
        )

        # iqr
        features.append(
            np.percentile(
                fft_signal,
                75
            )
            -
            np.percentile(
                fft_signal,
                25
            )
        )

        # entropy
        features.append(
            self._entropy(
                fft_signal
            )
        )

        # maxInds
        features.append(
            float(
                np.argmax(
                    fft_signal
                )
                + 1
            )
        )

        # meanFreq
        frequencies = (
            np.arange(1, 65)
            *
            (
                self.sampling_rate
                /
                self.WINDOW_SIZE
            )
        )

        denominador = np.sum(
            fft_signal
        )

        if denominador == 0:
            mean_freq = 0.0
        else:
            mean_freq = (
                np.sum(
                    frequencies
                    *
                    fft_signal
                )
                /
                denominador
            )

        features.append(
            mean_freq
        )

        # skewness
        features.append(
            self._safe_skew(
                fft_signal
            )
        )

        # kurtosis
        features.append(
            self._safe_kurtosis(
                fft_signal
            )
        )

        return features

    # ==========================================================
    # ESTADÍSTICAS
    # ==========================================================

    @staticmethod
    def _mad(signal):
        mediana = np.median(
            signal
        )

        return np.median(
            np.abs(
                signal - mediana
            )
        )

    @staticmethod
    def _energy(signal):
        return (
            np.sum(
                signal ** 2
            )
            /
            len(signal)
        )

    @staticmethod
    def _sma(signal):
        """
        Signal Magnitude Area.

        Para XYZ:

            mean(
                |X| + |Y| + |Z|
            )
        """

        return np.mean(
            np.sum(
                np.abs(signal),
                axis=1
            )
        )

    @staticmethod
    def _sma_magnitude(signal):
        return np.mean(
            np.abs(signal)
        )

    # ==========================================================
    # ENTROPÍA
    # ==========================================================

    @staticmethod
    def _entropy(signal):
        """
        Entropía basada en un histograma de 10 bins.
        """

        signal = np.asarray(
            signal,
            dtype=np.float64
        )

        if len(signal) == 0:
            return 0.0

        if np.all(
            signal == signal[0]
        ):
            return 0.0

        hist, _ = np.histogram(
            signal,
            bins=10,
            density=False
        )

        total = np.sum(
            hist
        )

        if total == 0:
            return 0.0

        probabilidades = (
            hist[hist > 0]
            /
            total
        )

        return -np.sum(
            probabilidades
            *
            np.log2(
                probabilidades
            )
        )

    # ==========================================================
    # BURG / AR
    # ==========================================================

    @staticmethod
    def _burg(
        signal,
        order=4
    ):
        """
        Coeficientes AR mediante Burg.

        Devuelve los coeficientes AR finales:
            a1, a2, a3, a4

        No devuelve los coeficientes de reflexión.
        """

        x = np.asarray(
            signal,
            dtype=np.float64
        )

        if x.ndim != 1:
            x = x.ravel()

        n = len(x)

        if n <= order:
            return [0.0] * order

        # Centrar señal.
        x = (
            x
            -
            np.mean(x)
        )

        if np.sum(
            x * x
        ) <= 1e-15:
            return [0.0] * order

        # Errores iniciales.
        ef = x[1:].copy()
        eb = x[:-1].copy()

        # a[0] = 1
        # a[1:] = coeficientes AR.
        a = np.zeros(
            order + 1,
            dtype=np.float64
        )

        a[0] = 1.0

        for m in range(
            1,
            order + 1
        ):

            if (
                len(ef) == 0
                or len(eb) == 0
            ):
                return a[1:].tolist()

            denominator = (
                np.dot(
                    ef,
                    ef
                )
                +
                np.dot(
                    eb,
                    eb
                )
            )

            if denominator <= 1e-15:
                k = 0.0
            else:
                k = (
                    -2.0
                    *
                    np.dot(
                        ef,
                        eb
                    )
                    /
                    denominator
                )

            # Estabilidad numérica.
            k = float(
                np.clip(
                    k,
                    -1.0,
                    1.0
                )
            )

            old_a = a.copy()

            a[m] = k

            # Recursión de Levinson.
            for i in range(
                1,
                m
            ):
                a[i] = (
                    old_a[i]
                    +
                    k
                    *
                    old_a[m - i]
                )

            if m < order:
                ef_old = ef
                eb_old = eb

                ef = (
                    ef_old[1:]
                    +
                    k
                    *
                    eb_old[1:]
                )

                eb = (
                    eb_old[:-1]
                    +
                    k
                    *
                    ef_old[:-1]
                )

        return a[1:].tolist()

    # ==========================================================
    # CORRELACIÓN
    # ==========================================================

    @staticmethod
    def _safe_corr(
        x,
        y
    ):
        if (
            np.std(x) == 0
            or
            np.std(y) == 0
        ):
            return 0.0

        resultado = np.corrcoef(
            x,
            y
        )[0, 1]

        if not np.isfinite(
            resultado
        ):
            return 0.0

        return resultado

    # ==========================================================
    # SKEWNESS
    # ==========================================================

    @staticmethod
    def _safe_skew(
        signal
    ):
        valor = skew(
            signal,
            bias=False
        )

        if not np.isfinite(
            valor
        ):
            return 0.0

        return valor

    # ==========================================================
    # KURTOSIS
    # ==========================================================

    @staticmethod
    def _safe_kurtosis(
        signal
    ):
        valor = kurtosis(
            signal,
            fisher=True,
            bias=False
        )

        if not np.isfinite(
            valor
        ):
            return 0.0

        return valor

    # ==========================================================
    # ÁNGULOS
    # ==========================================================

    @staticmethod
    def _angle(
        vector_a,
        vector_b
    ):
        a = np.asarray(
            vector_a,
            dtype=np.float64
        )

        b = np.asarray(
            vector_b,
            dtype=np.float64
        )

        norm_a = np.linalg.norm(
            a
        )

        norm_b = np.linalg.norm(
            b
        )

        if (
            norm_a == 0
            or
            norm_b == 0
        ):
            return 0.0

        cosine = (
            np.dot(
                a,
                b
            )
            /
            (
                norm_a
                *
                norm_b
            )
        )

        cosine = np.clip(
            cosine,
            -1.0,
            1.0
        )

        return np.arccos(
            cosine
        )

    # ==========================================================
    # VALIDACIÓN DE ENTRADA
    # ==========================================================

    @staticmethod
    def _validar_sensores(
        datos,
        nombre
    ):
        if datos.ndim != 2:
            raise ValueError(
                f"El {nombre} debe tener 2 dimensiones. "
                f"Forma recibida: {datos.shape}"
            )

        if datos.shape[1] != 3:
            raise ValueError(
                f"El {nombre} debe tener 3 ejes "
                "(X, Y, Z). "
                f"Forma recibida: {datos.shape}"
            )

        if not np.isfinite(
            datos
        ).all():
            raise ValueError(
                f"El {nombre} contiene "
                "valores NaN o infinitos."
            )