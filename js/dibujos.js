const MINIMO_IMAGENES = 5;
const ETIQUETAS = {
    0: "Gato",
    1: "Perro"
};
const COLORES_MODELO = {
    CNN: "#2a78d6",
    MLP: "#1baf7a"
};

const canvas = document.getElementById("canvas-dibujo");
const ctx = canvas.getContext("2d");

const btnLimpiar = document.getElementById("btn-limpiar");
const btnGuardar = document.getElementById("btn-guardar");
const btnPredecir = document.getElementById("btn-predecir");
const btnVaciar = document.getElementById("btn-vaciar");
const btnNuevaPrueba = document.getElementById("btn-nueva-prueba");
const botonesEtiqueta = document.querySelectorAll(".btn-etiqueta");

const contadorGuardados = document.getElementById("contador-guardados");
const mensajeEstado = document.getElementById("mensaje-estado");
const listaGuardados = document.getElementById("lista-guardados");
const panelResultados = document.getElementById("panel-resultados");
const resumenMetricas = document.getElementById("resumen-metricas");
const tablaMetricasCuerpo = document.getElementById("tabla-metricas-cuerpo");
const grillaPredicciones = document.getElementById("grilla-predicciones");

let dibujando = false;
let tieneTrazos = false;
let etiquetaSeleccionada = null;
const muestrasGuardadas = [];

// ---------------------------------------------------------------
// Configuración de dibujo en el canvas (280 x 280)
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

function iniciarTrazo(evento) {
    dibujando = true;
    tieneTrazos = true;
    configurarPincel();

    const { x, y } = obtenerPosicion(evento);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
}

function moverTrazo(evento) {
    if (!dibujando) return;

    const { x, y } = obtenerPosicion(evento);
    ctx.lineTo(x, y);
    ctx.stroke();
}

function finalizarTrazo() {
    dibujando = false;
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
}

btnLimpiar.addEventListener("click", () => {
    limpiarCanvas();
    mostrarMensaje("Lienzo limpio.", "info");
});

// ---------------------------------------------------------------
// Selección de etiqueta y guardado de imágenes (28 x 28 = 784 px)
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

function extraerPixeles28x28() {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 28;
    tempCanvas.height = 28;
    const tempCtx = tempCanvas.getContext("2d");

    tempCtx.drawImage(canvas, 0, 0, 28, 28);
    const { data } = tempCtx.getImageData(0, 0, 28, 28);

    const pixeles = new Array(784);
    let maxValor = 0;

    for (let i = 0; i < 784; i++) {
        const intensidad = data[i * 4 + 3];
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

function pintarMiniatura28x28(destinoCanvas, pixeles) {
    destinoCanvas.width = 28;
    destinoCanvas.height = 28;
    const c = destinoCanvas.getContext("2d");
    const imgData = c.createImageData(28, 28);

    for (let i = 0; i < 784; i++) {
        const v = 255 - pixeles[i];
        imgData.data[i * 4] = v;
        imgData.data[i * 4 + 1] = v;
        imgData.data[i * 4 + 2] = v;
        imgData.data[i * 4 + 3] = 255;
    }

    c.putImageData(imgData, 0, 0);
}

function mostrarMensaje(texto, tipo = "info") {
    mensajeEstado.textContent = texto;
    mensajeEstado.dataset.tipo = tipo;
}

function actualizarInterfazGuardados() {
    const total = muestrasGuardadas.length;
    const listo = total >= MINIMO_IMAGENES;

    contadorGuardados.textContent = listo
        ? `${total} imágenes guardadas (listo para predecir)`
        : `${total} / ${MINIMO_IMAGENES} imágenes mínimas`;
    contadorGuardados.classList.toggle("completo", listo);

    btnPredecir.disabled = !listo;
    btnPredecir.textContent = listo
        ? `Predecir con modelos (${total} imágenes)`
        : `Predecir con modelos (${total}/${MINIMO_IMAGENES})`;

    btnVaciar.disabled = total === 0;

    if (total === 0) {
        listaGuardados.innerHTML =
            '<p class="texto-vacio">Aún no has guardado ningún dibujo. Guarda al menos 5 para habilitar la predicción.</p>';
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
    if (!tieneTrazos) {
        mostrarMensaje("Dibuja algo en el recuadro antes de guardar la imagen.", "error");
        return;
    }

    if (etiquetaSeleccionada === null) {
        mostrarMensaje("Selecciona qué dibujaste (Gato o Perro) antes de guardar.", "error");
        return;
    }

    const pixeles = extraerPixeles28x28();
    const maxPixel = Math.max(...pixeles);

    if (maxPixel === 0) {
        mostrarMensaje("El dibujo está vacío. Realiza un trazo más visible.", "error");
        return;
    }

    muestrasGuardadas.push({
        pixeles,
        etiqueta: etiquetaSeleccionada
    });

    limpiarCanvas();
    actualizarInterfazGuardados();

    const total = muestrasGuardadas.length;
    const faltan = Math.max(0, MINIMO_IMAGENES - total);
    if (faltan > 0) {
        mostrarMensaje(
            `Imagen #${total} guardada (${ETIQUETAS[etiquetaSeleccionada]}). Te faltan ${faltan} más como mínimo.`,
            "exito"
        );
    } else {
        mostrarMensaje(
            `Imagen #${total} guardada (${ETIQUETAS[etiquetaSeleccionada]}). ¡Ya puedes presionar «Predecir con modelos» o seguir agregando dibujos!`,
            "exito"
        );
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
    mostrarMensaje("Lista reiniciada. Dibuja al menos 5 imágenes para una nueva prueba.", "info");
    window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------------------------------------------------------------
// Conexión con la API local de Python y visualización de resultados
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
        mostrarMensaje(`Debes guardar al menos ${MINIMO_IMAGENES} imágenes antes de predecir.`, "error");
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
        mostrarMensaje("Predicción completada con éxito.", "exito");
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
