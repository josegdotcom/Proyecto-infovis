// Visualizacion: precision vs. tiempo de entrenamiento + aplausometro,
// y detalle de 10 dibujos individuales por modelo.

const RUTA_GLOBALES = "data/resultados/resultados_globales.csv";
const RUTA_INDIVIDUALES = "data/resultados/experimento_individual_resultados.csv";
const RUTA_DIBUJOS = "data/resultados/dibujos.json";

const AZAR = 0.5;

// Color y nombre corto por modelo (color fijo por entidad, nunca por ranking)
const MODELOS = {
    "SVM": { variable: "--modelo-svm", corto: "SVM" },
    "Random Forest": { variable: "--modelo-rf", corto: "Random Forest" },
    "Red neuronal MLP": { variable: "--modelo-mlp", corto: "Red neuronal MLP" },
    "HDBSCAN": { variable: "--modelo-hdbscan", corto: "HDBSCAN (no supervisado)" }
};

const estado = {
    globales: [],
    individuales: [],
    dibujos: null,
    seleccionado: null,
    reproduciendo: false,
    competencia: false
};

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------

function css(variable) {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

function colorModelo(nombre) {
    return css(MODELOS[nombre].variable);
}

function porcentaje(valor) {
    return `${(valor * 100).toFixed(1)}%`;
}

function segundos(valor) {
    if (valor < 0.01) {
        return `${(valor * 1000).toFixed(1)} ms`;
    }
    if (valor < 10) {
        return `${valor.toFixed(2)} s`;
    }
    return `${valor.toFixed(0)} s`;
}

function esperar(segundosEspera) {
    return new Promise(resolver => setTimeout(resolver, segundosEspera * 1000));
}

function leerCSV(texto) {
    const lineas = texto.trim().split(/\r?\n/);
    const columnas = lineas[0].split(",");

    return lineas.slice(1).map(linea => {
        const valores = linea.split(",");
        const fila = {};

        columnas.forEach((columna, i) => {
            const numero = Number(valores[i]);
            fila[columna] = Number.isNaN(numero) ? valores[i] : numero;
        });

        return fila;
    });
}

async function cargar(ruta, tipo) {
    const respuesta = await fetch(ruta);

    if (!respuesta.ok) {
        throw new Error(`No se pudo cargar ${ruta}`);
    }

    return tipo === "json" ? respuesta.json() : respuesta.text();
}

// ---------------------------------------------------------------
// 1. Overview: dispersion precision vs. tiempo de entrenamiento
// ---------------------------------------------------------------

function dibujarDispersion() {
    const texto = css("--texto-primario");
    const secundario = css("--texto-secundario");
    const tenue = css("--texto-tenue");
    const grilla = css("--grilla");
    const superficie = css("--superficie");

    const trazas = estado.globales.map(m => {
        const seleccionado = estado.seleccionado === m.modelo;

        return {
            type: "scatter",
            mode: "markers+text",
            name: MODELOS[m.modelo].corto,
            x: [m.tiempo_entrenamiento_s],
            y: [m.accuracy],
            text: [`${MODELOS[m.modelo].corto}<br>${porcentaje(m.accuracy)}`],
            // MLP y Random Forest quedan casi superpuestos: etiquetas arriba y abajo
            textposition: m.modelo === "Random Forest" ? "bottom center" : "top center",
            textfont: { color: texto, size: 12 },
            marker: {
                color: colorModelo(m.modelo),
                size: seleccionado ? 20 : 14,
                line: { color: seleccionado ? texto : superficie, width: 2 }
            },
            customdata: [[m.modelo, m.tiempo_prediccion_s]],
            hovertemplate:
                "<b>%{customdata[0]}</b><br>" +
                "Precisión: %{y:.1%}<br>" +
                "Entrenamiento: %{x:.1f} s<br>" +
                "Predicción de 3.000 dibujos: %{customdata[1]:.3f} s" +
                "<extra></extra>",
            cliponaxis: false
        };
    });

    const layout = {
        margin: { l: 56, r: 24, t: 16, b: 56 },
        paper_bgcolor: superficie,
        plot_bgcolor: superficie,
        font: { family: "system-ui, -apple-system, 'Segoe UI', sans-serif", color: secundario },
        showlegend: false,
        hoverlabel: { bgcolor: superficie, bordercolor: grilla, font: { color: texto } },
        xaxis: {
            title: { text: "Tiempo de entrenamiento (segundos, escala logarítmica)", font: { size: 12 } },
            type: "log",
            range: [0, 3],
            tickvals: [1, 3, 10, 30, 100, 300, 1000],
            ticktext: ["1", "3", "10", "30", "100", "300", "1.000"],
            gridcolor: grilla,
            zeroline: false,
            linecolor: css("--eje"),
            tickfont: { color: tenue }
        },
        yaxis: {
            title: { text: "Precisión en 3.000 dibujos de prueba", font: { size: 12 } },
            range: [0, 1.05],
            tickformat: ".0%",
            dtick: 0.25,
            gridcolor: grilla,
            zeroline: true,
            zerolinecolor: css("--eje"),
            tickfont: { color: tenue }
        },
        shapes: [
            {
                type: "line",
                xref: "paper",
                x0: 0,
                x1: 1,
                y0: AZAR,
                y1: AZAR,
                line: { color: tenue, width: 1.5, dash: "dash" }
            }
        ],
        annotations: [
            {
                xref: "paper",
                x: 1,
                y: AZAR,
                xanchor: "right",
                yanchor: "bottom",
                text: "Azar: 50% (lanzar una moneda)",
                showarrow: false,
                font: { color: tenue, size: 11 }
            },
            {
                xref: "paper",
                x: 0,
                y: 1.03,
                xanchor: "left",
                text: "↖ mejor: preciso y rápido",
                showarrow: false,
                font: { color: tenue, size: 11 }
            }
        ]
    };

    const config = { displayModeBar: false, responsive: true };

    const contenedor = document.getElementById("grafico-dispersion");

    Plotly.react(contenedor, trazas, layout, config);

    if (!contenedor.dataset.eventos) {
        contenedor.on("plotly_click", async evento => {
            const modelo = evento.points[0].customdata[0];
            await activarSonido();
            evaluarModelo(modelo);
        });
        contenedor.dataset.eventos = "1";
    }
}

function llenarTabla() {
    const cuerpo = document.getElementById("tabla-globales");

    cuerpo.innerHTML = estado.globales.map(m => `
        <tr>
            <td>${m.modelo}</td>
            <td>${porcentaje(m.accuracy)}</td>
            <td>${m.tiempo_entrenamiento_s.toFixed(2)}</td>
            <td>${m.tiempo_prediccion_s.toFixed(3)}</td>
        </tr>
    `).join("");
}

// ---------------------------------------------------------------
// Aplausometro (parte visual)
// ---------------------------------------------------------------

const LARGO_ARCO = Math.PI * 90;

function moverAguja(accuracy, color) {
    const aguja = document.getElementById("medidor-aguja");
    const arco = document.getElementById("medidor-arco");

    aguja.classList.remove("esperando");
    aguja.style.transform = `rotate(${-90 + accuracy * 180}deg)`;

    arco.style.opacity = 1;
    arco.style.stroke = color;
    arco.style.strokeDasharray = `${accuracy * LARGO_ARCO} 999`;
}

function reiniciarAguja() {
    const aguja = document.getElementById("medidor-aguja");
    const arco = document.getElementById("medidor-arco");

    aguja.style.transform = "";
    aguja.classList.add("esperando");
    arco.style.strokeDasharray = "0 999";
    arco.style.opacity = 0;
}

function textoVeredicto(accuracy) {
    if (accuracy < AZAR) {
        return "🦗 Grillos… peor que lanzar una moneda";
    }
    if (accuracy >= 0.83) {
        return "👏 ¡Ovación del público!";
    }
    return "👏 Aplausos";
}

async function activarSonido() {
    if (Aplausometro.estaListo()) {
        return;
    }

    await Aplausometro.activar();

    const boton = document.getElementById("btn-sonido");
    boton.textContent = "🔊 Sonido activado";
    boton.classList.add("activo");
    boton.disabled = true;
}

async function evaluarModelo(nombre, enCompetencia = false) {
    if (estado.reproduciendo || (estado.competencia && !enCompetencia)) {
        return;
    }

    const modelo = estado.globales.find(m => m.modelo === nombre);

    estado.seleccionado = nombre;
    estado.reproduciendo = true;
    dibujarDispersion();
    resaltarFila(nombre);

    document.getElementById("btn-competencia").disabled = true;
    document.getElementById("aplausometro-modelo").textContent = MODELOS[nombre].corto;
    document.getElementById("aplausometro-valor").textContent = "…";
    document.getElementById("aplausometro-estado").textContent =
        `🥁 Entrenando… (${segundos(modelo.tiempo_entrenamiento_s)})`;

    reiniciarAguja();

    let tiempos;

    if (Aplausometro.estaListo()) {
        tiempos = Aplausometro.evaluar(modelo);
    } else {
        // Sin sonido la animacion mantiene los mismos tiempos
        const redoble = Aplausometro.duracionRedoble(modelo.tiempo_entrenamiento_s);
        tiempos = { redoble, total: redoble + 1.5 };
    }

    await esperar(tiempos.redoble);

    moverAguja(modelo.accuracy, colorModelo(nombre));
    document.getElementById("aplausometro-valor").textContent = porcentaje(modelo.accuracy);
    document.getElementById("aplausometro-estado").textContent = textoVeredicto(modelo.accuracy);

    await esperar(Math.max(0, tiempos.total - tiempos.redoble));

    estado.reproduciendo = false;

    if (!estado.competencia) {
        document.getElementById("btn-competencia").disabled = false;
    }
}

async function competencia() {
    if (estado.reproduciendo || estado.competencia) {
        return;
    }

    estado.competencia = true;

    for (const modelo of estado.globales) {
        await evaluarModelo(modelo.modelo, true);
        await esperar(0.6);
    }

    estado.competencia = false;
    document.getElementById("btn-competencia").disabled = false;
}

// ---------------------------------------------------------------
// 2. Detalle: grilla de dibujos individuales
// ---------------------------------------------------------------

function pintarDibujo(canvas, pixeles) {
    canvas.width = 28;
    canvas.height = 28;

    const c = canvas.getContext("2d");
    const imagen = c.createImageData(28, 28);
    const tinta = css("--texto-primario");
    const fondo = css("--plano");

    const [tr, tg, tb] = hexARgb(tinta);
    const [fr, fg, fb] = hexARgb(fondo);

    pixeles.forEach((valor, i) => {
        const a = valor / 255;
        imagen.data[i * 4] = Math.round(fr + (tr - fr) * a);
        imagen.data[i * 4 + 1] = Math.round(fg + (tg - fg) * a);
        imagen.data[i * 4 + 2] = Math.round(fb + (tb - fb) * a);
        imagen.data[i * 4 + 3] = 255;
    });

    c.putImageData(imagen, 0, 0);
}

function hexARgb(hex) {
    const limpio = hex.replace("#", "");
    return [0, 2, 4].map(i => parseInt(limpio.slice(i, i + 2), 16));
}

function construirGrilla() {
    const { etiquetas, etiquetas_reales, imagenes } = estado.dibujos;
    const tabla = document.getElementById("grilla");

    tabla.innerHTML = "";

    // Cabecera: el dibujo original y su etiqueta real
    const cabecera = tabla.createTHead().insertRow();
    const esquina = document.createElement("th");
    esquina.textContent = "Dibujo real →";
    esquina.className = "fila-modelo";
    cabecera.appendChild(esquina);

    imagenes.forEach((pixeles, i) => {
        const th = document.createElement("th");
        const canvas = document.createElement("canvas");
        pintarDibujo(canvas, pixeles);
        th.appendChild(canvas);
        th.appendChild(document.createTextNode(etiquetas[etiquetas_reales[i]]));
        cabecera.appendChild(th);
    });

    // Una fila por modelo
    const cuerpo = tabla.createTBody();

    estado.globales.forEach(({ modelo }) => {
        const predicciones = estado.individuales.filter(p => p.modelo === modelo);
        const aciertos = predicciones.filter(p => p.etiqueta === etiquetas_reales[p.indice_imagen]).length;

        const fila = cuerpo.insertRow();
        fila.dataset.modelo = modelo;

        const th = document.createElement("th");
        th.className = "fila-modelo";
        th.innerHTML = `
            <span class="muestra-modelo" style="background:${colorModelo(modelo)}"></span>${MODELOS[modelo].corto}
            <span class="aciertos">${aciertos}/${predicciones.length} aciertos</span>
        `;
        fila.appendChild(th);

        predicciones.forEach(p => {
            const real = etiquetas_reales[p.indice_imagen];
            const tipo = p.etiqueta === -1 ? "ruido" : (p.etiqueta === real ? "correcta" : "incorrecta");
            const icono = tipo === "correcta" ? "✓" : (tipo === "incorrecta" ? "✗" : "?");

            const celda = fila.insertCell();
            celda.className = `celda ${tipo}`;
            celda.tabIndex = 0;
            celda.dataset.tipo = tipo;
            celda.setAttribute("aria-label",
                `${modelo}, dibujo ${p.indice_imagen + 1}: dice ${etiquetas[p.etiqueta]}, era ${etiquetas[real]}`);

            const canvas = document.createElement("canvas");
            pintarDibujo(canvas, imagenes[p.indice_imagen]);
            celda.appendChild(canvas);

            const veredicto = document.createElement("span");
            veredicto.className = "veredicto";
            veredicto.textContent = `${icono} ${etiquetas[p.etiqueta]}`;
            celda.appendChild(veredicto);

            const detalle = `
                <b>${modelo}</b><br>
                Dibujo ${p.indice_imagen + 1} (era ${etiquetas[real]})<br>
                Predijo: <b>${etiquetas[p.etiqueta]}</b> ${icono}<br>
                Tiempo de predicción: ${segundos(p.tiempo_prediccion_s)}
            `;

            celda.addEventListener("mouseenter", e => mostrarTooltip(detalle, e));
            celda.addEventListener("mousemove", e => moverTooltip(e));
            celda.addEventListener("mouseleave", ocultarTooltip);
            celda.addEventListener("click", () => sonarCelda(celda));
            celda.addEventListener("keydown", e => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    sonarCelda(celda);
                }
            });
        });
    });

    aplicarFiltro();
    resaltarFila(estado.seleccionado);
}

async function sonarCelda(celda) {
    await activarSonido();
    Aplausometro.veredicto(celda.dataset.tipo);

    celda.classList.add("sonando");
    setTimeout(() => celda.classList.remove("sonando"), 250);
}

function aplicarFiltro() {
    const soloErrores = document.getElementById("solo-errores").checked;

    document.querySelectorAll("#grilla .celda").forEach(celda => {
        celda.classList.toggle("oculta", soloErrores && celda.dataset.tipo === "correcta");
    });
}

function resaltarFila(modelo) {
    document.querySelectorAll("#grilla tbody tr").forEach(fila => {
        fila.classList.toggle("resaltada", fila.dataset.modelo === modelo);
    });
}

// ---------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------

const tooltip = document.getElementById("tooltip");

function mostrarTooltip(html, evento) {
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    moverTooltip(evento);
}

function moverTooltip(evento) {
    const margen = 14;
    const ancho = tooltip.offsetWidth;
    const alto = tooltip.offsetHeight;

    let x = evento.clientX + margen;
    let y = evento.clientY + margen;

    if (x + ancho > window.innerWidth - 8) {
        x = evento.clientX - ancho - margen;
    }
    if (y + alto > window.innerHeight - 8) {
        y = evento.clientY - alto - margen;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

function ocultarTooltip() {
    tooltip.hidden = true;
}

// ---------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------

async function iniciar() {
    try {
        const [textoGlobales, textoIndividuales, dibujos] = await Promise.all([
            cargar(RUTA_GLOBALES, "texto"),
            cargar(RUTA_INDIVIDUALES, "texto"),
            cargar(RUTA_DIBUJOS, "json")
        ]);

        estado.globales = leerCSV(textoGlobales);
        estado.individuales = leerCSV(textoIndividuales);
        estado.dibujos = dibujos;
    } catch (error) {
        console.error("Error:", error);
        document.getElementById("grafico-dispersion").textContent =
            "No se pudieron cargar los datos. Abre la página con un servidor local (python -m http.server).";
        return;
    }

    dibujarDispersion();
    llenarTabla();
    construirGrilla();

    document.getElementById("btn-sonido").addEventListener("click", activarSonido);

    document.getElementById("btn-competencia").addEventListener("click", async () => {
        await activarSonido();
        competencia();
    });

    document.getElementById("solo-errores").addEventListener("change", aplicarFiltro);

    // Redibujar si cambia el modo claro/oscuro del sistema
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        dibujarDispersion();
        construirGrilla();
    });
}

iniciar();
