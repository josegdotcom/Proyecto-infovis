// Página principal: pestañas para correr las dos pruebas y contraste entre lo esperado
// (resultados de la Entrega 1, en exploracion/datos.js) y los resultados de las pruebas.
//
// Las pruebas viven en exploracion/prueba_1.html y exploracion/prueba_2.html y se cargan
// en un iframe. Cuando se evalúan, js/embebido.js envía los resultados aquí (postMessage)
// y además los guarda en localStorage, para que sigan al recargar la página.
//
// Gráficos reutilizados de la Entrega 1:
//   - barras de aciertos (exploracion/comparacion.js), con la barra esperada y la de tu prueba;
//   - matrices de confusión (exploracion/galeria.js), lo esperado junto a tu prueba.

const MODELOS = [
    { clave: "CNN", nombre: "CNN (convolucional)", color: "var(--modelo-cnn)" },
    { clave: "MLP", nombre: "MLP (red densa)", color: "var(--modelo-mlp)" }
];

const PRUEBAS = [
    {
        numero: 1,
        datos: DATOS.p1,
        nombre: "Prueba 1 · Dibujos",
        detalle: "¿Gato o perro? Dibujos en el lienzo o en papel frente a la cámara",
        unidad: ["dibujo", "dibujos"],
        // La API responde 0 = gato y 1 = perro, igual que el orden de DATOS.p1.clases
        indice: etiqueta => etiqueta
    },
    {
        numero: 2,
        datos: DATOS.p2,
        nombre: "Prueba 2 · Actividades",
        detalle: "¿Qué estás haciendo? Acelerómetro y giroscopio del teléfono en la cintura",
        unidad: ["intento", "intentos"],
        // La API responde 1..6, en el mismo orden que DATOS.p2.clases
        indice: etiqueta => etiqueta - 1
    }
];

const CLAVE_ALMACEN = prueba => `infovis:resultados-prueba-${prueba}`;
const RUTA_IMAGENES = "assets/images/";

// Resultados de las pruebas hechas en esta página (o recuperados del almacenamiento)
const obtenidos = { 1: null, 2: null };

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------

function porcentaje(valor) {
    return `${Math.round(valor * 100)} %`;
}

function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Pictogramas de las actividades (los mismos de la Entrega 1)
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

function icono(prueba, clase) {
    if (prueba.numero === 1) {
        return `<img src="${RUTA_IMAGENES}${clase === 0 ? "gato" : "perro"}.svg" alt="">`;
    }
    return `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FIGURAS[prueba.datos.clases[clase]]}</svg>`;
}

// Matriz de confusión (filas = clase real, columnas = predicción) a partir de las etiquetas de la API
function matrizObtenida(prueba, resultado, modelo) {
    const n = prueba.datos.clases.length;
    const matriz = Array.from({ length: n }, () => Array(n).fill(0));
    resultado.etiquetas_reales.forEach((real, i) => {
        const fila = prueba.indice(Number(real));
        const columna = prueba.indice(Number(resultado.predicciones[modelo][i]));
        if (matriz[fila] && columna >= 0 && columna < n) matriz[fila][columna] += 1;
    });
    return matriz;
}

function aciertosObtenidos(resultado, modelo) {
    const preds = resultado.predicciones[modelo];
    const aciertos = preds.filter((p, i) => Number(p) === Number(resultado.etiquetas_reales[i])).length;
    return { aciertos, total: preds.length, accuracy: preds.length ? aciertos / preds.length : 0 };
}

// ---------------------------------------------------------------
// Gráfico 1: barras de aciertos (esperado vs. tu prueba)
// ---------------------------------------------------------------

function barrasAciertos(prueba, resultado) {
    const filas = MODELOS.map(m => {
        const esperado = prueba.datos.generales[m.clave].accuracy;
        const obtenido = resultado ? aciertosObtenidos(resultado, m.clave) : null;
        const descripcion = obtenido
            ? `${m.clave}: esperado ${porcentaje(esperado)}, en tu prueba ${porcentaje(obtenido.accuracy)} (${obtenido.aciertos} de ${obtenido.total})`
            : `${m.clave}: esperado ${porcentaje(esperado)}, tu prueba aún sin evaluar`;

        return `
            <dt>${m.clave}</dt>
            <dd class="pista doble" role="img" aria-label="${descripcion}" title="${descripcion}">
                <i class="esperado" style="width:${esperado * 100}%;background:${m.color}"></i>
                ${obtenido
                    ? `<i class="obtenido" style="width:${obtenido.accuracy * 100}%;background:${m.color}"></i>`
                    : `<i class="obtenido vacio"></i>`}
            </dd>
            <dd class="valor">
                <span class="valor-esperado">${porcentaje(esperado)}</span>
                <span class="valor-obtenido">${obtenido ? porcentaje(obtenido.accuracy) : "—"}</span>
            </dd>
        `;
    }).join("");

    return `
        <div class="medida medida-aciertos">
            <div class="encabezado">Aciertos <span>de cada 100 · más es mejor</span></div>
            <dl class="barras barras-dobles">${filas}</dl>
            <p class="clave-barras">
                <span><i class="clave esperado"></i>Esperado</span>
                <span><i class="clave obtenido"></i>Tu prueba</span>
            </p>
        </div>
    `;
}

// ---------------------------------------------------------------
// Gráfico 2: matrices de confusión (esperado vs. tu prueba)
// ---------------------------------------------------------------

function tablaMatriz(prueba, matriz, modelo, titulo, modo) {
    const clases = prueba.datos.clases;

    const cabecera = clases.map((c, j) =>
        `<th scope="col" title="Predice ${escapar(c)}"><span class="icono-clase">${icono(prueba, j)}</span><span class="solo-lectores">${escapar(c)}</span></th>`
    ).join("");

    const cuerpo = matriz.map((fila, i) => {
        const total = fila.reduce((a, b) => a + b, 0);
        const celdas = fila.map((valor, j) => {
            const diagonal = i === j ? " diagonal" : "";
            if (!total) {
                return `<td class="sin-datos${diagonal}" title="No probaste ${escapar(clases[i])}">·</td>`;
            }
            const parte = valor / total;
            // Lo esperado se muestra en % (miles de casos); tu prueba, en cantidad de casos
            const texto = modo === "esperado"
                ? (valor ? (parte < 0.005 ? "<1" : Math.round(parte * 100)) : "")
                : (valor || "");
            const detalle = modo === "esperado"
                ? `${escapar(clases[i])}: ${Math.round(parte * 100)} % predicho como ${escapar(clases[j])}`
                : `${escapar(clases[i])}: ${valor} de ${total} predicho como ${escapar(clases[j])}`;
            const oscuro = parte > 0.55 ? " oscuro" : "";
            return `<td class="celda-matriz${diagonal}${oscuro}" title="${detalle}"
                        style="--parte:${parte.toFixed(3)};--color:${modelo.color}">${texto}</td>`;
        }).join("");
        return `<tr><th scope="row">${escapar(clases[i])}</th>${celdas}</tr>`;
    }).join("");

    return `
        <figure class="matriz matriz-${modo}">
            <figcaption>${titulo}</figcaption>
            <table>
                <thead><tr><th scope="col"><span class="solo-lectores">Real</span></th>${cabecera}</tr></thead>
                <tbody>${cuerpo}</tbody>
            </table>
        </figure>
    `;
}

function matrices(prueba, resultado) {
    return `
        <div class="bloque-matrices">
            <div class="encabezado">Qué respondió cada modelo
                <span>filas: lo real · columnas: lo que predijo · la diagonal son los aciertos</span>
            </div>
            <div class="matrices-modelos">
                ${MODELOS.map(m => `
                    <div class="matrices-modelo">
                        <h4><span class="muestra" style="background:${m.color}"></span>${m.nombre}</h4>
                        <div class="par-matrices">
                            ${tablaMatriz(prueba, prueba.datos.matrices[m.clave], m, "Esperado (% por fila)", "esperado")}
                            ${resultado
                                ? tablaMatriz(prueba, matrizObtenida(prueba, resultado, m.clave), m, `Tu prueba (${prueba.unidad[1]})`, "obtenido")
                                : `<figure class="matriz matriz-vacia"><figcaption>Tu prueba</figcaption><p>Sin evaluar todavía</p></figure>`}
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------
// Lectura en palabras del contraste
// ---------------------------------------------------------------

function ganador(valores) {
    const [a, b] = valores;
    if (Math.abs(a.valor - b.valor) < 1e-9) return null;
    return a.valor > b.valor ? a.clave : b.clave;
}

function lectura(prueba, resultado) {
    const esperado = ganador(MODELOS.map(m => ({ clave: m.clave, valor: prueba.datos.generales[m.clave].accuracy })));

    if (!resultado) {
        return `<p class="lectura">Se espera que gane la <strong>${esperado}</strong>.
            Haz la prueba y pulsa <em>Evaluar</em> para ver si se cumple.</p>`;
    }

    const partes = MODELOS.map(m => {
        const e = prueba.datos.generales[m.clave].accuracy;
        const o = aciertosObtenidos(resultado, m.clave);
        const diferencia = Math.round((o.accuracy - e) * 100);
        const cambio = diferencia === 0 ? "igual que lo esperado"
            : `${Math.abs(diferencia)} puntos ${diferencia > 0 ? "más" : "menos"} que lo esperado`;

        // Si un modelo responde casi siempre lo mismo, se dice: explica por qué falla
        const preds = resultado.predicciones[m.clave].map(p => prueba.indice(Number(p)));
        const conteo = {};
        preds.forEach(p => { conteo[p] = (conteo[p] || 0) + 1; });
        const [masComun, veces] = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0] || [];
        const clasesProbadas = new Set(resultado.etiquetas_reales.map(r => prueba.indice(Number(r)))).size;
        const repetido = clasesProbadas > 1 && veces / preds.length >= 0.8
            ? ` Respondió «${escapar(prueba.datos.clases[masComun])}» en ${veces} de ${preds.length}.`
            : "";

        return `La <strong>${m.clave}</strong> acertó ${o.aciertos} de ${o.total} (${porcentaje(o.accuracy)}), ${cambio}.${repetido}`;
    });

    const enTuPrueba = ganador(MODELOS.map(m => ({ clave: m.clave, valor: aciertosObtenidos(resultado, m.clave).accuracy })));
    const veredicto = enTuPrueba === esperado
        ? `Como se esperaba, gana la <strong>${esperado}</strong>.`
        : enTuPrueba
            ? `Se esperaba que ganara la <strong>${esperado}</strong>, pero en tu prueba gana la <strong>${enTuPrueba}</strong>.`
            : `Se esperaba que ganara la <strong>${esperado}</strong>, pero en tu prueba empatan.`;

    return `<p class="lectura">${veredicto} ${partes.join(" ")}</p>`;
}

// ---------------------------------------------------------------
// Dibujo del contraste
// ---------------------------------------------------------------

function contexto(prueba, resultado) {
    const clases = prueba.datos.clases.map((c, i) =>
        `<span>${icono(prueba, i)}${escapar(c)}</span>`).join("");
    const estado = resultado
        ? `${resultado.etiquetas_reales.length} ${prueba.unidad[1]} evaluados · ${new Date(resultado.fecha).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}`
        : "Tu prueba: sin evaluar";

    return `
        <div class="contexto-datos">
            <div class="nombre-prueba">
                <h3 id="titulo-contraste-${prueba.numero}">${prueba.nombre}</h3>
                <button type="button" class="btn ir-prueba" data-prueba="${prueba.numero}">Hacer la prueba</button>
            </div>
            <p class="detalle">${prueba.detalle}</p>
            <div class="clases clases-${prueba.numero}">${clases}</div>
            <p class="nota-datos">${estado}</p>
        </div>
    `;
}

function dibujar() {
    document.getElementById("contraste").innerHTML = `
        <div class="barra-superior">
            <ul class="leyenda" aria-label="Colores de los modelos">
                ${MODELOS.map(m => `<li><span class="muestra" style="background:${m.color}"></span>${m.nombre}</li>`).join("")}
            </ul>
        </div>
        ${PRUEBAS.map(p => {
            const r = obtenidos[p.numero];
            return `
                <section class="fila-contraste" aria-labelledby="titulo-contraste-${p.numero}">
                    <div class="fila-resumen">
                        ${contexto(p, r)}
                        <div class="resumen-aciertos-contraste">
                            ${barrasAciertos(p, r)}
                            ${lectura(p, r)}
                        </div>
                    </div>
                    ${matrices(p, r)}
                </section>
            `;
        }).join("")}
    `;

    document.querySelectorAll(".ir-prueba").forEach(boton => {
        boton.addEventListener("click", () => {
            mostrarPrueba(Number(boton.dataset.prueba));
            document.querySelector(".seccion-pruebas").scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
}

// ---------------------------------------------------------------
// Resultados: recibir de los iframes y recuperar del almacenamiento
// ---------------------------------------------------------------

function resultadoValido(datos) {
    return datos && Array.isArray(datos.etiquetas_reales) && datos.predicciones
        && MODELOS.every(m => Array.isArray(datos.predicciones[m.clave])
            && datos.predicciones[m.clave].length === datos.etiquetas_reales.length);
}

function cargarGuardados() {
    PRUEBAS.forEach(p => {
        try {
            const datos = JSON.parse(localStorage.getItem(CLAVE_ALMACEN(p.numero)) || "null");
            if (resultadoValido(datos)) obtenidos[p.numero] = datos;
        } catch (err) {
            // Sin almacenamiento o datos dañados: la prueba queda sin evaluar.
        }
    });
}

function recibir(datos) {
    if (!resultadoValido(datos) || !(datos.prueba in obtenidos)) return;
    obtenidos[datos.prueba] = datos;
    dibujar();
}

window.addEventListener("message", evento => {
    if (evento.origin !== window.location.origin || !evento.data) return;
    if (evento.data.tipo === "resultados-prueba") recibir(evento.data.datos);
    if (evento.data.tipo === "resultados-borrados" && evento.data.prueba in obtenidos) {
        obtenidos[evento.data.prueba] = null;
        dibujar();
    }
});

// Si la prueba se hizo en otra pestaña del navegador, también se refleja aquí
window.addEventListener("storage", evento => {
    const prueba = PRUEBAS.find(p => evento.key === CLAVE_ALMACEN(p.numero));
    if (!prueba) return;
    try {
        obtenidos[prueba.numero] = evento.newValue ? JSON.parse(evento.newValue) : null;
    } catch (err) {
        obtenidos[prueba.numero] = null;
    }
    dibujar();
});

// ---------------------------------------------------------------
// Pestañas de las pruebas
// ---------------------------------------------------------------

function mostrarPrueba(numero) {
    document.querySelectorAll(".pestana").forEach(pestana => {
        const activa = Number(pestana.dataset.prueba) === numero;
        pestana.setAttribute("aria-selected", String(activa));
        pestana.tabIndex = activa ? 0 : -1;
        document.getElementById(pestana.getAttribute("aria-controls")).hidden = !activa;
    });

    // Cada prueba se carga la primera vez que se abre y luego sigue viva al cambiar de pestaña
    const iframe = document.querySelector(`#panel-prueba-${numero} iframe`);
    if (!iframe.getAttribute("src")) iframe.setAttribute("src", iframe.dataset.src);

    try {
        history.replaceState(null, "", `#prueba-${numero}`);
    } catch (err) {
        // Sin historial (vista previa): no importa.
    }
}

document.querySelectorAll(".pestana").forEach((pestana, i, todas) => {
    pestana.addEventListener("click", () => mostrarPrueba(Number(pestana.dataset.prueba)));
    pestana.addEventListener("keydown", evento => {
        if (evento.key !== "ArrowRight" && evento.key !== "ArrowLeft") return;
        const siguiente = todas[(i + (evento.key === "ArrowRight" ? 1 : todas.length - 1)) % todas.length];
        siguiente.focus();
        mostrarPrueba(Number(siguiente.dataset.prueba));
    });
});

// Las pruebas necesitan la API de Python (python -m api.main). Sin ella (por ejemplo en
// GitHub Pages) se avisa cómo iniciarla; el contraste con lo esperado se ve igual.
async function revisarServidor() {
    try {
        const respuesta = await fetch("api/info", { cache: "no-store" });
        if (!respuesta.ok) throw new Error(String(respuesta.status));
    } catch (err) {
        document.getElementById("aviso-servidor").hidden = false;
    }
}

cargarGuardados();
dibujar();
mostrarPrueba(window.location.hash === "#prueba-2" ? 2 : 1);
revisarServidor();
