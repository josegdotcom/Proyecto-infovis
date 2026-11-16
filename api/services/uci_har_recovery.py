import numpy as np

from scipy.signal import butter, filtfilt
from scipy.stats import skew, kurtosis


class HARConverter:
    """
    Convierte las señales del teléfono al conjunto de características
    utilizado por UCI HAR.

    Entrada:
        acelerómetro: m/s², idealmente aceleración total
                      incluyendo gravedad
        giroscopio:   grados/s

    Conversión:
        acelerómetro -> g
        giroscopio   -> rad/s

    Después:
        - ventanas de 128 muestras
        - 50% de solapamiento
        - separación gravedad / aceleración corporal
        - jerk
        - magnitudes
        - características temporales
        - FFT
        - características frecuenciales
        - características de ángulo

    Salida:
        matriz de forma:

            (numero_de_ventanas, 561)
    """

    GRAVITY = 9.80665

    WINDOW_SIZE = 128
    WINDOW_STEP = 64

    def __init__(self, sampling_rate=50):

        self.sampling_rate = sampling_rate

        if sampling_rate != 50:
            raise ValueError(
                "UCI HAR utiliza una frecuencia de muestreo de 50 Hz."
            )

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
    # PROCESAMIENTO COMPLETO
    # ==========================================================

    def transformar(self, acelerometro, giroscopio):

        datos = self.convertir(
            acelerometro,
            giroscopio
        )

        acc = datos["accelerometer"]
        gyro = datos["gyroscope"]

        if len(acc) < self.WINDOW_SIZE:

            raise ValueError(
                f"Se necesitan al menos {self.WINDOW_SIZE} muestras "
                f"para crear una ventana UCI HAR."
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
                    "El extractor produjo "
                    f"{len(features)} características "
                    "en lugar de 561."
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
    # PROCESAMIENTO DIRECTO DE UNA VENTANA UCI
    # ==========================================================

    def transformar_uci(self, total_acc, body_acc, giroscopio):
        """
        Procesa una ventana UCI HAR ya preprocesada.

        Entrada UCI:
            total_acc : g
            body_acc  : g
            giroscopio: rad/s

        No vuelve a filtrar ni convierte unidades.
        Devuelve:
            (1, 561)
        """
        total_acc = np.asarray(total_acc, dtype=np.float64)
        body_acc = np.asarray(body_acc, dtype=np.float64)
        giroscopio = np.asarray(giroscopio, dtype=np.float64)

        self._validar_sensores(total_acc, "total_acc UCI")
        self._validar_sensores(body_acc, "body_acc UCI")
        self._validar_sensores(giroscopio, "giroscopio UCI")

        if not (
            len(total_acc) == len(body_acc) == len(giroscopio)
        ):
            raise ValueError(
                "Las tres señales UCI deben tener la misma cantidad de muestras."
            )

        if len(total_acc) != self.WINDOW_SIZE:
            raise ValueError(
                f"Una ventana UCI debe tener exactamente "
                f"{self.WINDOW_SIZE} muestras."
            )

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

        Cada entrada debe tener forma:
            (N, 128, 3)

        Devuelve:
            (N, 561)
        """
        total_acc = np.asarray(total_acc, dtype=np.float64)
        body_acc = np.asarray(body_acc, dtype=np.float64)
        giroscopio = np.asarray(giroscopio, dtype=np.float64)

        if total_acc.ndim != 3 or total_acc.shape[1:] != (128, 3):
            raise ValueError(
                "total_acc debe tener forma (N, 128, 3)."
            )

        if body_acc.shape != total_acc.shape:
            raise ValueError(
                "body_acc debe tener la misma forma que total_acc."
            )

        if giroscopio.shape != total_acc.shape:
            raise ValueError(
                "giroscopio debe tener la misma forma que total_acc."
            )

        resultados = []

        for i in range(len(total_acc)):
            resultados.append(
                self.transformar_uci(
                    total_acc[i],
                    body_acc[i],
                    giroscopio[i]
                )[0]
            )

        return np.asarray(resultados, dtype=np.float64)

    # ==========================================================
    # NORMALIZACIÓN UCI
    # ==========================================================

    def normalizar_features(self, features):
        """
        Normaliza features usando min/max por característica.

        Fórmula:
            x_norm = 2 * (x - min) / (max - min) - 1

        Requiere haber cargado o ajustado los parámetros UCI.
        """
        if not hasattr(self, "feature_min") or not hasattr(
            self, "feature_max"
        ):
            raise RuntimeError(
                "No hay parámetros de normalización. "
                "Ejecuta cargar_normalizacion() o "
                "ajustar_normalizacion()."
            )

        features = np.asarray(features, dtype=np.float64)

        if features.shape[-1] != 561:
            raise ValueError(
                "Se esperaban 561 características."
            )

        rango = self.feature_max - self.feature_min

        resultado = np.zeros_like(features, dtype=np.float64)

        validos = rango > 1e-12

        resultado[..., validos] = (
            2.0
            * (
                features[..., validos]
                - self.feature_min[validos]
            )
            / rango[validos]
            - 1.0
        )

        resultado[..., ~validos] = 0.0

        return resultado

    def ajustar_normalizacion(self, features_train):
        """
        Ajusta min/max por característica usando features TRAIN
        sin normalizar.
        """
        features_train = np.asarray(
            features_train,
            dtype=np.float64
        )

        if features_train.ndim != 2 or features_train.shape[1] != 561:
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

    def guardar_normalizacion(self, ruta):
        if not hasattr(self, "feature_min"):
            raise RuntimeError(
                "Primero debes ejecutar ajustar_normalizacion()."
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
            or self.feature_max.shape != (561,)
        ):
            raise ValueError(
                "Los parámetros de normalización deben tener "
                "561 valores."
            )

        return self

    def transformar_uci_normalizado(
        self,
        total_acc,
        body_acc,
        giroscopio
    ):
        """
        Procesa una ventana UCI ya preprocesada y la normaliza.

        Útil exclusivamente para validación contra X_train/X_test.
        """
        features = self.transformar_uci(
            total_acc,
            body_acc,
            giroscopio
        )

        return self.normalizar_features(
            features
        )

    def transformar_normalizado(
        self,
        acelerometro,
        giroscopio
    ):
        """
        Pipeline para el teléfono:
            sensores -> 561 features -> normalización UCI
        """
        features = self.transformar(
            acelerometro,
            giroscopio
        )

        return self.normalizar_features(
            features
        )

    # ==========================================================
    # EXTRACCIÓN SOBRE SEÑALES YA PREPROCESADAS
    # ==========================================================

    def _extraer_ventana_preprocesada(
        self,
        body_acc,
        gravity,
        gyro
    ):
        """
        Igual que _extraer_ventana(), pero recibe directamente:
            body_acc, gravity y gyro.

        Se usa exclusivamente para validar contra UCI HAR.
        """
        body_acc_jerk = np.diff(
            body_acc,
            axis=0
        ) * self.sampling_rate

        body_gyro_jerk = np.diff(
            gyro,
            axis=0
        ) * self.sampling_rate

        # UCI obtiene el jerk mediante una diferencia temporal.
        # La primera muestra no tiene muestra anterior, por lo que
        # se conserva como cero para mantener 128 muestras.
        body_acc_jerk = np.vstack([
            np.zeros(3, dtype=np.float64),
            body_acc_jerk
        ])

        body_gyro_jerk = np.vstack([
            np.zeros(3, dtype=np.float64),
            body_gyro_jerk
        ])

        return self._construir_features(
            body_acc,
            gravity,
            gyro,
            body_acc_jerk,
            body_gyro_jerk
        )

    def _construir_features(
        self,
        body_acc,
        gravity,
        gyro,
        body_acc_jerk,
        body_gyro_jerk
    ):
        """
        Construye las 561 características a partir de las señales
        ya preparadas.
        """
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

        time_signals = [
            body_acc,
            gravity,
            body_acc_jerk,
            gyro,
            body_gyro_jerk
        ]

        features = []

        for signal in time_signals:
            features.extend(
                self._features_time_xyz(signal)
            )

        magnitude_signals = [
            body_acc_mag,
            gravity_acc_mag,
            body_acc_jerk_mag,
            body_gyro_mag,
            body_gyro_jerk_mag
        ]

        for signal in magnitude_signals:
            features.extend(
                self._features_time_magnitude(signal)
            )

        f_body_acc = self._fft_signal(body_acc)
        f_body_acc_jerk = self._fft_signal(body_acc_jerk)
        f_body_gyro = self._fft_signal(gyro)

        features.extend(
            self._features_frequency_xyz(f_body_acc)
        )

        features.extend(
            self._features_frequency_xyz(f_body_acc_jerk)
        )

        features.extend(
            self._features_frequency_xyz(f_body_gyro)
        )

        f_body_acc_mag = self._fft_magnitude(body_acc_mag)
        f_body_acc_jerk_mag = self._fft_magnitude(
            body_acc_jerk_mag
        )
        f_body_gyro_mag = self._fft_magnitude(body_gyro_mag)
        f_body_gyro_jerk_mag = self._fft_magnitude(
            body_gyro_jerk_mag
        )

        features.extend(
            self._features_frequency_magnitude(
                f_body_acc_mag
            )
        )

        features.extend(
            self._features_frequency_magnitude(
                f_body_acc_jerk_mag
            )
        )

        features.extend(
            self._features_frequency_magnitude(
                f_body_gyro_mag
            )
        )

        features.extend(
            self._features_frequency_magnitude(
                f_body_gyro_jerk_mag
            )
        )

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
                np.array([1.0, 0.0, 0.0]),
                gravity_mean
            )
        )

        features.append(
            self._angle(
                np.array([0.0, 1.0, 0.0]),
                gravity_mean
            )
        )

        features.append(
            self._angle(
                np.array([0.0, 0.0, 1.0]),
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
    # UNA VENTANA
    # ==========================================================

    def _extraer_ventana(
        self,
        acc,
        gyro
    ):

        # ------------------------------------------------------
        # Separar gravedad y aceleración corporal
        # ------------------------------------------------------

        gravity = self._separar_gravedad(acc)

        body_acc = acc - gravity

        body_acc_jerk = np.diff(
            body_acc,
            axis=0
        ) * self.sampling_rate

        body_gyro_jerk = np.diff(
            gyro,
            axis=0
        ) * self.sampling_rate

        # UCI obtiene el jerk mediante una diferencia temporal.
        # La primera muestra no tiene muestra anterior, por lo que
        # se conserva como cero para mantener 128 muestras.
        body_acc_jerk = np.vstack([
            np.zeros(3, dtype=np.float64),
            body_acc_jerk
        ])

        body_gyro_jerk = np.vstack([
            np.zeros(3, dtype=np.float64),
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
    # GRAVEDAD
    # ==========================================================

    def _separar_gravedad(self, acelerometro):

        # Filtro Butterworth pasa bajos de 0.3 Hz.
        #
        # UCI HAR utiliza este filtro para separar
        # la componente de gravedad.

        cutoff = 0.3

        nyquist = self.sampling_rate / 2.0

        normal_cutoff = cutoff / nyquist

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
    # CARACTERÍSTICAS TEMPORALES XYZ
    # ==========================================================

    def _features_time_xyz(self, signal):

        features = []

        # mean
        features.extend(
            np.mean(signal, axis=0)
        )

        # std
        features.extend(
            np.std(
                signal,
                axis=0,
                ddof=1
            )
        )

        # mad
        for eje in range(3):

            features.append(
                self._mad(
                    signal[:, eje]
                )
            )

        # max
        features.extend(
            np.max(signal, axis=0)
        )

        # min
        features.extend(
            np.min(signal, axis=0)
        )

        # sma
        features.append(
            self._sma(signal)
        )

        # energy
        for eje in range(3):

            features.append(
                self._energy(
                    signal[:, eje]
                )
            )

        # iqr
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

        # entropy
        for eje in range(3):

            features.append(
                self._entropy(
                    signal[:, eje]
                )
            )

        # Burg AR coefficients
        for eje in range(3):

            features.extend(
                self._burg(
                    signal[:, eje],
                    order=4
                )
            )

        # Correlaciones
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
    # CARACTERÍSTICAS TEMPORALES MAGNITUD
    # ==========================================================

    def _features_time_magnitude(self, signal):

        features = []

        features.append(
            np.mean(signal)
        )

        features.append(
            np.std(
                signal,
                ddof=1
            )
        )

        features.append(
            self._mad(signal)
        )

        features.append(
            np.max(signal)
        )

        features.append(
            np.min(signal)
        )

        features.append(
            self._sma_magnitude(signal)
        )

        features.append(
            self._energy(signal)
        )

        features.append(
            np.percentile(signal, 75)
            -
            np.percentile(signal, 25)
        )

        features.append(
            self._entropy(signal)
        )

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

    def _fft_signal(self, signal):

        """
        FFT de cada eje.

        Se conservan los 64 bins positivos utilizados
        por UCI HAR.
        """

        result = np.zeros(
            (64, 3),
            dtype=np.float64
        )

        for eje in range(3):

            fft = np.fft.fft(
                signal[:, eje],
                n=self.WINDOW_SIZE
            )

            # Quitamos DC y tomamos los primeros
            # 64 componentes positivos.

            result[:, eje] = np.abs(
                fft[1:65]
            )

        return result

    def _fft_magnitude(self, signal):

        fft = np.fft.fft(
            signal,
            n=self.WINDOW_SIZE
        )

        return np.abs(
            fft[1:65]
        )

    # ==========================================================
    # CARACTERÍSTICAS FRECUENCIALES XYZ
    # ==========================================================

    def _features_frequency_xyz(self, fft_signal):

        features = []

        # ------------------------------------------------------
        # mean
        # ------------------------------------------------------

        for eje in range(3):

            features.append(
                np.mean(
                    fft_signal[:, eje]
                )
            )

        # ------------------------------------------------------
        # std
        # ------------------------------------------------------

        for eje in range(3):

            features.append(
                np.std(
                    fft_signal[:, eje],
                    ddof=1
                )
            )

        # ------------------------------------------------------
        # mad
        # ------------------------------------------------------

        for eje in range(3):

            features.append(
                self._mad(
                    fft_signal[:, eje]
                )
            )

        # ------------------------------------------------------
        # max
        # ------------------------------------------------------

        for eje in range(3):

            features.append(
                np.max(
                    fft_signal[:, eje]
                )
            )

        # ------------------------------------------------------
        # min
        # ------------------------------------------------------

        for eje in range(3):

            features.append(
                np.min(
                    fft_signal[:, eje]
                )
            )

        # ------------------------------------------------------
        # SMA
        # ------------------------------------------------------

        features.append(
            self._sma(
                fft_signal
            )
        )

        # ------------------------------------------------------
        # energy
        # ------------------------------------------------------

        for eje in range(3):

            features.append(
                self._energy(
                    fft_signal[:, eje]
                )
            )

        # ------------------------------------------------------
        # IQR
        # ------------------------------------------------------

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

        # ------------------------------------------------------
        # entropy
        # ------------------------------------------------------

        for eje in range(3):

            features.append(
                self._entropy(
                    fft_signal[:, eje]
                )
            )

        # ------------------------------------------------------
        # maxInds
        # ------------------------------------------------------

        for eje in range(3):

            features.append(
                float(
                    np.argmax(
                        fft_signal[:, eje]
                    )
                    + 1
                )
            )

        # ------------------------------------------------------
        # meanFreq
        # ------------------------------------------------------

        frequencies = np.arange(
            1,
            65
        ) * (
            self.sampling_rate
            /
            self.WINDOW_SIZE
        )

        for eje in range(3):

            magnitud = fft_signal[:, eje]

            denominador = np.sum(
                magnitud
            )

            if denominador == 0:

                mean_freq = 0.0

            else:

                mean_freq = np.sum(
                    frequencies * magnitud
                ) / denominador

            features.append(
                mean_freq
            )

        # ------------------------------------------------------
        # skewness
        # ------------------------------------------------------

        for eje in range(3):

            features.append(
                self._safe_skew(
                    fft_signal[:, eje]
                )
            )

        # ------------------------------------------------------
        # kurtosis
        # ------------------------------------------------------

        for eje in range(3):

            features.append(
                self._safe_kurtosis(
                    fft_signal[:, eje]
                )
            )

        # ------------------------------------------------------
        # bandsEnergy
        #
        # IMPORTANTE:
        # El archivo features.txt tiene 14 bandas para
        # cada eje.
        # ------------------------------------------------------

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

            magnitud = fft_signal[:, eje]

            for inicio, fin in bands:

                # Convertimos de índices 1-based
                # a índices Python.

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
    # CARACTERÍSTICAS FRECUENCIALES MAGNITUD
    # ==========================================================

    def _features_frequency_magnitude(self, fft_signal):

        features = []

        features.append(
            np.mean(fft_signal)
        )

        features.append(
            np.std(
                fft_signal,
                ddof=1
            )
        )

        features.append(
            self._mad(fft_signal)
        )

        features.append(
            np.max(fft_signal)
        )

        features.append(
            np.min(fft_signal)
        )

        features.append(
            self._sma_magnitude(
                fft_signal
            )
        )

        features.append(
            self._energy(
                fft_signal
            )
        )

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
        frequencies = np.arange(
            1,
            65
        ) * (
            self.sampling_rate
            /
            self.WINDOW_SIZE
        )

        denominator = np.sum(
            fft_signal
        )

        if denominator == 0:

            mean_freq = 0.0

        else:

            mean_freq = np.sum(
                frequencies * fft_signal
            ) / denominator

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
    # FUNCIONES ESTADÍSTICAS
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

        return np.sum(
            signal ** 2
        ) / len(signal)

    @staticmethod
    def _sma(signal):

        """
        Signal Magnitude Area.

        Para una señal XYZ:

            mean(|X| + |Y| + |Z|)
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
        Entropía basada en histograma.

        Se utiliza una distribución empírica para evitar
        problemas con valores continuos.
        """

        signal = np.asarray(
            signal,
            dtype=np.float64
        )

        if np.all(
            signal == signal[0]
        ):

            return 0.0

        hist, _ = np.histogram(
            signal,
            bins=10,
            density=False
        )

        total = np.sum(hist)

        if total == 0:
            return 0.0

        probabilities = (
            hist[hist > 0] / total
        )

        return -np.sum(
            probabilities
            *
            np.log2(probabilities)
        )

    # ==========================================================
    # BURG
    # ==========================================================

    @staticmethod
    def _burg(signal, order=4):
        """
        Coeficientes AR mediante Burg de orden 4.

        UCI HAR especifica arCoeff() como coeficientes autorregresivos
        obtenidos mediante Burg de orden 4.

        Importante:
        - k_m es el coeficiente de reflexión de la etapa m.
        - a[1:m] son los coeficientes AR acumulados.
        - se devuelven los coeficientes AR finales, no los k_m.
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

        # Burg se aplica sobre la señal centrada.
        x = x - np.mean(x)

        if np.sum(x * x) <= 1e-15:
            return [0.0] * order

        # Errores de predicción de orden 0.
        ef = x[1:].copy()
        eb = x[:-1].copy()

        # a[0] = 1 y a[1:] son los coeficientes AR.
        a = np.zeros(
            order + 1,
            dtype=np.float64
        )
        a[0] = 1.0

        for m in range(1, order + 1):

            if len(ef) == 0 or len(eb) == 0:
                return a[1:].tolist()

            denominator = (
                np.dot(ef, ef)
                +
                np.dot(eb, eb)
            )

            if denominator <= 1e-15:
                k = 0.0
            else:
                k = (
                    -2.0 * np.dot(ef, eb)
                    / denominator
                )

            # Por estabilidad numérica, Burg debe producir
            # |k| <= 1.
            k = float(np.clip(k, -1.0, 1.0))

            old_a = a.copy()

            # Levinson recursion:
            #
            # a_m,i = a_(m-1),i
            #       + k_m * a_(m-1),m-i
            #
            # para i = 1,...,m-1.
            a[m] = k

            for i in range(1, m):
                a[i] = (
                    old_a[i]
                    +
                    k * old_a[m - i]
                )

            if m < order:

                ef_old = ef
                eb_old = eb

                # Nueva predicción hacia delante/atrás.
                ef = (
                    ef_old[1:]
                    +
                    k * eb_old[1:]
                )

                eb = (
                    eb_old[:-1]
                    +
                    k * ef_old[:-1]
                )

        return a[1:].tolist()

    # ==========================================================
    # CORRELACIÓN
    # ==========================================================

    @staticmethod
    def _safe_corr(x, y):

        if (
            np.std(x) == 0
            or np.std(y) == 0
        ):

            return 0.0

        return np.corrcoef(
            x,
            y
        )[0, 1]

    # ==========================================================
    # SKEWNESS / KURTOSIS
    # ==========================================================

    @staticmethod
    def _safe_skew(signal):

        value = skew(
            signal,
            bias=False
        )

        if not np.isfinite(value):

            return 0.0

        return value

    @staticmethod
    def _safe_kurtosis(signal):

        value = kurtosis(
            signal,
            fisher=True,
            bias=False
        )

        if not np.isfinite(value):

            return 0.0

        return value

    # ==========================================================
    # ÁNGULO
    # ==========================================================

    @staticmethod
    def _angle(vector_a, vector_b):

        a = np.asarray(
            vector_a,
            dtype=np.float64
        )

        b = np.asarray(
            vector_b,
            dtype=np.float64
        )

        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if (
            norm_a == 0
            or norm_b == 0
        ):

            return 0.0

        cosine = np.dot(
            a,
            b
        ) / (
            norm_a * norm_b
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
    # VALIDACIÓN
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
                f"(X, Y, Z). "
                f"Forma recibida: {datos.shape}"
            )

        if not np.isfinite(
            datos
        ).all():

            raise ValueError(
                f"El {nombre} contiene "
                "valores NaN o infinitos."
            )


# ==========================================================
# RECUPERACION DIRECTA DESDE CSV DE PRUEBA 2
# ==========================================================

def _transformar_csv(self, ruta_csv):
    """
    Convierte un CSV generado por Prueba 2 en una matriz (N, 561).

    El CSV contiene: timestamp, ax, ay, az, gx, gy, gz.
    Cada ventana de 128 muestras aparece consecutivamente y, por el
    solapamiento del 50%, el timestamp vuelve hacia atras al comenzar
    la siguiente ventana.
    """
    import pandas as pd

    ruta_csv = str(ruta_csv)
    df = pd.read_csv(ruta_csv)

    columnas = ["timestamp", "ax", "ay", "az", "gx", "gy", "gz"]
    faltantes = [c for c in columnas if c not in df.columns]
    if faltantes:
        raise ValueError(
            "El CSV no contiene las columnas requeridas: " + ", ".join(faltantes)
        )
    if df.empty:
        raise ValueError("El CSV esta vacio.")

    df = df[columnas].copy()
    for columna in columnas:
        df[columna] = pd.to_numeric(df[columna], errors="raise")

    if not np.isfinite(df[columnas].to_numpy(dtype=np.float64)).all():
        raise ValueError("El CSV contiene valores NaN o infinitos.")

    timestamps = df["timestamp"].to_numpy(dtype=np.float64)
    cortes = [0]
    for i in range(1, len(timestamps)):
        if timestamps[i] <= timestamps[i - 1]:
            cortes.append(i)
    cortes.append(len(df))

    ventanas = []
    for inicio, fin in zip(cortes[:-1], cortes[1:]):
        bloque = df.iloc[inicio:fin]
        if len(bloque) != self.WINDOW_SIZE:
            raise ValueError(
                f"Se encontro una ventana de {len(bloque)} muestras "
                f"(se esperaban {self.WINDOW_SIZE}). Rango de filas: {inicio + 1}-{fin}."
            )

        acc = bloque[["ax", "ay", "az"]].to_numpy(dtype=np.float64)
        gyro = bloque[["gx", "gy", "gz"]].to_numpy(dtype=np.float64)

        acc = self.convertir_acelerometro(acc)
        gyro = self.convertir_giroscopio(gyro)

        features = self._extraer_ventana(acc, gyro)
        if len(features) != 561:
            raise RuntimeError(
                f"El extractor produjo {len(features)} caracteristicas en lugar de 561."
            )
        ventanas.append(features)

    if not ventanas:
        raise ValueError("No se encontro ninguna ventana UCI HAR valida.")

    return np.asarray(ventanas, dtype=np.float64)


HARConverter.transformar_csv = _transformar_csv
