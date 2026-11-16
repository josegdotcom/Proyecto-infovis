const MINIMO_IMAGENES = 5;
const ETIQUETAS = {
    0: "Gato",
    1: "Perro"
};
const ICONOS_ANIMAL = {
    0: "../assets/images/gato.svg",
    1: "../assets/images/perro.svg"
};
const COLORES_MODELO = {
    CNN: "#2a78d6",
    MLP: "#1baf7a"
};

const canvas = document.getElementById("canvas-dibujo");
const ctx = canvas.getContext("2d");
const canvasVista28 = document.getElementById("canvas-vista-28");

// Botones principales de prueba
const btnLimpiar = document.getElementById("btn-limpiar");
const btnGuardar = document.getElementById("btn-guardar");
const btnPredecir = document.getElementById("btn-predecir");
const btnVaciar = document.getElementById("btn-vaciar");
const btnNuevaPrueba = document.getElementById("btn-nueva-prueba");
const botonesEtiqueta = document.querySelectorAll(".btn-etiqueta");

// Contadores y paneles
const insigniaFuenteActiva = document.getElementById("insignia-fuente-activa");
const contadorGuardados = document.getElementById("contador-guardados");
const mensajeEstado = document.getElementById("mensaje-estado");
const listaGuardados = document.getElementById("lista-guardados");
const panelResultados = document.getElementById("panel-resultados");
const resumenMetricas = document.getElementById("resumen-metricas");
const tablaMetricasCuerpo = document.getElementById("tabla-metricas-cuerpo");
const grillaPredicciones = document.getElementById("grilla-predicciones");

// Pestañas y contenedores de modo
const tabModoCamara = document.getElementById("tab-modo-camara");
const tabModoLienzo = document.getElementById("tab-modo-lienzo");
const contenedorModoCamara = document.getElementById("contenedor-modo-camara");
const contenedorModoLienzo = document.getElementById("contenedor-modo-lienzo");
const tarjetaConexionQr = document.getElementById("tarjeta-conexion-qr");

// Elementos de cámara y sensor remoto
const puntoConexionRemota = document.getElementById("punto-conexion-remota");
const estadoConexionRemota = document.getElementById("estado-conexion-remota");
const enlaceSensorHttps = document.getElementById("enlace-sensor-https");
const btnCopiarUrlSensor = document.getElementById("btn-copiar-url-sensor");
const btnAbrirProtobject = document.getElementById("btn-abrir-protobject");
const imgQrSensor = document.getElementById("img-qr-sensor");

const btnToggleQr = document.getElementById("btn-toggle-qr");
const btnCamaraLocal = document.getElementById("btn-camara-local");
const btnCambiarCamaraLocal = document.getElementById("btn-cambiar-camara-local");
const btnCongelarLocal = document.getElementById("btn-congelar-local");
const btnSubirFotoLocal = document.getElementById("btn-subir-foto-local");
const inputFotoLocal = document.getElementById("input-foto-local");

const videoLocal = document.getElementById("video-local");
const imgFotoLocal = document.getElementById("img-foto-local");
const overlayRecuadroLocal = document.getElementById("overlay-recuadro-local");
const placeholderSensorRemoto = document.getElementById("placeholder-sensor-remoto");
const tituloPlaceholderSensor = document.getElementById("titulo-placeholder-sensor");
const subtituloPlaceholderSensor = document.getElementById("subtitulo-placeholder-sensor");
const estadoDeteccionTrazo = document.getElementById("estado-deteccion-trazo");

const sliderUmbralLocal = document.getElementById("slider-umbral-local");
const valorUmbralLocal = document.getElementById("valor-umbral-local");
const btnCalibrarLocal = document.getElementById("btn-calibrar-local");

// Elementos de Interpretación en Tiempo Real
const btnAudioTiempoReal = document.getElementById("btn-audio-tiempo-real");
const bannerVeredictoVivo = document.getElementById("banner-veredicto-vivo");
const iconoVeredictoVivo = document.getElementById("icono-veredicto-vivo");
const tituloVeredictoVivo = document.getElementById("titulo-veredicto-vivo");
const detalleVeredictoVivo = document.getElementById("detalle-veredicto-vivo");

const confianzaVivoCnn = document.getElementById("confianza-vivo-cnn");
const imgAnimalCnn = document.getElementById("img-animal-cnn");
const etiquetaVivoCnn = document.getElementById("etiqueta-vivo-cnn");
const probGatoCnn = document.getElementById("prob-gato-cnn");
const probPerroCnn = document.getElementById("prob-perro-cnn");
const barraPerroCnn = document.getElementById("barra-perro-cnn");

const confianzaVivoMlp = document.getElementById("confianza-vivo-mlp");
const imgAnimalMlp = document.getElementById("img-animal-mlp");
const etiquetaVivoMlp = document.getElementById("etiqueta-vivo-mlp");
const probGatoMlp = document.getElementById("prob-gato-mlp");
const probPerroMlp = document.getElementById("prob-perro-mlp");
const barraPerroMlp = document.getElementById("barra-perro-mlp");

// Estado general
let modoEntrada = "camara"; // "camara" | "lienzo"
let fuenteCamara = "remota"; // "remota" | "local" | "foto"
let dibujando = false;
let tieneTrazos = false;
let etiquetaSeleccionada = null;
const muestrasGuardadas = [];

// Estado de tiempo real
let pixelesActuales = new Array(784).fill(0);
let hayDibujoActual = false;
let ultimasPrediccionesVivas = null;
let ultimoTimestampRemoto = 0;
let ultimoIdCapturaRemota = 0;
let streamLocal = null;
let usandoCamaraFrontalLocal = false;
let camaraLocalCongelada = false;
let mapaPapelLocal = null;
let peticionEnCurso = false;
let timerPrediccionLienzo = null;

// Audio / Voz en tiempo real
let audioTiempoRealActivo = false;
let ultimoAnimalAnunciado = "";
let ultimoTiempoAnuncio = 0;

// Canvases auxiliares para preprocesamiento de cámara (112x112 -> 28x28)
const workCanvas = document.createElement("canvas");
workCanvas.width = 112;
workCanvas.height = 112;
const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });

const outCanvas = document.createElement("canvas");
outCanvas.width = 28;
outCanvas.height = 28;
const outCtx = outCanvas.getContext("2d", { willReadFrequently: true });

// ---------------------------------------------------------------
// 1. Pestañas de modo: Cámara en Tiempo Real vs. Dibujar en Lienzo
// ---------------------------------------------------------------

function cambiarModoEntrada(nuevoModo) {
    modoEntrada = nuevoModo;
    const esCamara = nuevoModo === "camara";

    tabModoCamara.classList.toggle("activo", esCamara);
    tabModoCamara.setAttribute("aria-selected", esCamara ? "true" : "false");
    tabModoLienzo.classList.toggle("activo", !esCamara);
    tabModoLienzo.setAttribute("aria-selected", !esCamara ? "true" : "false");

    contenedorModoCamara.hidden = !esCamara;
    tarjetaConexionQr.hidden = !esCamara;
    contenedorModoLienzo.hidden = esCamara;

    if (esCamara) {
        insigniaFuenteActiva.textContent =
            fuenteCamara === "local"
                ? "🎥 Cámara Local Activa"
                : fuenteCamara === "foto"
                ? "📷 Foto Activa"
                : "📱 Sensor de Cámara Activo";
    } else {
        insigniaFuenteActiva.textContent = "✏️ Modo Lienzo Activo";
        actualizarDesdeLienzo();
    }
}

tabModoCamara.addEventListener("click", () => cambiarModoEntrada("camara"));
tabModoLienzo.addEventListener("click", () => cambiarModoEntrada("lienzo"));

btnToggleQr.addEventListener("click", () => {
    tarjetaConexionQr.hidden = !tarjetaConexionQr.hidden;
});

// ---------------------------------------------------------------
// 2. Configuración de QR y enlace para conectar el teléfono
// ---------------------------------------------------------------

async function inicializarConexionSensorMovil() {
    let urlSensor = new URL("sensor_camara.html", window.location.href).href;

    try {
        const resp = await fetch("/api/info");
        if (resp.ok) {
            const info = await resp.json();
            if (info.ip_local) {
                const puertoHttps = info.puerto_https || 8443;
                urlSensor = `https://${info.ip_local}:${puertoHttps}/exploracion/sensor_camara.html`;
            }
        }
    } catch (e) {
        // Si se ejecuta en GitHub Pages o sin backend local, usar URL relativa actual
    }

    enlaceSensorHttps.href = urlSensor;
    enlaceSensorHttps.textContent = urlSensor;
    imgQrSensor.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=${encodeURIComponent(urlSensor)}`;

    btnCopiarUrlSensor.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(urlSensor);
            mostrarMensaje("Enlace del sensor copiado al portapapeles.", "exito");
        } catch (err) {
            mostrarMensaje(`Abre en tu teléfono: ${urlSensor}`, "info");
        }
    });

    btnAbrirProtobject.addEventListener("click", () => {
        if (typeof Protobject !== "undefined" && Protobject.Core && Protobject.Core.connect) {
            Protobject.Core.connect();
        } else {
            mostrarMensaje("Protobject está listo. Escanea el código QR mostrado en pantalla.", "info");
        }
    });
}

inicializarConexionSensorMovil();

// ---------------------------------------------------------------
// 3. Preprocesamiento de imagen (Cámara / Foto / Lienzo -> 28 x 28)
// ---------------------------------------------------------------

function pintarMiniatura28x28(destinoCanvas, pixeles) {
    destinoCanvas.width = 28;
    destinoCanvas.height = 28;
    const c = destinoCanvas.getContext("2d");
    const imgData = c.createImageData(28, 28);

    for (let i = 0; i < 784; i++) {
        const v = 255 - (pixeles[i] || 0);
        imgData.data[i * 4] = v;
        imgData.data[i * 4 + 1] = v;
        imgData.data[i * 4 + 2] = v;
        imgData.data[i * 4 + 3] = 255;
    }

    c.putImageData(imgData, 0, 0);
}

// Extrae y centra el dibujo del lienzo 280x280 en una grilla 28x28 estilo QuickDraw
function extraerPixeles28x28() {
    const N = 112;
    workCtx.clearRect(0, 0, N, N);
    workCtx.drawImage(canvas, 0, 0, N, N);
    const { data } = workCtx.getImageData(0, 0, N, N);

    let minX = N, minY = N, maxX = -1, maxY = -1;
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            const alpha = data[(y * N + x) * 4 + 3];
            if (alpha > 20) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < minX || maxY < minY) {
        return new Array(784).fill(0);
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const ladoCaja = Math.max(bw, bh);
    const escala = 22 / ladoCaja;
    const dw = Math.max(1, bw * escala);
    const dh = Math.max(1, bh * escala);
    const dx = (28 - dw) / 2;
    const dy = (28 - dh) / 2;

    outCtx.clearRect(0, 0, 28, 28);
    outCtx.drawImage(workCanvas, minX, minY, bw, bh, dx, dy, dw, dh);

    const outData = outCtx.getImageData(0, 0, 28, 28).data;
    const pixeles = new Array(784);
    let maxValor = 0;

    for (let i = 0; i < 784; i++) {
        const intensidad = outData[i * 4 + 3];
        pixeles[i] = intensidad;
        if (intensidad > maxValor) {
            maxValor = intensidad;
        }
    }

    if (maxValor > 0) {
        for (let i = 0; i < 784; i++) {
            pixeles[i] = Math.min(255, Math.round((pixeles[i] / maxValor) * 255));
        }
    }

    return pixeles;
}

// Umbral adaptativo local desde cámara o foto en papel -> 28x28 centrado
function extraer28x28DesdeCamaraLocal(calibrarPapel = false) {
    const esFoto = fuenteCamara === "foto";
    const fuente = esFoto ? imgFotoLocal : videoLocal;
    const vw = esFoto ? imgFotoLocal.naturalWidth : videoLocal.videoWidth;
    const vh = esFoto ? imgFotoLocal.naturalHeight : videoLocal.videoHeight;

    if (!vw || !vh) {
        return { pixeles: new Array(784).fill(0), tieneDibujo: false };
    }

    const lado = Math.min(vw, vh) * 0.74;
    const sx = (vw - lado) / 2;
    const sy = (vh - lado) / 2;

    const N = 112;
    workCtx.drawImage(fuente, sx, sy, lado, lado, 0, 0, N, N);
    const { data } = workCtx.getImageData(0, 0, N, N);

    const gris = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) {
        gris[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }

    if (calibrarPapel) {
        mapaPapelLocal = new Float32Array(gris);
    }

    const integral = new Float64Array((N + 1) * (N + 1));
    for (let y = 0; y < N; y++) {
        let sumaFila = 0;
        for (let x = 0; x < N; x++) {
            const val = mapaPapelLocal
                ? Math.min(255, Math.max(0, 255 - (mapaPapelLocal[y * N + x] - gris[y * N + x])))
                : gris[y * N + x];
            sumaFila += val;
            integral[(y + 1) * (N + 1) + (x + 1)] = integral[y * (N + 1) + (x + 1)] + sumaFila;
        }
    }

    const umbral = Number(sliderUmbralLocal.value) || 18;
    const radio = 8;
    const margen = 5;
    const mascara = new Uint8Array(N * N);

    for (let y = margen; y < N - margen; y++) {
        const y0 = Math.max(0, y - radio);
        const y1 = Math.min(N - 1, y + radio);
        for (let x = margen; x < N - margen; x++) {
            const x0 = Math.max(0, x - radio);
            const x1 = Math.min(N - 1, x + radio);
            const area = (x1 - x0 + 1) * (y1 - y0 + 1);
            const suma =
                integral[(y1 + 1) * (N + 1) + (x1 + 1)] -
                integral[y0 * (N + 1) + (x1 + 1)] -
                integral[(y1 + 1) * (N + 1) + x0] +
                integral[y0 * (N + 1) + x0];
            const mediaLocal = suma / area;
            const actual = mapaPapelLocal
                ? Math.min(255, Math.max(0, 255 - (mapaPapelLocal[y * N + x] - gris[y * N + x])))
                : gris[y * N + x];
            const diff = mediaLocal - actual;
            if (diff > umbral) {
                mascara[y * N + x] = Math.min(255, Math.round((diff - umbral) * 4.2));
            }
        }
    }

    const limpia = new Uint8Array(N * N);
    let minX = N, minY = N, maxX = -1, maxY = -1;
    let activos = 0;

    for (let y = 1; y < N - 1; y++) {
        for (let x = 1; x < N - 1; x++) {
            const idx = y * N + x;
            let vecinos = 0;
            let maxVecino = mascara[idx];
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const v = mascara[(y + dy) * N + (x + dx)];
                    if (v > 0) vecinos++;
                    if (v > maxVecino) maxVecino = v;
                }
            }
            if ((mascara[idx] > 0 && vecinos >= 2) || vecinos >= 4) {
                limpia[idx] = mascara[idx] > 0 ? mascara[idx] : Math.round(maxVecino * 0.75);
                activos++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    const fraccion = activos / (N * N);
    if (activos < 22 || fraccion > 0.48 || maxX <= minX || maxY <= minY) {
        return { pixeles: new Array(784).fill(0), tieneDibujo: false };
    }

    const tempImg = workCtx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
        tempImg.data[i * 4] = 255;
        tempImg.data[i * 4 + 1] = 255;
        tempImg.data[i * 4 + 2] = 255;
        tempImg.data[i * 4 + 3] = limpia[i];
    }
    workCtx.putImageData(tempImg, 0, 0);

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const ladoCaja = Math.max(bw, bh);
    const escala = 22 / ladoCaja;
    const dw = Math.max(1, bw * escala);
    const dh = Math.max(1, bh * escala);
    const dx = (28 - dw) / 2;
    const dy = (28 - dh) / 2;

    outCtx.clearRect(0, 0, 28, 28);
    outCtx.drawImage(workCanvas, minX, minY, bw, bh, dx, dy, dw, dh);

    const outData = outCtx.getImageData(0, 0, 28, 28).data;
    const pixeles = new Array(784);
    let maxP = 0;
    for (let i = 0; i < 784; i++) {
        const v = outData[i * 4 + 3];
        pixeles[i] = v;
        if (v > maxP) maxP = v;
    }
    if (maxP > 0) {
        for (let i = 0; i < 784; i++) {
            pixeles[i] = Math.min(255, Math.round((pixeles[i] / maxP) * 255));
        }
    }

    return { pixeles, tieneDibujo: maxP > 25 };
}

// ---------------------------------------------------------------
// 4. Predicción en Tiempo Real y Sonificación / Voz
// ---------------------------------------------------------------

btnAudioTiempoReal.addEventListener("click", async () => {
    audioTiempoRealActivo = !audioTiempoRealActivo;
    btnAudioTiempoReal.setAttribute("aria-pressed", audioTiempoRealActivo ? "true" : "false");
    btnAudioTiempoReal.textContent = audioTiempoRealActivo
        ? "🔊 Audio / Voz: Activo"
        : "🔇 Audio / Voz: Off";

    if (audioTiempoRealActivo) {
        if (window.ModelosAudio) {
            await window.ModelosAudio.desbloquear();
            window.ModelosAudio.sonarSeleccion("CNN");
        }
        if ("speechSynthesis" in window) {
            const u = new SpeechSynthesisUtterance("Interpretación por voz activada");
            u.lang = "es-ES";
            window.speechSynthesis.speak(u);
        }
    }
});

function emitirFeedbackAudioVoz(predicciones) {
    if (!audioTiempoRealActivo || !predicciones) return;

    const cnn = predicciones.CNN;
    const mlp = predicciones.MLP;
    if (!cnn || !mlp) return;

    const ahora = Date.now();
    if (ahora - ultimoTiempoAnuncio < 2200) return;

    const coinciden = cnn.prediccion === mlp.prediccion;
    const mejor = cnn.confianza >= mlp.confianza ? cnn : mlp;
    const textoVoz = coinciden
        ? `Es un ${cnn.etiqueta}`
        : `CNN ve ${cnn.etiqueta} y MLP ve ${mlp.etiqueta}`;

    if (textoVoz === ultimoAnimalAnunciado && ahora - ultimoTiempoAnuncio < 4500) return;

    ultimoAnimalAnunciado = textoVoz;
    ultimoTiempoAnuncio = ahora;

    if (window.ModelosAudio) {
        window.ModelosAudio.sonarHover(
            cnn.confianza >= mlp.confianza ? "CNN" : "MLP",
            mejor.confianza
        );
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(textoVoz);
        u.lang = "es-ES";
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
    }
}

function actualizarPanelTiempoReal(predicciones, tieneDibujo) {
    ultimasPrediccionesVivas = tieneDibujo ? predicciones : null;

    if (!tieneDibujo || !predicciones) {
        estadoDeteccionTrazo.textContent = "Sin trazos detectados";
        estadoDeteccionTrazo.className = "estado-trazo";

        bannerVeredictoVivo.className = "banner-veredicto esperando";
        iconoVeredictoVivo.textContent = "🔍";
        tituloVeredictoVivo.textContent = "Esperando un dibujo de gato o perro...";
        detalleVeredictoVivo.textContent =
            "Enfoca un dibujo oscuro sobre papel blanco o traza en el lienzo para ver la predicción instantánea.";

        confianzaVivoCnn.textContent = "—";
        imgAnimalCnn.hidden = true;
        etiquetaVivoCnn.textContent = "Esperando dibujo…";
        probGatoCnn.textContent = "50%";
        probPerroCnn.textContent = "50%";
        barraPerroCnn.style.width = "50%";

        confianzaVivoMlp.textContent = "—";
        imgAnimalMlp.hidden = true;
        etiquetaVivoMlp.textContent = "Esperando dibujo…";
        probGatoMlp.textContent = "50%";
        probPerroMlp.textContent = "50%";
        barraPerroMlp.style.width = "50%";
        return;
    }

    estadoDeteccionTrazo.textContent = "✓ Dibujo detectado (28×28)";
    estadoDeteccionTrazo.className = "estado-trazo activo";

    const cnn = predicciones.CNN;
    const mlp = predicciones.MLP;

    if (cnn) {
        const pctConf = (cnn.confianza * 100).toFixed(1).replace(".", ",");
        const pctPerro = Math.round(cnn.prob_perro * 100);
        const pctGato = 100 - pctPerro;

        confianzaVivoCnn.textContent = `${pctConf}% seguridad`;
        imgAnimalCnn.src = ICONOS_ANIMAL[cnn.prediccion] || ICONOS_ANIMAL[0];
        imgAnimalCnn.hidden = false;
        etiquetaVivoCnn.textContent = cnn.etiqueta;
        probGatoCnn.textContent = `${pctGato}%`;
        probPerroCnn.textContent = `${pctPerro}%`;
        barraPerroCnn.style.width = `${pctPerro}%`;
    }

    if (mlp) {
        const pctConf = (mlp.confianza * 100).toFixed(1).replace(".", ",");
        const pctPerro = Math.round(mlp.prob_perro * 100);
        const pctGato = 100 - pctPerro;

        confianzaVivoMlp.textContent = `${pctConf}% seguridad`;
        imgAnimalMlp.src = ICONOS_ANIMAL[mlp.prediccion] || ICONOS_ANIMAL[0];
        imgAnimalMlp.hidden = false;
        etiquetaVivoMlp.textContent = mlp.etiqueta;
        probGatoMlp.textContent = `${pctGato}%`;
        probPerroMlp.textContent = `${pctPerro}%`;
        barraPerroMlp.style.width = `${pctPerro}%`;
    }

    if (cnn && mlp) {
        if (cnn.prediccion === mlp.prediccion) {
            const esPerro = cnn.prediccion === 1;
            const promedioConf = (((cnn.confianza + mlp.confianza) / 2) * 100)
                .toFixed(1)
                .replace(".", ",");
            bannerVeredictoVivo.className = "banner-veredicto consenso";
            iconoVeredictoVivo.textContent = esPerro ? "🐶" : "🐱";
            tituloVeredictoVivo.textContent = `¡Ambos modelos ven un ${cnn.etiqueta.toUpperCase()}!`;
            detalleVeredictoVivo.textContent = `Consenso entre CNN y MLP con ${promedioConf}% de confianza promedio.`;
        } else {
            bannerVeredictoVivo.className = "banner-veredicto discrepancia";
            iconoVeredictoVivo.textContent = "🤔";
            tituloVeredictoVivo.textContent = `Modelos divididos: CNN ve ${cnn.etiqueta} · MLP ve ${mlp.etiqueta}`;
            detalleVeredictoVivo.textContent =
                "La CNN analiza bordes espaciales (orejas/hocico), mientras que el MLP evalúa la posición global de los píxeles.";
        }
        emitirFeedbackAudioVoz(predicciones);
    }
}

async function solicitarPrediccionIndividual(pixeles) {
    const urls = [
        "/api/test_1/predecir",
        "http://localhost:8000/api/test_1/predecir",
        "http://127.0.0.1:8000/api/test_1/predecir"
    ];

    for (const url of urls) {
        try {
            const resp = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imagen: pixeles })
            });
            if (resp.ok) {
                return await resp.json();
            }
        } catch (e) {
            // Intentar siguiente URL
        }
    }
    return null;
}

// ---------------------------------------------------------------
// 5. Cámara local y subida de foto en la pantalla principal
// ---------------------------------------------------------------

sliderUmbralLocal.addEventListener("input", () => {
    valorUmbralLocal.textContent = sliderUmbralLocal.value;
    if (fuenteCamara === "foto") {
        procesarFrameLocal();
    }
});

btnCalibrarLocal.addEventListener("click", () => {
    if (fuenteCamara === "local" || fuenteCamara === "foto") {
        extraer28x28DesdeCamaraLocal(true);
        mostrarMensaje("Fondo de papel calibrado correctamente.", "exito");
    } else {
        mostrarMensaje("Activa primero la cámara de este dispositivo o usa el botón de calibrar en tu teléfono.", "info");
    }
});

async function activarCamaraLocal() {
    if (streamLocal) {
        streamLocal.getTracks().forEach((t) => t.stop());
    }

    try {
        streamLocal = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: { ideal: usandoCamaraFrontalLocal ? "user" : "environment" },
                width: { ideal: 480 },
                height: { ideal: 480 }
            }
        });
        videoLocal.srcObject = streamLocal;
        await videoLocal.play();

        fuenteCamara = "local";
        camaraLocalCongelada = false;
        videoLocal.hidden = false;
        imgFotoLocal.hidden = true;
        overlayRecuadroLocal.hidden = false;
        placeholderSensorRemoto.hidden = true;

        btnCambiarCamaraLocal.hidden = false;
        btnCongelarLocal.hidden = false;
        btnCongelarLocal.textContent = "⏸️ Congelar";
        btnCamaraLocal.textContent = "⏹️ Detener cámara local";
        insigniaFuenteActiva.textContent = "🎥 Cámara Local Activa";
        mostrarMensaje("Cámara activada. Muestra un dibujo de gato o perro frente al recuadro.", "exito");
    } catch (err) {
        console.warn("No se pudo iniciar cámara local:", err);
        mostrarMensaje(
            "No se pudo acceder a la cámara local. Puedes conectar tu teléfono con el QR o subir una foto.",
            "error"
        );
    }
}

function detenerCamaraLocal() {
    if (streamLocal) {
        streamLocal.getTracks().forEach((t) => t.stop());
        streamLocal = null;
    }
    fuenteCamara = "remota";
    videoLocal.hidden = true;
    imgFotoLocal.hidden = true;
    overlayRecuadroLocal.hidden = true;
    placeholderSensorRemoto.hidden = false;
    btnCambiarCamaraLocal.hidden = true;
    btnCongelarLocal.hidden = true;
    btnCamaraLocal.textContent = "🎥 Usar cámara de este dispositivo";
    insigniaFuenteActiva.textContent = "📱 Sensor de Cámara Activo";
}

btnCamaraLocal.addEventListener("click", () => {
    if (fuenteCamara === "local") {
        detenerCamaraLocal();
    } else {
        activarCamaraLocal();
    }
});

btnCambiarCamaraLocal.addEventListener("click", () => {
    usandoCamaraFrontalLocal = !usandoCamaraFrontalLocal;
    mapaPapelLocal = null;
    activarCamaraLocal();
});

btnCongelarLocal.addEventListener("click", () => {
    camaraLocalCongelada = !camaraLocalCongelada;
    if (camaraLocalCongelada) {
        videoLocal.pause();
        btnCongelarLocal.textContent = "▶️ Reanudar";
    } else {
        videoLocal.play();
        btnCongelarLocal.textContent = "⏸️ Congelar";
    }
});

btnSubirFotoLocal.addEventListener("click", () => {
    inputFotoLocal.click();
});

inputFotoLocal.addEventListener("change", (e) => {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;

    if (streamLocal) {
        streamLocal.getTracks().forEach((t) => t.stop());
        streamLocal = null;
    }

    const url = URL.createObjectURL(archivo);
    imgFotoLocal.onload = () => {
        fuenteCamara = "foto";
        videoLocal.hidden = true;
        imgFotoLocal.hidden = false;
        overlayRecuadroLocal.hidden = false;
        placeholderSensorRemoto.hidden = true;
        btnCambiarCamaraLocal.hidden = true;
        btnCongelarLocal.hidden = true;
        btnCamaraLocal.textContent = "🎥 Usar cámara de este dispositivo";
        insigniaFuenteActiva.textContent = "📷 Foto Cargada";
        procesarFrameLocal();
        mostrarMensaje("Foto cargada y analizada en tiempo real.", "exito");
    };
    imgFotoLocal.src = url;
});

async function procesarFrameLocal() {
    if (modoEntrada !== "camara" || (fuenteCamara !== "local" && fuenteCamara !== "foto")) return;
    if (fuenteCamara === "local" && camaraLocalCongelada) return;
    if (peticionEnCurso) return;

    const { pixeles, tieneDibujo } = extraer28x28DesdeCamaraLocal(false);
    pixelesActuales = pixeles;
    hayDibujoActual = tieneDibujo;
    pintarMiniatura28x28(canvasVista28, pixeles);

    if (!tieneDibujo) {
        actualizarPanelTiempoReal(null, false);
        return;
    }

    peticionEnCurso = true;
    try {
        const res = await solicitarPrediccionIndividual(pixeles);
        if (res && res.predicciones) {
            actualizarPanelTiempoReal(res.predicciones, true);
        }
    } finally {
        peticionEnCurso = false;
    }
}

// ---------------------------------------------------------------
// 6. Recepción en tiempo real desde el teléfono (Protobject + API)
// ---------------------------------------------------------------

function marcarTelefonoConectado(activo) {
    puntoConexionRemota.className = activo ? "punto-sensor conectado" : "punto-sensor desconectado";
    estadoConexionRemota.textContent = activo
        ? "📱 Teléfono conectado transmitiendo en tiempo real"
        : "Conecta tu teléfono como sensor de cámara";

    if (activo && fuenteCamara === "remota") {
        tituloPlaceholderSensor.textContent = "📡 Recibiendo cámara del teléfono en vivo";
        subtituloPlaceholderSensor.textContent =
            "Observa la matriz 28 × 28 a la derecha y el veredicto instantáneo de CNN y MLP mientras mueves tu dibujo.";
    }
}

function guardarMuestraEnLista(pixeles, etiqueta, origenTexto = "Imagen") {
    muestrasGuardadas.push({
        pixeles: [...pixeles],
        etiqueta,
        prediccionesVivas: ultimasPrediccionesVivas ? JSON.parse(JSON.stringify(ultimasPrediccionesVivas)) : null
    });
    actualizarInterfazGuardados();

    const total = muestrasGuardadas.length;
    const faltan = Math.max(0, MINIMO_IMAGENES - total);
    if (faltan > 0) {
        mostrarMensaje(
            `${origenTexto} #${total} guardada (${ETIQUETAS[etiqueta]}). Te faltan ${faltan} más como mínimo.`,
            "exito"
        );
    } else {
        mostrarMensaje(
            `${origenTexto} #${total} guardada (${ETIQUETAS[etiqueta]}). ¡Ya puedes presionar «Evaluar lote con modelos»!`,
            "exito"
        );
    }
}

// 6.1 Recepción directa vía Protobject WebRTC (cuando se usa en GitHub Pages o red local)
if (typeof Protobject !== "undefined" && Protobject.Core && Protobject.Core.onReceived) {
    Protobject.Core.onReceived(async (mensaje) => {
        if (!mensaje || mensaje.tipo !== "frame_camara" || !Array.isArray(mensaje.pixeles)) return;
        if (modoEntrada !== "camara" || fuenteCamara !== "remota") return;

        ultimoTimestampRemoto = Date.now() / 1000;
        marcarTelefonoConectado(true);

        pixelesActuales = mensaje.pixeles;
        hayDibujoActual = Boolean(mensaje.tiene_dibujo);
        pintarMiniatura28x28(canvasVista28, pixelesActuales);

        if (hayDibujoActual && !peticionEnCurso) {
            peticionEnCurso = true;
            try {
                const res = await solicitarPrediccionIndividual(pixelesActuales);
                if (res && res.predicciones) {
                    actualizarPanelTiempoReal(res.predicciones, true);
                    if (Protobject.Core.send) {
                        Protobject.Core.send({
                            tipo: "veredicto_modelos",
                            predicciones: res.predicciones,
                            tiene_dibujo: true
                        }).to("sensor_camara.html");
                    }
                }
            } finally {
                peticionEnCurso = false;
            }
        } else if (!hayDibujoActual) {
            actualizarPanelTiempoReal(null, false);
        }

        if (mensaje.capturar && hayDibujoActual && (mensaje.etiqueta === 0 || mensaje.etiqueta === 1)) {
            guardarMuestraEnLista(pixelesActuales, Number(mensaje.etiqueta), "Captura desde teléfono");
        }
    });
}

// 6.2 Sincronización con el puente local en Python (/api/camara/estado)
async function sincronizarEstadoCamaraRemota() {
    if (modoEntrada !== "camara" || fuenteCamara !== "remota") return;

    try {
        const resp = await fetch("/api/camara/estado");
        if (!resp.ok) return;
        const estado = await resp.json();

        const ahora = Date.now() / 1000;
        const conectadoReciente = estado.timestamp > 0 && (ahora - estado.timestamp) < 6;
        marcarTelefonoConectado(conectadoReciente);

        if (estado.timestamp > ultimoTimestampRemoto) {
            ultimoTimestampRemoto = estado.timestamp;
            pixelesActuales = estado.pixeles || new Array(784).fill(0);
            hayDibujoActual = Boolean(estado.tiene_dibujo);
            pintarMiniatura28x28(canvasVista28, pixelesActuales);
            actualizarPanelTiempoReal(estado.predicciones, hayDibujoActual);
        }

        if (
            estado.solicitud_captura &&
            estado.solicitud_captura > ultimoIdCapturaRemota &&
            estado.tiene_dibujo &&
            (estado.etiqueta_captura === 0 || estado.etiqueta_captura === 1)
        ) {
            ultimoIdCapturaRemota = estado.solicitud_captura;
            guardarMuestraEnLista(
                estado.pixeles,
                Number(estado.etiqueta_captura),
                "Captura desde teléfono"
            );
        }
    } catch (e) {
        // Sin servidor local activo
    }
}

setInterval(() => {
    if (modoEntrada === "camara") {
        if (fuenteCamara === "local") {
            procesarFrameLocal();
        } else if (fuenteCamara === "remota") {
            sincronizarEstadoCamaraRemota();
        }
    }
}, 240);

// ---------------------------------------------------------------
// 7. Configuración de dibujo en el lienzo (280 x 280) + Tiempo Real
// ---------------------------------------------------------------

function configurarPincel() {
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "black";
}

configurarPincel();

function obtenerPosicion(evento) {
    const rect = canvas.getBoundingClientRect();
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;

    if (evento.touches && evento.touches.length > 0) {
        return {
            x: (evento.touches[0].clientX - rect.left) * escalaX,
            y: (evento.touches[0].clientY - rect.top) * escalaY
        };
    }

    return {
        x: (evento.clientX - rect.left) * escalaX,
        y: (evento.clientY - rect.top) * escalaY
    };
}

function actualizarDesdeLienzo() {
    if (!tieneTrazos) {
        pixelesActuales = new Array(784).fill(0);
        hayDibujoActual = false;
        pintarMiniatura28x28(canvasVista28, pixelesActuales);
        actualizarPanelTiempoReal(null, false);
        return;
    }

    const pixeles = extraerPixeles28x28();
    const maxP = Math.max(...pixeles);
    pixelesActuales = pixeles;
    hayDibujoActual = maxP > 0;
    pintarMiniatura28x28(canvasVista28, pixeles);

    if (!hayDibujoActual) {
        actualizarPanelTiempoReal(null, false);
        return;
    }

    if (timerPrediccionLienzo) clearTimeout(timerPrediccionLienzo);
    timerPrediccionLienzo = setTimeout(async () => {
        const res = await solicitarPrediccionIndividual(pixeles);
        if (res && res.predicciones && modoEntrada === "lienzo") {
            actualizarPanelTiempoReal(res.predicciones, true);
        }
    }, 150);
}

function iniciarTrazo(evento) {
    dibujando = true;
    tieneTrazos = true;
    configurarPincel();

    const { x, y } = obtenerPosicion(evento);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    actualizarDesdeLienzo();
}

function moverTrazo(evento) {
    if (!dibujando) return;

    const { x, y } = obtenerPosicion(evento);
    ctx.lineTo(x, y);
    ctx.stroke();
    actualizarDesdeLienzo();
}

function finalizarTrazo() {
    if (!dibujando) return;
    dibujando = false;
    actualizarDesdeLienzo();
}

canvas.addEventListener("mousedown", iniciarTrazo);
canvas.addEventListener("mousemove", moverTrazo);
canvas.addEventListener("mouseup", finalizarTrazo);
canvas.addEventListener("mouseleave", finalizarTrazo);

canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    iniciarTrazo(e);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    moverTrazo(e);
}, { passive: false });

canvas.addEventListener("touchend", finalizarTrazo);

function limpiarCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    tieneTrazos = false;
    pixelesActuales = new Array(784).fill(0);
    hayDibujoActual = false;
    pintarMiniatura28x28(canvasVista28, pixelesActuales);
    actualizarPanelTiempoReal(null, false);
}

btnLimpiar.addEventListener("click", () => {
    limpiarCanvas();
    if (modoEntrada === "camara" && fuenteCamara === "foto") {
        detenerCamaraLocal();
    }
    mostrarMensaje("Vista reiniciada.", "info");
});

// ---------------------------------------------------------------
// 8. Selección de etiqueta y guardado de imágenes (28 x 28 = 784 px)
// ---------------------------------------------------------------

botonesEtiqueta.forEach((boton) => {
    boton.addEventListener("click", () => {
        etiquetaSeleccionada = Number(boton.dataset.etiqueta);

        botonesEtiqueta.forEach((b) => {
            const activo = b === boton;
            b.classList.toggle("seleccionada", activo);
            b.setAttribute("aria-pressed", activo ? "true" : "false");
        });

        mostrarMensaje(`Etiqueta seleccionada: ${ETIQUETAS[etiquetaSeleccionada]}`, "info");
    });
});

function mostrarMensaje(texto, tipo = "info") {
    mensajeEstado.textContent = texto;
    mensajeEstado.dataset.tipo = tipo;
}

function actualizarInterfazGuardados() {
    const total = muestrasGuardadas.length;
    const listo = total >= MINIMO_IMAGENES;

    contadorGuardados.textContent = listo
        ? `${total} imágenes guardadas (listo para evaluar)`
        : `${total} / ${MINIMO_IMAGENES} imágenes mínimas`;
    contadorGuardados.classList.toggle("completo", listo);

    btnPredecir.disabled = !listo;
    btnPredecir.textContent = listo
        ? `Evaluar lote con modelos (${total} imágenes)`
        : `Evaluar lote con modelos (${total}/${MINIMO_IMAGENES})`;

    btnVaciar.disabled = total === 0;

    if (total === 0) {
        listaGuardados.innerHTML =
            '<p class="texto-vacio">Aún no has guardado ningún dibujo. Puedes capturarlos con la cámara o dibujarlos en el lienzo (mínimo 5 para la evaluación completa).</p>';
        return;
    }

    listaGuardados.innerHTML = "";

    muestrasGuardadas.forEach((muestra, indice) => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "item-guardado";

        const miniatura = document.createElement("canvas");
        pintarMiniatura28x28(miniatura, muestra.pixeles);

        const info = document.createElement("div");
        info.className = "item-guardado-info";
        info.innerHTML = `
            <span class="item-numero">#${indice + 1}</span>
            <strong class="item-etiqueta">${ETIQUETAS[muestra.etiqueta]}</strong>
        `;

        const btnEliminar = document.createElement("button");
        btnEliminar.type = "button";
        btnEliminar.className = "btn-eliminar-item";
        btnEliminar.title = `Eliminar dibujo #${indice + 1}`;
        btnEliminar.setAttribute("aria-label", `Eliminar dibujo #${indice + 1}`);
        btnEliminar.textContent = "×";
        btnEliminar.addEventListener("click", () => {
            muestrasGuardadas.splice(indice, 1);
            actualizarInterfazGuardados();
            mostrarMensaje(`Dibujo #${indice + 1} eliminado.`, "info");
        });

        tarjeta.appendChild(btnEliminar);
        tarjeta.appendChild(miniatura);
        tarjeta.appendChild(info);
        listaGuardados.appendChild(tarjeta);
    });
}

btnGuardar.addEventListener("click", () => {
    const pixelesAGuardar =
        modoEntrada === "lienzo" ? extraerPixeles28x28() : pixelesActuales;
    const maxPixel = Math.max(...pixelesAGuardar);

    if (maxPixel === 0) {
        mostrarMensaje(
            modoEntrada === "camara"
                ? "No se detecta un dibujo en la cámara todavía. Enfoca un dibujo oscuro sobre papel claro antes de guardar."
                : "Dibuja algo en el recuadro antes de guardar la imagen.",
            "error"
        );
        return;
    }

    if (etiquetaSeleccionada === null) {
        mostrarMensaje("Selecciona qué animal es realmente (Gato o Perro) antes de guardar.", "error");
        return;
    }

    guardarMuestraEnLista(
        pixelesAGuardar,
        etiquetaSeleccionada,
        modoEntrada === "camara" ? "Captura de cámara" : "Imagen"
    );

    if (modoEntrada === "lienzo") {
        limpiarCanvas();
    }
});

btnVaciar.addEventListener("click", () => {
    muestrasGuardadas.length = 0;
    panelResultados.hidden = true;
    actualizarInterfazGuardados();
    mostrarMensaje("Se vació la lista de imágenes guardadas.", "info");
});

btnNuevaPrueba.addEventListener("click", () => {
    muestrasGuardadas.length = 0;
    limpiarCanvas();
    panelResultados.hidden = true;
    actualizarInterfazGuardados();
    mostrarMensaje("Lista reiniciada. Captura o dibuja al menos 5 imágenes para una nueva prueba.", "info");
    window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------------------------------------------------------------
// 9. Evaluación por lote en la API de Python y métricas globales
// ---------------------------------------------------------------

async function enviarAPythonAPI(imagenes, etiquetas) {
    const opciones = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenes, etiquetas })
    };

    const urls = [
        "/api/test_1",
        "http://localhost:8000/api/test_1",
        "http://127.0.0.1:8000/api/test_1"
    ];

    let ultimoError = null;

    for (const url of urls) {
        try {
            const respuesta = await fetch(url, opciones);
            if (respuesta.ok) {
                return await respuesta.json();
            }

            if (respuesta.status !== 404 && respuesta.status !== 405) {
                const contentType = respuesta.headers.get("content-type") || "";
                if (contentType.includes("application/json")) {
                    const datosError = await respuesta.json();
                    throw new Error(datosError.error || `Error ${respuesta.status}`);
                }
            }
            ultimoError = new Error(`Servidor respondió con estado ${respuesta.status}`);
        } catch (err) {
            ultimoError = err;
        }
    }

    throw ultimoError || new Error("No se pudo conectar con la API local de Python.");
}

function formatearPorcentaje(valor) {
    return `${(valor * 100).toFixed(1).replace(".", ",")}%`;
}

function renderizarResultados(resultados) {
    const { etiquetas_reales, predicciones, metricas } = resultados;
    const modelos = Object.keys(predicciones);

    // 1. Grilla de predicciones por imagen
    grillaPredicciones.innerHTML = "";

    const cabecera = grillaPredicciones.createTHead().insertRow();
    const esquina = document.createElement("th");
    esquina.textContent = "Dibujo real →";
    esquina.className = "fila-modelo";
    cabecera.appendChild(esquina);

    muestrasGuardadas.forEach((muestra, i) => {
        const th = document.createElement("th");
        const miniCanvas = document.createElement("canvas");
        pintarMiniatura28x28(miniCanvas, muestra.pixeles);
        th.appendChild(miniCanvas);
        const textoReal = ETIQUETAS[etiquetas_reales[i]] || ETIQUETAS[muestra.etiqueta];
        th.appendChild(document.createTextNode(`#${i + 1} ${textoReal}`));
        cabecera.appendChild(th);
    });

    const cuerpo = grillaPredicciones.createTBody();

    modelos.forEach((modelo) => {
        const preds = predicciones[modelo];
        const aciertos = preds.filter((p, i) => p === etiquetas_reales[i]).length;
        const color = COLORES_MODELO[modelo] || "var(--acento)";

        const fila = cuerpo.insertRow();
        const th = document.createElement("th");
        th.className = "fila-modelo";
        th.innerHTML = `
            <span class="muestra-modelo" style="background:${color}"></span>${modelo}
            <span class="aciertos">${aciertos}/${preds.length} aciertos</span>
        `;
        fila.appendChild(th);

        preds.forEach((pred, i) => {
            const real = etiquetas_reales[i];
            const esCorrecta = pred === real;
            const tipo = esCorrecta ? "correcta" : "incorrecta";
            const icono = esCorrecta ? "✓" : "✗";

            const celda = fila.insertCell();
            celda.className = `celda ${tipo}`;

            const miniCanvas = document.createElement("canvas");
            pintarMiniatura28x28(miniCanvas, muestrasGuardadas[i].pixeles);
            celda.appendChild(miniCanvas);

            const veredicto = document.createElement("span");
            veredicto.className = "veredicto";
            veredicto.textContent = `${icono} ${ETIQUETAS[pred] ?? pred}`;
            celda.appendChild(veredicto);
        });
    });

    // 2. Rendimiento general (Tarjetas y tabla de métricas de GatosPerrosPredictor.evaluar)
    resumenMetricas.innerHTML = modelos.map((modelo) => {
        const m = metricas[modelo];
        const preds = predicciones[modelo];
        const aciertos = preds.filter((p, i) => p === etiquetas_reales[i]).length;
        const color = COLORES_MODELO[modelo] || "var(--acento)";

        return `
            <article class="tarjeta-metrica-modelo">
                <div class="cabecera-metrica-modelo">
                    <h4>
                        <span class="muestra-modelo" style="background:${color}"></span>
                        Modelo ${modelo}
                    </h4>
                    <span class="resumen-aciertos">${aciertos} / ${etiquetas_reales.length} aciertos</span>
                </div>
                <div class="barra-rendimiento-contenedor">
                    <div class="barra-rendimiento-relleno" style="width:${(m.accuracy * 100).toFixed(1)}%; background:${color}"></div>
                </div>
                <dl class="lista-metricas-modelo">
                    <div>
                        <dt>Accuracy</dt>
                        <dd>${formatearPorcentaje(m.accuracy)}</dd>
                    </div>
                    <div>
                        <dt>Precisión</dt>
                        <dd>${formatearPorcentaje(m.precision)}</dd>
                    </div>
                    <div>
                        <dt>Recall</dt>
                        <dd>${formatearPorcentaje(m.recall)}</dd>
                    </div>
                    <div>
                        <dt>F1-Score</dt>
                        <dd>${formatearPorcentaje(m.f1_score)}</dd>
                    </div>
                </dl>
            </article>
        `;
    }).join("");

    tablaMetricasCuerpo.innerHTML = modelos.map((modelo) => {
        const m = metricas[modelo];
        return `
            <tr>
                <td><strong>${modelo}</strong></td>
                <td>${formatearPorcentaje(m.accuracy)}</td>
                <td>${formatearPorcentaje(m.precision)}</td>
                <td>${formatearPorcentaje(m.recall)}</td>
                <td>${formatearPorcentaje(m.f1_score)}</td>
            </tr>
        `;
    }).join("");

    panelResultados.hidden = false;
    panelResultados.scrollIntoView({ behavior: "smooth", block: "start" });
}

btnPredecir.addEventListener("click", async () => {
    if (muestrasGuardadas.length < MINIMO_IMAGENES) {
        mostrarMensaje(`Debes guardar al menos ${MINIMO_IMAGENES} imágenes antes de evaluar.`, "error");
        return;
    }

    const imagenes = muestrasGuardadas.map((m) => m.pixeles);
    const etiquetas = muestrasGuardadas.map((m) => m.etiqueta);

    btnPredecir.disabled = true;
    btnGuardar.disabled = true;
    mostrarMensaje("Enviando imágenes a la API local de Python...", "info");

    try {
        const resultados = await enviarAPythonAPI(imagenes, etiquetas);
        renderizarResultados(resultados);
        mostrarMensaje("Evaluación por lote completada con éxito.", "exito");
    } catch (error) {
        console.error("Error al predecir:", error);
        mostrarMensaje(
            `No se pudo obtener la predicción: ${error.message}. Asegúrate de iniciar la API con: python -m api.main`,
            "error"
        );
    } finally {
        btnGuardar.disabled = false;
        btnPredecir.disabled = muestrasGuardadas.length < MINIMO_IMAGENES;
    }
});

// Inicializar vista previa 28x28 en blanco al cargar
pintarMiniatura28x28(canvasVista28, pixelesActuales);
