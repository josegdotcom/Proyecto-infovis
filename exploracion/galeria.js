// Galeria de alternativas de graficos para las dos pruebas (CNN vs. MLP).
// Cada entrada de GRAFICOS es una tarjeta: su texto y la funcion que la dibuja.

const PRUEBAS = [DATOS.p1, DATOS.p2];
const CORTO = ["Prueba 1", "Prueba 2"];

// Color fijo por modelo (por entidad, nunca por ranking)
const MODELOS = [
    { clave: "CNN", nombre: "CNN (convolucional)", variable: "--modelo-cnn" },
    { clave: "MLP", nombre: "MLP (red densa)", variable: "--modelo-mlp" }
];

const METRICAS = [
    { clave: "accuracy", nombre: "Accuracy" },
    { clave: "precision", nombre: "Precisión" },
    { clave: "recall", nombre: "Recall" },
    { clave: "f1_score", nombre: "F1" }
];

const CONFIG = { displayModeBar: false, responsive: true };

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------

function css(variable) {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

function color(modelo) {
    return css(modelo.variable);
}

function modoOscuro() {
    const forzado = document.documentElement.dataset.theme;
    return forzado ? forzado === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function pct(valor, decimales = 1) {
    return `${(valor * 100).toFixed(decimales).replace(".", ",")}%`;
}

function tiempo(s) {
    if (s < 0.001) {
        return `${(s * 1000).toFixed(2).replace(".", ",")} ms`;
    }
    if (s < 1) {
        return `${(s * 1000).toFixed(0)} ms`;
    }
    return `${s.toFixed(1).replace(".", ",")} s`;
}

function veces(valor) {
    return `${valor < 10 ? valor.toFixed(1).replace(".", ",") : valor.toFixed(0)}×`;
}

// Acierto por clase real (recall): diagonal / total de la fila
function aciertoPorClase(matriz) {
    return matriz.map((fila, i) => fila[i] / fila.reduce((a, b) => a + b, 0));
}

function normalizarFilas(matriz) {
    return matriz.map(fila => {
        const total = fila.reduce((a, b) => a + b, 0);
        return fila.map(n => n / total);
    });
}

// Rampa de un solo tono: lo cercano a cero se funde con la superficie
function rampa() {
    return modoOscuro()
        ? [[0, "#17212e"], [0.5, "#256abf"], [1, "#b7d3f6"]]
        : [[0, "#f1f6fd"], [0.5, "#5598e7"], [1, "#0d366b"]];
}

// Numero dentro de cada celda de un mapa de calor, con la tinta que contrasta con su fondo
function etiquetasCeldas(xs, ys, z, textos, min, max, ejes = {}) {
    const oscuro = modoOscuro();
    const etiquetas = [];

    ys.forEach((y, i) => {
        xs.forEach((x, j) => {
            const t = (z[i][j] - min) / (max - min);
            const fondoClaro = oscuro ? t > 0.6 : t < 0.5;

            etiquetas.push({
                x,
                y,
                text: textos[i][j],
                showarrow: false,
                font: { color: fondoClaro ? "#0b0b0b" : "#ffffff", size: 12 },
                ...ejes
            });
        });
    });

    return etiquetas;
}

function eje(extra = {}) {
    return {
        gridcolor: css("--grilla"),
        linecolor: css("--eje"),
        zeroline: false,
        automargin: true,
        tickfont: { color: css("--texto-tenue"), size: 11 },
        title: { font: { size: 12 } },
        ...extra
    };
}

function titulo(texto) {
    return { text: texto, font: { size: 12, color: css("--texto-secundario") } };
}

function base(extra = {}) {
    const superficie = css("--superficie");

    return {
        height: 340,
        margin: { l: 48, r: 16, t: 48, b: 44 },
        paper_bgcolor: superficie,
        plot_bgcolor: superficie,
        separators: ",.",
        font: {
            family: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            color: css("--texto-secundario"),
            size: 12
        },
        hoverlabel: {
            bgcolor: superficie,
            bordercolor: css("--eje"),
            font: { color: css("--texto-primario") }
        },
        showlegend: true,
        legend: {
            orientation: "h",
            x: 0,
            xanchor: "left",
            y: 1.02,
            yanchor: "bottom",
            font: { color: css("--texto-primario") }
        },
        ...extra
    };
}

// Titulo de un panel cuando el grafico tiene dos (uno por prueba)
function tituloPanel(texto, x, y = 1) {
    return {
        xref: "paper",
        yref: "paper",
        x,
        y,
        xanchor: "left",
        yanchor: "bottom",
        text: `<b>${texto}</b>`,
        showarrow: false,
        font: { color: css("--texto-primario"), size: 12 }
    };
}

// Linea gris que une a los dos modelos en una misma fila (dumbbell)
function conectores(xs, ys, ejes = {}) {
    const x = [];
    const y = [];

    xs.forEach((par, i) => {
        x.push(par[0], par[1], null);
        y.push(ys[i], ys[i], null);
    });

    return {
        type: "scatter",
        mode: "lines",
        x,
        y,
        line: { color: css("--eje"), width: 2 },
        hoverinfo: "skip",
        showlegend: false,
        ...ejes
    };
}

const DOMINIOS = [[0, 0.46], [0.54, 1]];

// ---------------------------------------------------------------
// K. Las piezas del boceto del grupo, con los datos reales
// ---------------------------------------------------------------

function barrasPorModelo(el) {
    const texto = css("--texto-primario");

    // Eje de dos niveles: la prueba bajo cada barra y el modelo bajo cada grupo
    const trazas = MODELOS.map(m => {
        const valores = PRUEBAS.map(p => p.generales[m.clave].accuracy);

        return {
            type: "bar",
            name: m.nombre,
            x: [PRUEBAS.map(() => m.clave), CORTO],
            y: valores,
            marker: { color: color(m) },
            text: valores.map(v => pct(v)),
            textposition: "outside",
            textfont: { color: texto, size: 12 },
            cliponaxis: false,
            hovertemplate: `<b>${m.clave}</b> · %{x[1]}<br>Accuracy: %{y:.1%}<extra></extra>`
        };
    });

    Plotly.react(el, trazas, base({
        bargap: 0.3,
        barcornerradius: 4,
        xaxis: eje({ tickfont: { color: texto, size: 12 }, showdividers: false }),
        yaxis: eje({ range: [0, 1.08], tickformat: ".0%", dtick: 0.25, title: titulo("Accuracy en el test") })
    }), CONFIG);
}

function pendientesTiempo(el) {
    const texto = css("--texto-primario");

    const trazas = MODELOS.map(m => {
        const valores = PRUEBAS.map(p => p.generales[m.clave].tiempo_entrenamiento_s);

        return {
            type: "scatter",
            mode: "lines+markers+text",
            name: m.nombre,
            x: [0, 1],
            y: valores,
            line: { color: color(m), width: 2 },
            marker: { color: color(m), size: 10, line: { color: css("--superficie"), width: 2 } },
            text: [`${m.clave} ${tiempo(valores[0])}  `, `  ${m.clave} ${tiempo(valores[1])}`],
            textposition: ["middle left", "middle right"],
            textfont: { color: texto, size: 12 },
            cliponaxis: false,
            hovertemplate: `${m.clave}: %{y:.1f} s<extra></extra>`
        };
    });

    Plotly.react(el, trazas, base({
        xaxis: eje({
            range: [-0.75, 1.75],
            tickvals: [0, 1],
            ticktext: PRUEBAS.map(p => p.nombre),
            tickfont: { color: texto, size: 12 },
            showgrid: false
        }),
        yaxis: eje({
            type: "log",
            range: [0, 1.7],
            tickvals: [1, 2, 5, 10, 20, 50],
            ticktext: ["1 s", "2 s", "5 s", "10 s", "20 s", "50 s"],
            title: titulo("Tiempo de entrenamiento (escala logarítmica)")
        })
    }), CONFIG);
}

function senalEtiquetada(el) {
    const p = DATOS.p2;
    const ind = p.individuales;
    const texto = css("--texto-primario");
    const largo = ind.senales[0].length;
    const margen = largo * 0.08;

    // Los 10 casos van uno al lado del otro, como en el boceto
    const x = [];
    const y = [];

    ind.senales.forEach((senal, k) => {
        senal.forEach((valor, i) => {
            x.push(k * largo + i);
            y.push(valor);
        });
        x.push(null);
        y.push(null);
    });

    const trazas = [{
        type: "scatter",
        mode: "lines",
        x,
        y,
        line: { color: css("--texto-tenue"), width: 1 },
        hoverinfo: "skip",
        showlegend: false
    }];

    // Bajo la senal, una franja por modelo: su color si acierta, rojo punteado si falla
    const errores = { x: [], y: [], casos: [] };

    MODELOS.forEach((m, fila) => {
        const sx = [];
        const sy = [];

        ind[m.clave].forEach((pred, k) => {
            const tramo = [k * largo + margen, (k + 1) * largo - margen, null];

            if (pred === ind.real[k]) {
                sx.push(...tramo);
                sy.push(fila, fila, null);
            } else {
                errores.x.push(...tramo);
                errores.y.push(fila, fila, null);
                errores.casos.push({ k, fila, pred });
            }
        });

        trazas.push({
            type: "scatter", mode: "lines", name: `${m.clave} acierta`,
            x: sx, y: sy, yaxis: "y2",
            line: { color: color(m), width: 8 }, hoverinfo: "skip"
        });
    });

    trazas.push({
        type: "scatter", mode: "lines", name: "Se equivoca",
        x: errores.x, y: errores.y, yaxis: "y2",
        line: { color: css("--mal"), width: 8, dash: "dot" }, hoverinfo: "skip"
    });

    const annotations = ind.real.map((real, k) => ({
        x: (k + 0.5) * largo,
        yref: "paper",
        y: 1,
        yanchor: "bottom",
        text: `<b>${p.clases[real]}</b>`,
        showarrow: false,
        font: { color: texto, size: 11 }
    }));

    errores.casos.forEach(e => {
        annotations.push({
            x: (e.k + 0.5) * largo,
            y: e.fila,
            yref: "y2",
            yshift: 13,
            text: `✗ ${p.clases[e.pred]}`,
            showarrow: false,
            font: { color: texto, size: 11 }
        });
    });

    const shapes = ind.real.slice(1).map((_, k) => ({
        type: "line",
        x0: (k + 1) * largo,
        x1: (k + 1) * largo,
        yref: "paper",
        y0: 0,
        y1: 1,
        line: { color: css("--grilla"), width: 1 }
    }));

    Plotly.react(el, trazas, base({
        height: 400,
        margin: { l: 48, r: 16, t: 72, b: 36 },
        legend: { ...base().legend, y: 1.09 },
        xaxis: eje({
            range: [0, ind.real.length * largo],
            tickvals: ind.real.map((_, k) => (k + 0.5) * largo),
            ticktext: ind.real.map((_, k) => `Caso ${k + 1}`),
            showgrid: false
        }),
        yaxis: eje({ domain: [0.42, 1], range: [-1.1, 1.1], dtick: 1, title: titulo("Valor de las 561 variables") }),
        yaxis2: eje({
            domain: [0, 0.3],
            range: [1.6, -0.9],
            tickvals: MODELOS.map((_, fila) => fila),
            ticktext: MODELOS.map(m => m.clave),
            showgrid: false,
            tickfont: { color: texto, size: 12 }
        }),
        shapes,
        annotations
    }), CONFIG);
}

// ---------------------------------------------------------------
// A. Quien acierta mas
// ---------------------------------------------------------------

function barrasAgrupadas(el) {
    const texto = css("--texto-primario");

    const trazas = MODELOS.map(m => {
        const valores = PRUEBAS.map(p => p.generales[m.clave].accuracy);

        return {
            type: "bar",
            name: m.nombre,
            x: PRUEBAS.map(p => p.nombre),
            y: valores,
            marker: { color: color(m) },
            text: valores.map(v => pct(v)),
            textposition: "outside",
            textfont: { color: texto, size: 12 },
            cliponaxis: false,
            hovertemplate: `<b>%{x}</b><br>${m.clave}: %{y:.1%}<extra></extra>`
        };
    });

    // El azar es distinto en cada prueba: 2 clases vs. 6 clases
    const shapes = PRUEBAS.map((p, i) => ({
        type: "line",
        x0: i - 0.3,
        x1: i + 0.3,
        y0: p.azar,
        y1: p.azar,
        line: { color: texto, width: 1.5, dash: "dot" }
    }));

    const annotations = PRUEBAS.map((p, i) => ({
        x: i + 0.31,
        y: p.azar,
        xanchor: "left",
        text: `azar ${pct(p.azar, 0)}`,
        showarrow: false,
        font: { color: css("--texto-tenue"), size: 11 }
    }));

    Plotly.react(el, trazas, base({
        barmode: "group",
        bargap: 0.4,
        bargroupgap: 0.06,
        barcornerradius: 4,
        xaxis: eje({ tickfont: { color: texto, size: 12 }, range: [-0.5, 1.75] }),
        yaxis: eje({ range: [0, 1.08], tickformat: ".0%", dtick: 0.25, title: titulo("Accuracy en el test") }),
        shapes,
        annotations
    }), CONFIG);
}

function pendientes(el) {
    const texto = css("--texto-primario");

    const trazas = MODELOS.map(m => {
        const valores = PRUEBAS.map(p => p.generales[m.clave].accuracy);

        return {
            type: "scatter",
            mode: "lines+markers+text",
            name: m.nombre,
            x: [0, 1],
            y: valores,
            line: { color: color(m), width: 2 },
            marker: { color: color(m), size: 10, line: { color: css("--superficie"), width: 2 } },
            text: [`${m.clave} ${pct(valores[0])}  `, `  ${m.clave} ${pct(valores[1])}`],
            textposition: ["middle left", "middle right"],
            textfont: { color: texto, size: 12 },
            cliponaxis: false,
            hovertemplate: `${m.clave}: %{y:.1%}<extra></extra>`
        };
    });

    Plotly.react(el, trazas, base({
        margin: { l: 16, r: 16, t: 48, b: 44 },
        xaxis: eje({
            range: [-0.75, 1.75],
            tickvals: [0, 1],
            ticktext: PRUEBAS.map(p => p.nombre),
            tickfont: { color: texto, size: 12 },
            showgrid: false
        }),
        yaxis: eje({ range: [0.79, 0.97], tickformat: ".0%", dtick: 0.05, showticklabels: false })
    }), CONFIG);
}

function dumbbellMetricas(el) {
    const nombres = METRICAS.map(m => m.nombre);
    const trazas = [];

    PRUEBAS.forEach((p, i) => {
        const ejes = { xaxis: i === 0 ? "x" : "x2", yaxis: "y" };
        const pares = METRICAS.map(m => MODELOS.map(mod => p.generales[mod.clave][m.clave]));

        trazas.push(conectores(pares, nombres, ejes));

        MODELOS.forEach((mod, j) => {
            trazas.push({
                type: "scatter",
                mode: "markers",
                name: mod.nombre,
                legendgroup: mod.clave,
                showlegend: i === 0,
                x: pares.map(par => par[j]),
                y: nombres,
                marker: { color: color(mod), size: 12, line: { color: css("--superficie"), width: 2 } },
                hovertemplate: `<b>%{y}</b> · ${CORTO[i]}<br>${mod.clave}: %{x:.1%}<extra></extra>`,
                ...ejes
            });
        });
    });

    const x = { range: [0.76, 0.97], tickformat: ".0%", dtick: 0.05 };

    Plotly.react(el, trazas, base({
        margin: { l: 48, r: 16, t: 72, b: 36 },
        legend: { ...base().legend, y: 1.12 },
        xaxis: eje({ ...x, domain: DOMINIOS[0] }),
        xaxis2: eje({ ...x, domain: DOMINIOS[1] }),
        yaxis: eje({ autorange: "reversed", tickfont: { color: css("--texto-primario"), size: 12 } }),
        annotations: PRUEBAS.map((p, i) => tituloPanel(p.nombre, DOMINIOS[i][0]))
    }), CONFIG);
}

function mapaMetricas(el) {
    const filas = [];
    const z = [];

    PRUEBAS.forEach((p, i) => {
        MODELOS.forEach(m => {
            filas.push(`${CORTO[i]} · ${m.clave}`);
            z.push(METRICAS.map(met => p.generales[m.clave][met.clave]));
        });
    });

    const traza = {
        type: "heatmap",
        x: METRICAS.map(m => m.nombre),
        y: filas,
        z,
        zmin: 0.75,
        zmax: 1,
        colorscale: rampa(),
        xgap: 2,
        ygap: 2,
        hovertemplate: "<b>%{y}</b><br>%{x}: %{z:.1%}<extra></extra>",
        colorbar: { thickness: 10, tickformat: ".0%", dtick: 0.05, outlinewidth: 0, len: 0.9 }
    };

    Plotly.react(el, [traza], base({
        showlegend: false,
        margin: { l: 48, r: 16, t: 28, b: 16 },
        xaxis: eje({ side: "top", tickfont: { color: css("--texto-primario"), size: 12 }, showgrid: false }),
        yaxis: eje({ autorange: "reversed", tickfont: { color: css("--texto-primario"), size: 12 }, showgrid: false }),
        annotations: etiquetasCeldas(traza.x, filas, z, z.map(fila => fila.map(v => pct(v))), 0.75, 1)
    }), CONFIG);
}

function barrasDiferencia(el) {
    const nombres = METRICAS.map(m => m.nombre);
    const texto = css("--texto-primario");
    const trazas = [];

    PRUEBAS.forEach((p, i) => {
        const ejes = { xaxis: i === 0 ? "x" : "x2", yaxis: "y" };
        const dif = METRICAS.map(m => (p.generales.CNN[m.clave] - p.generales.MLP[m.clave]) * 100);

        // Una traza por ganador para que la leyenda diga de quien es cada color
        MODELOS.forEach((mod, j) => {
            const gana = d => (j === 0 ? d > 0 : d < 0);

            trazas.push({
                type: "bar",
                orientation: "h",
                name: `Gana ${mod.clave}`,
                legendgroup: mod.clave,
                showlegend: i === 0,
                x: dif.map(d => (gana(d) ? d : null)),
                y: nombres,
                marker: { color: color(mod) },
                text: dif.map(d => (gana(d) ? `${Math.abs(d).toFixed(1).replace(".", ",")} pp` : "")),
                textposition: "outside",
                textfont: { color: texto, size: 11 },
                cliponaxis: false,
                hovertemplate: `<b>%{y}</b> · ${CORTO[i]}<br>CNN − MLP: %{x:.1f} pp<extra></extra>`,
                ...ejes
            });
        });
    });

    const x = {
        range: [-14, 14],
        tickvals: [-10, -5, 0, 5, 10],
        ticktext: ["10", "5", "0", "5", "10"],
        zeroline: true,
        zerolinecolor: css("--eje"),
        zerolinewidth: 1,
        title: titulo("← MLP · puntos porcentuales · CNN →")
    };

    Plotly.react(el, trazas, base({
        barmode: "overlay",
        bargap: 0.45,
        barcornerradius: 4,
        margin: { l: 48, r: 16, t: 72, b: 48 },
        legend: { ...base().legend, y: 1.12 },
        xaxis: eje({ ...x, domain: DOMINIOS[0] }),
        xaxis2: eje({ ...x, domain: DOMINIOS[1] }),
        yaxis: eje({ autorange: "reversed", tickfont: { color: texto, size: 12 }, showgrid: false }),
        annotations: PRUEBAS.map((p, i) => tituloPanel(p.nombre, DOMINIOS[i][0]))
    }), CONFIG);
}

// ---------------------------------------------------------------
// B. Cuanto cuesta
// ---------------------------------------------------------------

function dispersionCosto(el) {
    const texto = css("--texto-primario");
    const tenue = css("--texto-tenue");
    const trazas = [];

    // Linea que une a los dos modelos de una misma prueba
    PRUEBAS.forEach(p => {
        trazas.push({
            type: "scatter",
            mode: "lines",
            x: MODELOS.map(m => p.generales[m.clave].tiempo_entrenamiento_s),
            y: MODELOS.map(m => p.generales[m.clave].accuracy),
            line: { color: css("--eje"), width: 2 },
            hoverinfo: "skip",
            showlegend: false
        });
    });

    MODELOS.forEach(m => {
        trazas.push({
            type: "scatter",
            mode: "markers+text",
            name: m.nombre,
            x: PRUEBAS.map(p => p.generales[m.clave].tiempo_entrenamiento_s),
            y: PRUEBAS.map(p => p.generales[m.clave].accuracy),
            text: CORTO,
            textposition: m.clave === "CNN" ? "middle right" : "middle left",
            textfont: { color: texto, size: 11 },
            marker: { color: color(m), size: 14, line: { color: css("--superficie"), width: 2 } },
            customdata: PRUEBAS.map(p => p.nombre),
            cliponaxis: false,
            hovertemplate: `<b>${m.clave}</b> · %{customdata}<br>Accuracy: %{y:.1%}<br>Entrenamiento: %{x:.1f} s<extra></extra>`
        });
    });

    Plotly.react(el, trazas, base({
        xaxis: eje({
            type: "log",
            range: [-0.05, 1.75],
            tickvals: [1, 2, 5, 10, 20, 50],
            title: titulo("Tiempo de entrenamiento (segundos, escala logarítmica)")
        }),
        yaxis: eje({ range: [0.79, 0.97], tickformat: ".0%", dtick: 0.05, title: titulo("Accuracy en el test") }),
        annotations: [{
            xref: "paper",
            yref: "paper",
            x: 0,
            y: 1,
            xanchor: "left",
            yanchor: "top",
            text: "↖ mejor: preciso y rápido",
            showarrow: false,
            font: { color: tenue, size: 11 }
        }]
    }), CONFIG);
}

const FILAS_TIEMPO = [
    { clave: "tiempo_entrenamiento_s", nombre: "Entrenar" },
    { clave: "tiempo_prediccion_s", nombre: "Predecir el test" }
];

function filasTiempo() {
    const filas = [];

    FILAS_TIEMPO.forEach(f => {
        PRUEBAS.forEach((p, i) => {
            filas.push({
                nombre: `${f.nombre} · ${CORTO[i]}`,
                valores: MODELOS.map(m => p.generales[m.clave][f.clave])
            });
        });
    });

    return filas;
}

function puntosTiempo(el) {
    const filas = filasTiempo();
    const nombres = filas.map(f => f.nombre);
    const trazas = [conectores(filas.map(f => f.valores), nombres)];

    MODELOS.forEach((m, j) => {
        trazas.push({
            type: "scatter",
            mode: "markers",
            name: m.nombre,
            x: filas.map(f => f.valores[j]),
            y: nombres,
            customdata: filas.map(f => tiempo(f.valores[j])),
            marker: { color: color(m), size: 12, line: { color: css("--superficie"), width: 2 } },
            hovertemplate: `<b>%{y}</b><br>${m.clave}: %{customdata}<extra></extra>`
        });
    });

    Plotly.react(el, trazas, base({
        xaxis: eje({
            type: "log",
            range: [-2.7, 1.7],
            tickvals: [0.01, 0.1, 1, 10],
            ticktext: ["10 ms", "100 ms", "1 s", "10 s"],
            title: titulo("Tiempo (escala logarítmica)")
        }),
        yaxis: eje({ autorange: "reversed", tickfont: { color: css("--texto-primario"), size: 12 } })
    }), CONFIG);
}

function barrasVeces(el) {
    const filas = filasTiempo();
    const razon = filas.map(f => f.valores[0] / f.valores[1]);
    const texto = css("--texto-primario");

    const traza = {
        type: "bar",
        orientation: "h",
        x: razon,
        y: filas.map(f => f.nombre),
        marker: { color: css("--modelo-cnn") },
        text: razon.map(veces),
        textposition: "outside",
        textfont: { color: texto, size: 12 },
        cliponaxis: false,
        customdata: filas.map(f => `CNN ${tiempo(f.valores[0])} · MLP ${tiempo(f.valores[1])}`),
        hovertemplate: "<b>%{y}</b><br>%{customdata}<extra></extra>"
    };

    Plotly.react(el, [traza], base({
        showlegend: false,
        bargap: 0.45,
        barcornerradius: 4,
        margin: { l: 48, r: 32, t: 16, b: 44 },
        xaxis: eje({
            range: [0, 92],
            tickvals: [1, 20, 40, 60, 80],
            ticktext: ["1× (igual)", "20×", "40×", "60×", "80×"],
            title: titulo("Veces que la CNN tarda más que el MLP")
        }),
        yaxis: eje({ autorange: "reversed", tickfont: { color: texto, size: 12 }, showgrid: false })
    }), CONFIG);
}

// ---------------------------------------------------------------
// C. En que se equivocan
// ---------------------------------------------------------------

function matricesConfusion(el) {
    const p = DATOS.p2;
    const texto = css("--texto-primario");

    const trazas = MODELOS.map((m, i) => ({
        type: "heatmap",
        x: p.clases,
        y: p.clases,
        z: normalizarFilas(p.matrices[m.clave]),
        text: p.matrices[m.clave],
        coloraxis: "coloraxis",
        xgap: 2,
        ygap: 2,
        hovertemplate: `<b>${m.clave}</b><br>Era: %{y}<br>Dijo: %{x}<br>%{text} muestras (%{z:.1%} de la fila)<extra></extra>`,
        xaxis: i === 0 ? "x" : "x2",
        yaxis: i === 0 ? "y" : "y2"
    }));

    const x = { side: "bottom", showgrid: false, tickfont: { color: texto, size: 11 }, title: titulo("Lo que dijo el modelo") };
    const y = { autorange: "reversed", showgrid: false, tickfont: { color: texto, size: 11 } };

    Plotly.react(el, trazas, base({
        height: 400,
        showlegend: false,
        margin: { l: 48, r: 16, t: 32, b: 48 },
        coloraxis: {
            colorscale: rampa(),
            cmin: 0,
            cmax: 1,
            colorbar: {
                thickness: 10,
                tickformat: ".0%",
                outlinewidth: 0,
                len: 0.9,
                title: { text: "% de la<br>clase real", font: { size: 11 } }
            }
        },
        xaxis: eje({ ...x, domain: [0, 0.45] }),
        xaxis2: eje({ ...x, domain: [0.55, 1] }),
        yaxis: eje({ ...y, title: titulo("Actividad real") }),
        yaxis2: eje({ ...y, anchor: "x2", showticklabels: false }),
        annotations: MODELOS.flatMap((m, i) => [
            tituloPanel(m.nombre, i === 0 ? 0 : 0.55),
            ...etiquetasCeldas(p.clases, p.clases, trazas[i].z, p.matrices[m.clave], 0, 1,
                { xref: i === 0 ? "x" : "x2", yref: i === 0 ? "y" : "y2" })
        ])
    }), CONFIG);
}

function aciertoClases(el) {
    const texto = css("--texto-primario");
    const trazas = [];

    PRUEBAS.forEach((p, i) => {
        const ejes = { xaxis: "x", yaxis: i === 0 ? "y" : "y2" };
        const porModelo = MODELOS.map(m => aciertoPorClase(p.matrices[m.clave]));
        const pares = p.clases.map((_, c) => porModelo.map(valores => valores[c]));

        trazas.push(conectores(pares, p.clases, ejes));

        MODELOS.forEach((m, j) => {
            trazas.push({
                type: "scatter",
                mode: "markers",
                name: m.nombre,
                legendgroup: m.clave,
                showlegend: i === 0,
                x: porModelo[j],
                y: p.clases,
                marker: { color: color(m), size: 12, line: { color: css("--superficie"), width: 2 } },
                hovertemplate: `<b>%{y}</b> · ${CORTO[i]}<br>${m.clave} acierta %{x:.1%}<extra></extra>`,
                ...ejes
            });
        });
    });

    const y = { autorange: "reversed", tickfont: { color: texto, size: 12 } };

    Plotly.react(el, trazas, base({
        height: 420,
        margin: { l: 48, r: 16, t: 72, b: 44 },
        legend: { ...base().legend, y: 1.1 },
        xaxis: eje({ range: [0.72, 1.02], tickformat: ".0%", dtick: 0.05, anchor: "y2", title: titulo("Muestras de esa clase que el modelo reconoce (recall)") }),
        yaxis: eje({ ...y, domain: [0.76, 1] }),
        yaxis2: eje({ ...y, domain: [0, 0.64] }),
        annotations: [tituloPanel(PRUEBAS[0].nombre, 0, 1), tituloPanel(PRUEBAS[1].nombre, 0, 0.64)]
    }), CONFIG);
}

function topConfusiones(el) {
    const p = DATOS.p2;
    const texto = css("--texto-primario");
    const pares = [];

    p.clases.forEach((real, i) => {
        p.clases.forEach((dicho, j) => {
            if (i !== j) {
                pares.push({
                    nombre: `${real} → ${dicho}`,
                    valores: MODELOS.map(m => p.matrices[m.clave][i][j])
                });
            }
        });
    });

    pares.sort((a, b) => Math.max(...b.valores) - Math.max(...a.valores));
    const top = pares.slice(0, 6);

    const trazas = MODELOS.map((m, j) => ({
        type: "bar",
        orientation: "h",
        name: m.nombre,
        x: top.map(t => t.valores[j]),
        y: top.map(t => t.nombre),
        marker: { color: color(m) },
        text: top.map(t => t.valores[j]),
        textposition: "outside",
        textfont: { color: texto, size: 11 },
        cliponaxis: false,
        hovertemplate: `<b>%{y}</b><br>${m.clave}: %{x} muestras<extra></extra>`
    }));

    Plotly.react(el, trazas, base({
        height: 400,
        barmode: "group",
        bargap: 0.3,
        bargroupgap: 0.08,
        barcornerradius: 4,
        xaxis: eje({ range: [0, 84], title: titulo("Muestras mal clasificadas (era → dijo)") }),
        yaxis: eje({ autorange: "reversed", tickfont: { color: texto, size: 12 }, showgrid: false })
    }), CONFIG);
}

// ---------------------------------------------------------------
// D. Caso a caso
// ---------------------------------------------------------------

function hexARgb(hex) {
    const limpio = hex.replace("#", "");
    return [0, 2, 4].map(i => parseInt(limpio.slice(i, i + 2), 16));
}

function pintarDibujo(canvas, pixeles) {
    canvas.width = 28;
    canvas.height = 28;

    const c = canvas.getContext("2d");
    const imagen = c.createImageData(28, 28);
    const [tr, tg, tb] = hexARgb(css("--texto-primario"));
    const [fr, fg, fb] = hexARgb(css("--plano"));

    pixeles.forEach((valor, i) => {
        const a = valor / 255;
        imagen.data[i * 4] = Math.round(fr + (tr - fr) * a);
        imagen.data[i * 4 + 1] = Math.round(fg + (tg - fg) * a);
        imagen.data[i * 4 + 2] = Math.round(fb + (tb - fb) * a);
        imagen.data[i * 4 + 3] = 255;
    });

    c.putImageData(imagen, 0, 0);
}

// Pictogramas de las actividades de la Prueba 2 (lienzo de 28 x 28, igual que los dibujos)
const ESCALERA = '<path d="M3 26H10V21H17V16H25"/>';
const PERSONA_ESCALERA = '<circle cx="11" cy="5" r="2.4"/><path d="M11 7.5L12 15M12 15L10.5 21M12 15L16.5 13L17 16M11.3 10L15.5 11.5M11.3 10L8.5 13.5"/>';

const FIGURAS = {
    "Camina": '<circle cx="14" cy="5" r="2.4"/><path d="M14 7.5V17M14 17L9.5 25.5M14 17L18 21L19 25.5M14 10.5L9.5 14.5M14 10.5L18.5 14"/>',
    "Sube": `${ESCALERA}${PERSONA_ESCALERA}<path d="M20 9L25 4M21 4H25V8"/>`,
    "Baja": `<g transform="translate(28 0) scale(-1 1)">${ESCALERA}${PERSONA_ESCALERA}</g><path d="M3 4L8 9M4 9H8V5"/>`,
    "Sentado": '<circle cx="12" cy="6" r="2.4"/><path d="M12 8.5V17H19V25.5M12 12L17 14.5"/><path d="M8 9V25.5M8 20H15.5V25.5" opacity="0.45"/>',
    "Parado": '<circle cx="14" cy="5" r="2.4"/><path d="M14 7.5V18M14 18L12 26M14 18L16 26M14 10.5L11 17M14 10.5L17 17"/>',
    "Acostado": '<circle cx="6.5" cy="16.5" r="2.4"/><path d="M9 17.5H25M12 17.5L16 14.5"/><path d="M3 21.5H26M4 21.5V25M25 21.5V25" opacity="0.45"/>'
};

function figura(clase) {
    return `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FIGURAS[clase]}</svg>`;
}

function grillaCasos(el) {
    el.innerHTML = "";
    el.className = "casos";

    PRUEBAS.forEach(p => {
        const ind = p.individuales;
        const tabla = document.createElement("table");

        tabla.createCaption().textContent = p.nombre;

        const cabecera = tabla.createTHead().insertRow();
        const esquina = document.createElement("th");
        esquina.className = "modelo";
        esquina.textContent = "Era →";
        cabecera.appendChild(esquina);

        ind.real.forEach((real, i) => {
            const th = document.createElement("th");

            if (ind.imagenes) {
                const canvas = document.createElement("canvas");
                pintarDibujo(canvas, ind.imagenes[i]);
                th.appendChild(canvas);
            } else {
                th.innerHTML = figura(p.clases[real]);
            }

            th.appendChild(document.createTextNode(p.clases[real]));
            cabecera.appendChild(th);
        });

        const cuerpo = tabla.createTBody();

        MODELOS.forEach(m => {
            const fila = cuerpo.insertRow();
            const aciertos = ind[m.clave].filter((pred, i) => pred === ind.real[i]).length;

            const th = document.createElement("th");
            th.className = "modelo";
            th.innerHTML = `<span class="muestra" style="background:${color(m)}"></span>${m.clave} · ${aciertos}/${ind.real.length}`;
            fila.appendChild(th);

            ind[m.clave].forEach((pred, i) => {
                const bien = pred === ind.real[i];
                const celda = fila.insertCell();

                celda.className = bien ? "bien" : "mal";
                celda.innerHTML = `<span class="icono">${bien ? "✓" : "✗"}</span>${p.clases[pred]}`;
                celda.title = `${m.clave}: dijo ${p.clases[pred]}, era ${p.clases[ind.real[i]]}`;
            });
        });

        el.appendChild(tabla);
    });
}

// Contexto minimo de cada prueba: la pregunta que responde el modelo
const CONTEXTO = [
    {
        pregunta: "¿Gato o perro?",
        // Dibujos de ejemplo para cada clase (posicion dentro de los 10 casos individuales)
        ejemplo: [4, 6]
    },
    {
        pregunta: "¿Qué hace la persona?"
    }
];

function iconoClase(prueba, i, clase) {
    const contexto = CONTEXTO[i];

    if (contexto.ejemplo) {
        const canvas = document.createElement("canvas");
        pintarDibujo(canvas, prueba.individuales.imagenes[contexto.ejemplo[clase]]);
        return canvas;
    }

    const caja = document.createElement("span");
    caja.innerHTML = figura(prueba.clases[clase]);
    return caja.firstChild;
}

function cadaCien(el) {
    el.innerHTML = "";
    el.className = "cien";

    const maxTiempo = Math.max(...PRUEBAS.flatMap(p => MODELOS.map(m => p.generales[m.clave].tiempo_entrenamiento_s)));

    PRUEBAS.forEach((p, i) => {
        const contexto = CONTEXTO[i];

        const resumen = MODELOS.map(m => ({
            modelo: m,
            aciertos: Math.round(p.generales[m.clave].accuracy * 100),
            tiempo: p.generales[m.clave].tiempo_entrenamiento_s
        }));

        const masAciertos = Math.max(...resumen.map(r => r.aciertos));
        const menosAciertos = Math.min(...resumen.map(r => r.aciertos));
        const masRapido = Math.min(...resumen.map(r => r.tiempo));
        const masLento = Math.max(...resumen.map(r => r.tiempo));

        const bloque = document.createElement("section");
        bloque.className = "cien-prueba";
        bloque.innerHTML = `
            <div class="cien-contexto">
                <h4>${p.nombre}</h4>
                <p class="cien-pregunta">${contexto.pregunta}</p>
                <div class="cien-clases"></div>
            </div>
            <div class="cien-modelos"></div>
        `;

        p.clases.forEach((nombre, c) => {
            const clase = document.createElement("span");
            clase.appendChild(iconoClase(p, i, c));
            clase.appendChild(document.createTextNode(nombre));
            bloque.querySelector(".cien-clases").appendChild(clase);
        });

        resumen.forEach(r => {
            const insignias = [];

            if (r.aciertos === masAciertos) {
                insignias.push(`★ ${masAciertos - menosAciertos} aciertos más`);
            }
            if (r.tiempo === masRapido) {
                insignias.push(`⚡\uFE0E Entrena ${veces(masLento / masRapido)} más rápido`);
            }

            const fila = document.createElement("div");
            fila.className = "cien-modelo";
            fila.style.setProperty("--color-modelo", color(r.modelo));
            fila.innerHTML = `
                <div class="cien-cabecera">
                    <span class="cien-nombre"><span class="muestra" style="background:${color(r.modelo)}"></span>${r.modelo.nombre}</span>
                    ${insignias.map(t => `<span class="insignia">${t}</span>`).join("")}
                </div>
                <div class="cien-medida">
                    <span>Aciertos</span>
                    <span class="cien-barra con-pista"><i style="width:${r.aciertos}%"></i></span>
                    <span><strong>${r.aciertos}</strong> de 100</span>
                    <span>Entrenar</span>
                    <span class="cien-barra"><i style="width:${r.tiempo / maxTiempo * 100}%"></i></span>
                    <span>${tiempo(r.tiempo)}</span>
                </div>
            `;

            bloque.querySelector(".cien-modelos").appendChild(fila);
        });

        el.appendChild(bloque);
    });
}

function confianza(el) {
    const texto = css("--texto-primario");
    const trazas = [];
    const annotations = PRUEBAS.map((p, i) => tituloPanel(p.nombre, DOMINIOS[i][0]));

    PRUEBAS.forEach((p, i) => {
        const ind = p.individuales;
        const ejes = { xaxis: i === 0 ? "x" : "x2", yaxis: "y" };
        const casos = ind.confianza_CNN.map((valor, k) => ({
            n: k + 1,
            valor,
            bien: ind.CNN[k] === ind.real[k],
            detalle: `dijo ${p.clases[ind.CNN[k]]}, era ${p.clases[ind.real[k]]}`
        }));

        // Tallos
        const tx = [];
        const ty = [];
        casos.forEach(c => {
            tx.push(c.n, c.n, null);
            ty.push(0, c.valor, null);
        });

        trazas.push({
            type: "scatter", mode: "lines", x: tx, y: ty,
            line: { color: css("--eje"), width: 2 }, hoverinfo: "skip", showlegend: false, ...ejes
        });

        // El acierto y el error se distinguen por color y tambien por forma
        [
            { nombre: "Acierta", bien: true, color: css("--modelo-cnn"), simbolo: "circle", tamano: 11 },
            { nombre: "Se equivoca", bien: false, color: css("--mal"), simbolo: "x", tamano: 12 }
        ].forEach(grupo => {
            const sel = casos.filter(c => c.bien === grupo.bien);

            trazas.push({
                type: "scatter",
                mode: "markers",
                name: grupo.nombre,
                legendgroup: grupo.nombre,
                showlegend: i === 0,
                x: sel.map(c => c.n),
                y: sel.map(c => c.valor),
                customdata: sel.map(c => c.detalle),
                marker: { color: grupo.color, symbol: grupo.simbolo, size: grupo.tamano, line: { color: css("--superficie"), width: 1.5 } },
                hovertemplate: "<b>Caso %{x}</b>: %{customdata}<br>Confianza: %{y:.1%}<extra></extra>",
                ...ejes
            });
        });

        casos.filter(c => !c.bien).forEach(c => {
            annotations.push({
                xref: i === 0 ? "x" : "x2",
                x: c.n,
                y: c.valor,
                text: `error con ${pct(c.valor, 0)}<br>de confianza`,
                showarrow: true,
                arrowhead: 0,
                arrowwidth: 1,
                arrowcolor: css("--texto-tenue"),
                ax: -44,
                ay: 56,
                font: { color: texto, size: 11 },
                bgcolor: css("--superficie")
            });
        });
    });

    const x = { range: [0.3, 10.7], dtick: 1, showgrid: false, title: titulo("Caso") };

    Plotly.react(el, trazas, base({
        margin: { l: 48, r: 16, t: 72, b: 44 },
        legend: { ...base().legend, y: 1.12 },
        xaxis: eje({ ...x, domain: DOMINIOS[0] }),
        xaxis2: eje({ ...x, domain: DOMINIOS[1] }),
        yaxis: eje({ range: [0, 1.08], tickformat: ".0%", dtick: 0.25, title: titulo("Confianza de la CNN en su respuesta") }),
        annotations
    }), CONFIG);
}

function tiemposCasos(el) {
    const trazas = [];
    const filas = [];

    PRUEBAS.forEach((p, i) => {
        MODELOS.forEach(m => filas.push({ nombre: `${CORTO[i]} · ${m.clave}`, modelo: m, tiempos: p.individuales[`tiempo_${m.clave}`] }));
    });

    MODELOS.forEach(m => {
        const x = [];
        const y = [];

        filas.forEach((f, k) => {
            if (f.modelo === m) {
                f.tiempos.forEach((t, n) => {
                    x.push(t);
                    // Pequeno desplazamiento vertical fijo para que los 10 puntos no se tapen
                    y.push(k + (n - 4.5) * 0.06);
                });
            }
        });

        trazas.push({
            type: "scatter",
            mode: "markers",
            name: m.nombre,
            x,
            y,
            customdata: x.map(tiempo),
            marker: { color: color(m), size: 9, opacity: 0.8, line: { color: css("--superficie"), width: 1 } },
            hovertemplate: `${m.clave}: %{customdata}<extra></extra>`
        });
    });

    Plotly.react(el, trazas, base({
        xaxis: eje({
            type: "log",
            range: [-3.8, -0.8],
            tickvals: [0.0003, 0.001, 0.003, 0.01, 0.03, 0.1],
            ticktext: ["0,3 ms", "1 ms", "3 ms", "10 ms", "30 ms", "100 ms"],
            title: titulo("Tiempo para predecir un caso (escala logarítmica)")
        }),
        yaxis: eje({
            range: [3.6, -0.6],
            tickvals: filas.map((_, k) => k),
            ticktext: filas.map(f => f.nombre),
            tickfont: { color: css("--texto-primario"), size: 12 },
            showgrid: false
        })
    }), CONFIG);
}

// ---------------------------------------------------------------
// E. Como aprenden
// ---------------------------------------------------------------

function curvasAprendizaje(el) {
    const texto = css("--texto-primario");
    const trazas = [];
    const series = [
        { clave: "entrenamiento", nombre: "Entrenamiento", color: css("--sec-claro") },
        { clave: "validacion", nombre: "Validación", color: css("--sec-oscuro") }
    ];

    PRUEBAS.forEach((p, i) => {
        series.forEach(s => {
            const valores = p.epocas_cnn[s.clave];

            trazas.push({
                type: "scatter",
                mode: "lines+markers",
                name: s.nombre,
                legendgroup: s.clave,
                showlegend: i === 0,
                x: valores.map((_, k) => k + 1),
                y: valores,
                line: { color: s.color, width: 2 },
                marker: { color: s.color, size: 6 },
                hovertemplate: `Época %{x} · ${s.nombre}: %{y:.1%}<extra></extra>`,
                xaxis: i === 0 ? "x" : "x2",
                yaxis: "y"
            });
        });
    });

    const x = { dtick: 2, title: titulo("Época"), rangemode: "tozero" };

    Plotly.react(el, trazas, base({
        margin: { l: 48, r: 16, t: 72, b: 44 },
        legend: { ...base().legend, y: 1.12 },
        hovermode: "x unified",
        xaxis: eje({ ...x, range: [0.5, 15.5], domain: DOMINIOS[0] }),
        xaxis2: eje({ ...x, range: [0.5, 5.5], dtick: 1, domain: DOMINIOS[1] }),
        yaxis: eje({ range: [0.45, 1], tickformat: ".0%", dtick: 0.1, title: titulo("Accuracy de la CNN") }),
        annotations: PRUEBAS.map((p, i) => ({ ...tituloPanel(p.nombre, DOMINIOS[i][0]), font: { color: texto, size: 12 } }))
    }), CONFIG);
}

// ---------------------------------------------------------------
// Catalogo de tarjetas
// ---------------------------------------------------------------

const SECCIONES = [
    {
        id: "k",
        titulo: "K. El concepto del grupo",
        texto: "Las piezas del boceto dibujadas con los resultados reales. El boceto tenía cuatro modelos (MLP, SVM, RF, HDBSCAN); los resultados actuales son de CNN y MLP, así que todo usa dos. La grilla de la Prueba 1 del boceto es la tarjeta D1, más abajo.",
        graficos: [
            {
                codigo: "K1", tipo: "Barras por modelo (boceto)", veredicto: "Buena alternativa",
                titulo: "Los dos modelos rinden mejor en la Prueba 2",
                sub: "Como en el boceto: un grupo por modelo, una barra por prueba.",
                bien: "Es el gráfico del boceto y se entiende solo. Agrupar por modelo responde «¿cómo le fue a cada uno?» y el color coincide con el de cada modelo en el resto de la página.",
                limite: "La comparación que importa (CNN contra MLP en la misma prueba) queda en grupos distintos y hay que saltar con la vista. A1 agrupa por prueba y A2 muestra el cruce directamente.",
                dibujar: barrasPorModelo
            },
            {
                codigo: "K2", tipo: "Pendientes de tiempo (boceto)", veredicto: "Con cuidado",
                titulo: "La CNN entrena 4 veces más rápido en la Prueba 2; el MLP, casi igual",
                sub: "Como en el boceto: tiempo de entrenamiento de cada modelo en cada prueba.",
                bien: "Con dos modelos ya no es un enredo de líneas, y deja ver que la brecha de tiempo se achica en la Prueba 2.",
                limite: "La sospecha del boceto es correcta: la línea sugiere que el modelo «mejoró», pero entre pruebas cambian el dataset, la arquitectura y las épocas de la CNN (15 vs. 5). B1 y B3 comparan modelos dentro de una misma prueba, que es la comparación válida.",
                dibujar: pendientesTiempo
            },
            {
                codigo: "K3", tipo: "Señal etiquetada (boceto)", veredicto: "Con cuidado", ancha: true,
                titulo: "Diez lecturas del celular y lo que respondió cada modelo",
                sub: "Prueba 2, como en el boceto: arriba la actividad real, al medio los datos del caso, abajo la respuesta de cada modelo.",
                bien: "Respeta la idea del boceto: actividad real arriba, datos al medio y respuesta de cada modelo abajo. La franja inferior se puede recorrer con sonido, caso por caso.",
                limite: "No es una onda en el tiempo: son las 561 variables ya calculadas de cada lectura, así que la forma parece ruido y no distingue una actividad de otra. Para una señal real habría que usar los datos crudos del acelerómetro (carpeta Inertial Signals del dataset).",
                dibujar: senalEtiquetada
            }
        ]
    },
    {
        id: "a",
        titulo: "A. ¿Quién acierta más?",
        texto: "El resultado principal: la CNN gana con dibujos (88,0% vs. 82,5%) y el MLP gana con datos de sensores (94,7% vs. 91,5%). Cinco formas de contarlo.",
        graficos: [
            {
                codigo: "A1", tipo: "Barras agrupadas", veredicto: "Buena alternativa",
                titulo: "La CNN gana en dibujos; el MLP, en actividad",
                sub: "Accuracy por prueba y modelo, con la línea del azar de cada prueba.",
                bien: "Lo entiende cualquier audiencia. El eje parte en 0, así que no exagera, y deja ver que ambos modelos superan por mucho al azar.",
                limite: "Al partir en 0, la diferencia entre modelos (3 a 5 puntos) casi no se nota: el ojo ve cuatro barras parecidas.",
                dibujar: barrasAgrupadas
            },
            {
                codigo: "A2", tipo: "Gráfico de pendientes", veredicto: "Recomendado",
                titulo: "El ganador se invierte al cambiar de prueba",
                sub: "Accuracy de cada modelo en la Prueba 1 y en la Prueba 2.",
                bien: "El cruce de las líneas es el mensaje: se ve en un segundo quién gana dónde. Etiquetas directas, sin leyenda que consultar.",
                limite: "El eje no parte en 0 (válido para posiciones, no para barras). La línea sugiere continuidad entre dos tareas distintas: no es una evolución en el tiempo.",
                dibujar: pendientes
            },
            {
                codigo: "A3", tipo: "Dumbbell por métrica", veredicto: "Buena alternativa",
                titulo: "Las cuatro métricas cuentan casi la misma historia",
                sub: "Accuracy, precisión, recall y F1 de cada modelo, un panel por prueba.",
                bien: "Muestra la brecha entre modelos en cada métrica y revela la excepción: en dibujos el MLP tiene mejor recall que la CNN.",
                limite: "Pide saber qué es precisión y recall; para público general es demasiado. Las cuatro métricas están muy correlacionadas.",
                dibujar: dumbbellMetricas
            },
            {
                codigo: "A4", tipo: "Mapa de calor", veredicto: "Con cuidado",
                titulo: "Todas las métricas de un vistazo",
                sub: "Una fila por modelo y prueba, una columna por métrica; más oscuro es mejor.",
                bien: "Compacto y con el valor exacto en cada celda. Sirve como tabla de referencia o detalle a pedido.",
                limite: "El color es el canal menos preciso para comparar magnitudes: cuesta ver quién gana sin leer los números. Es una tabla coloreada.",
                dibujar: mapaMetricas
            },
            {
                codigo: "A5", tipo: "Barras de diferencia", veredicto: "Buena alternativa",
                titulo: "La ventaja cambia de lado según la prueba",
                sub: "Diferencia CNN − MLP en puntos porcentuales; el color indica quién gana.",
                bien: "Grafica directamente la comparación, no los valores: el lado de la barra dice quién gana y el largo, por cuánto.",
                limite: "Se pierde el nivel absoluto (no se ve que todos están sobre 80%). Hay que explicar qué es un punto porcentual.",
                dibujar: barrasDiferencia
            }
        ]
    },
    {
        id: "b",
        titulo: "B. ¿Cuánto cuesta?",
        texto: "El MLP es más rápido en las dos pruebas, tanto al entrenar como al predecir. Los tiempos van de milisegundos a decenas de segundos, por eso aparece la escala logarítmica.",
        graficos: [
            {
                codigo: "B1", tipo: "Dispersión", veredicto: "Recomendado",
                titulo: "Más tiempo de entrenamiento no siempre compra más accuracy",
                sub: "Accuracy vs. tiempo de entrenamiento; la línea gris une a los dos modelos de una misma prueba.",
                bien: "Junta costo y beneficio en un solo cuadro y continúa el concepto de la V1. La pendiente de cada línea cuenta la historia: sube en la Prueba 1, baja en la Prueba 2.",
                limite: "Solo hay cuatro puntos. La escala logarítmica hay que explicarla y el eje vertical no parte en 0.",
                dibujar: dispersionCosto
            },
            {
                codigo: "B2", tipo: "Dumbbell de tiempos", veredicto: "Buena alternativa",
                titulo: "El MLP es más rápido en todo, sobre todo al predecir",
                sub: "Tiempo de entrenamiento y de predicción del conjunto de test completo.",
                bien: "Entrenamiento y predicción caben en un mismo eje aunque difieran por miles de veces. El largo del conector es la brecha.",
                limite: "En escala logarítmica, una distancia igual significa «tantas veces más», no «tantos segundos más»; una audiencia no experta la lee mal.",
                dibujar: puntosTiempo
            },
            {
                codigo: "B3", tipo: "Barras de razón", veredicto: "Buena alternativa",
                titulo: "La CNN tarda entre 2 y 82 veces más que el MLP",
                sub: "Cuántas veces más tarda la CNN que el MLP en cada tarea.",
                bien: "Evita la escala logarítmica: «82 veces más lenta» se entiende sin explicación. Eje lineal desde 0.",
                limite: "Oculta los tiempos reales: 82× suena enorme, pero son 0,35 s contra 4 ms. Conviene dejar los valores en el tooltip.",
                dibujar: barrasVeces
            }
        ]
    },
    {
        id: "c",
        titulo: "C. ¿En qué se equivocan?",
        texto: "Zoom a los errores. En la Prueba 2 los dos modelos confunden actividades parecidas: las tres formas de caminar entre sí, y estar sentado con estar parado.",
        graficos: [
            {
                codigo: "C1", tipo: "Matrices de confusión", veredicto: "Buena alternativa", ancha: true,
                titulo: "Los errores se agrupan en dos bloques: moverse y estar quieto",
                sub: "Prueba 2. Cada fila es la actividad real; cada columna, lo que dijo el modelo. El número es la cantidad de muestras.",
                bien: "Es la vista completa: muestra todos los aciertos y todos los tipos de error, y la estructura en bloques salta a la vista.",
                limite: "Es un gráfico para expertos. Comparar dos matrices exige ir celda por celda, y el color apenas distingue 45 de 75.",
                dibujar: matricesConfusion
            },
            {
                codigo: "C2", tipo: "Dumbbell por clase", veredicto: "Recomendado",
                titulo: "La CNN falla al bajar escaleras; el MLP, con los gatos",
                sub: "Porcentaje de muestras de cada clase que el modelo reconoce, en las dos pruebas.",
                bien: "Cubre las dos pruebas con la misma codificación y destaca dónde se abre la brecha: Baja (79% vs. 94%) y Gato (76% vs. 89%).",
                limite: "Dice cuánto falla cada clase, pero no con qué la confunde. El eje parte en 72%.",
                dibujar: aciertoClases
            },
            {
                codigo: "C3", tipo: "Barras de errores", veredicto: "Recomendado",
                titulo: "La CNN confunde «bajar» con «caminar» casi 20 veces más que el MLP",
                sub: "Prueba 2. Las seis confusiones más frecuentes (actividad real → respuesta del modelo).",
                bien: "Traduce la matriz a lenguaje natural y la ordena: se lee de arriba abajo sin entrenamiento. Barras desde 0.",
                limite: "Muestra solo los seis errores principales; no deja ver los aciertos ni el total de cada clase.",
                dibujar: topConfusiones
            }
        ]
    },
    {
        id: "d",
        titulo: "D. Caso a caso",
        texto: "Detalle a pedido: las 10 muestras apartadas de cada prueba. Los dos modelos aciertan 9 de 10 en ambas, y fallan exactamente en el mismo caso.",
        graficos: [
            {
                codigo: "D1", tipo: "Grilla de casos", veredicto: "Recomendado", ancha: true,
                titulo: "Los dos modelos fallan en el mismo caso",
                sub: "Cada columna es un caso; cada fila, la respuesta de un modelo.",
                bien: "Lo más concreto de la galería: se ve el dibujo real y la respuesta. Es la base natural para los earcons de la V1 (un sonido por celda).",
                limite: "Diez casos no son una estadística: 9/10 no significa 90% de accuracy. En la Prueba 2 la figura es un pictograma de la actividad, no el dato que vio el modelo (que son 561 números).",
                dibujar: grillaCasos, html: true
            },
            {
                codigo: "D4", tipo: "Aciertos y tiempo por prueba", veredicto: "Recomendado", ancha: true,
                titulo: "La CNN gana donde hay una imagen, pero nunca es la más rápida",
                sub: "Aciertos de cada 100 casos y tiempo de entrenamiento de cada modelo, en las dos pruebas.",
                bien: "Responde a la retroalimentación en una sola vista: el color es el modelo, cada prueba muestra su pregunta y sus clases, y el contraste se ve dos veces (el ganador cambia entre pruebas, y en la Prueba 1 el que más acierta es el más lento). Solo dos barras por modelo, así que se lee en pocos segundos.",
                limite: "Las barras de aciertos parten en 0, así que 88 contra 82 se ven casi iguales: la diferencia la cargan la cifra y la insignia, no el largo. Redondea a casos enteros. No explica por qué gana cada modelo: eso tendría que ir en el texto de la página.",
                dibujar: cadaCien, html: true
            },
            {
                codigo: "D2", tipo: "Lollipop", veredicto: "Buena alternativa",
                titulo: "La CNN se equivoca muy segura de sí misma",
                sub: "Confianza de la CNN en su respuesta para cada uno de los 10 casos.",
                bien: "Cuenta algo que la accuracy no dice: los dos errores tienen 97% y 98% de confianza. Error y acierto se distinguen por color y por forma.",
                limite: "Solo existe para la CNN (el MLP no guardó probabilidades). Casi todos los puntos están pegados al 100%.",
                dibujar: confianza
            },
            {
                codigo: "D3", tipo: "Franja de puntos", veredicto: "Con cuidado",
                titulo: "Una respuesta del MLP llega unas 200 veces antes",
                sub: "Tiempo de predicción de cada caso individual; un punto por caso.",
                bien: "Muestra la dispersión real de las mediciones, no solo un promedio. Buen candidato para sonificar (duración de una nota).",
                limite: "Repite el mensaje de B2 y B3 con más ruido. Medir un solo caso incluye tiempo fijo de la librería, no solo del modelo.",
                dibujar: tiemposCasos
            }
        ]
    },
    {
        id: "e",
        titulo: "E. ¿Cómo aprenden?",
        texto: "El historial por época solo existe para la CNN. Para comparar con el MLP habría que exportar modelo_mlp.loss_curve_ y modelo_mlp.validation_scores_ desde los notebooks.",
        graficos: [
            {
                codigo: "E1", tipo: "Líneas por época", veredicto: "Con cuidado", ancha: true,
                titulo: "En dibujos, la CNN sigue memorizando cuando ya dejó de mejorar",
                sub: "Accuracy de la CNN en entrenamiento y en validación, época a época.",
                bien: "Es el único gráfico con una dimensión temporal real, ideal para sonificar. Muestra el sobreajuste: la validación se estanca cerca de 87% mientras el entrenamiento sigue subiendo.",
                limite: "No compara modelos, que es el tema del proyecto. Las dos pruebas tienen distinto número de épocas (15 y 5).",
                dibujar: curvasAprendizaje
            }
        ]
    }
];

// Cada pieza del boceto y la opcion que la reemplaza mejor
const LISTA_CORTA = [
    { titulo: "Barras de precisión", texto: "en vez de K1: aciertos de cada 100 casos con contexto, o el cruce entre pruebas.", codigos: ["D4", "A2"] },
    { titulo: "Líneas de tiempo", texto: "en vez de K2: comparan los modelos dentro de la misma prueba.", codigos: ["B1", "B3"] },
    { titulo: "Grilla de la Prueba 1", texto: "como en el boceto, con ✓/✗ y la respuesta en vez de 1/0.", codigos: ["D1"] },
    { titulo: "Señal de la Prueba 2", texto: "la señal del boceto, más las confusiones en lenguaje natural.", codigos: ["K3", "C3"] }
];

// ---------------------------------------------------------------
// Construccion de la pagina
// ---------------------------------------------------------------

const lienzos = [];

function construir() {
    const contenedor = document.getElementById("secciones");
    const indice = document.getElementById("indice");

    SECCIONES.forEach(seccion => {
        const enlace = document.createElement("a");
        enlace.href = `#${seccion.id}`;
        enlace.textContent = seccion.titulo;
        indice.appendChild(enlace);

        const bloque = document.createElement("section");
        bloque.className = "seccion";
        bloque.id = seccion.id;
        bloque.innerHTML = `<h2>${seccion.titulo}</h2><p>${seccion.texto}</p><div class="tarjetas"></div>`;

        seccion.graficos.forEach(g => {
            const tarjeta = document.createElement("article");
            tarjeta.className = `tarjeta${g.ancha ? " ancha" : ""}`;
            tarjeta.id = g.codigo;
            tarjeta.style.scrollMarginTop = "56px";
            tarjeta.innerHTML = `
                <div class="tarjeta-cabecera">
                    <span class="codigo">${g.codigo}</span>
                    <span class="tipo">${g.tipo}</span>
                    <span class="etiqueta${g.veredicto === "Recomendado" ? " recomendado" : ""}">${g.veredicto === "Recomendado" ? "★ " : ""}${g.veredicto}</span>
                </div>
                <h3>${g.titulo}</h3>
                <p class="sub">${g.sub}</p>
                <div class="lienzo"${g.html ? "" : ` role="img" aria-label="${g.tipo}: ${g.titulo}"`}></div>
                <dl class="notas">
                    <div><dt>Muestra bien:</dt><dd>${g.bien}</dd></div>
                    <div><dt>Limitación:</dt><dd>${g.limite}</dd></div>
                </dl>
            `;

            bloque.querySelector(".tarjetas").appendChild(tarjeta);
            lienzos.push({ el: tarjeta.querySelector(".lienzo"), dibujar: g.dibujar });
        });

        contenedor.appendChild(bloque);
    });

    const tabla = document.createElement("a");
    tabla.href = "#tabla";
    tabla.textContent = "Tabla de datos";
    indice.appendChild(tabla);

    document.getElementById("lista-corta").innerHTML = LISTA_CORTA.map(item => `
        <li>
            <strong>${item.titulo}</strong>
            ${item.codigos.map(c => `<a href="#${c}">${c}</a>`).join(" + ")} ${item.texto}
        </li>
    `).join("");

    document.getElementById("tabla-cuerpo").innerHTML = PRUEBAS.map(p => MODELOS.map(m => {
        const g = p.generales[m.clave];

        return `
            <tr>
                <td>${p.nombre}</td>
                <td>${m.clave}</td>
                ${METRICAS.map(met => `<td>${pct(g[met.clave])}</td>`).join("")}
                <td>${g.tiempo_entrenamiento_s.toFixed(2).replace(".", ",")}</td>
                <td>${g.tiempo_prediccion_s.toFixed(4).replace(".", ",")}</td>
            </tr>
        `;
    }).join("")).join("");
}

function dibujarTodo() {
    lienzos.forEach(l => l.dibujar(l.el));
}

construir();
dibujarTodo();

// Redibujar si cambia el modo claro/oscuro del sistema
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", dibujarTodo);
