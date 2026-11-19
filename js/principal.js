// Página principal: para cada prueba, lo esperado (Entrega 1), los resultados de la prueba
// en vivo y el QR para hacerla con el teléfono.
//
// Las pruebas se hacen desde el teléfono; esta página solo consulta al servidor de Python:
//   Prueba 1: /api/camara/estado. Cada vez que el teléfono pulsa «Capturar» con una
//             etiqueta (Gato/Perro), el servidor guarda esa captura con la predicción de
//             cada modelo. Aquí se cuentan como intentos y se guardan en el navegador.
//   Prueba 2: /api/prueba_2/estado. El servidor guarda todos los intentos de la sesión.

const MODELOS = [
    { clave: "CNN", color: "var(--modelo-cnn)" },
    { clave: "MLP", color: "var(--modelo-mlp)" }
];

const PRUEBAS = [
    {
        numero: 1,
        datos: DATOS.p1,
        titulo: "Prueba 1 · ¿Gato o perro?",
        detalle: "Un dibujo en papel frente a la cámara del teléfono",
        pagina: "sensor_camara.html",
        instruccion: "En el teléfono elige <strong>Gato</strong> o <strong>Perro</strong> y pulsa <strong>Capturar</strong>.",
        intervalo: 800
    },
    {
        numero: 2,
        datos: DATOS.p2,
        titulo: "Prueba 2 · ¿Qué estás haciendo?",
        detalle: "Los sensores del teléfono en la cintura durante 10 s",
        pagina: "sensor_prueba_2.html",
        instruccion: "En el teléfono elige la actividad, ponlo <strong>vertical en la cintura</strong> y graba.",
        intervalo: 1000
    }
];

const MAX_MARCAS = 24;              // intentos visibles como ✓/✗ bajo cada barra
const CLAVE_P1 = "infovis:intentos-prueba-1";

// Intentos de cada prueba: { real: "Gato", modelos: { CNN: { dice, correcto }, MLP: {...} } }
const intentos = { 1: [], 2: [] };

const $ = id => document.getElementById(id);

function porcentaje(valor) {
    return `${Math.round(valor * 100)} %`;
}

function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------------------------------------------------------
// Estructura de la página
// ---------------------------------------------------------------

function filaBarra(prueba, modelo, tipo) {
    const id = `${tipo}-${prueba.numero}-${modelo.clave}`;
    const esperado = prueba.datos.generales[modelo.clave].accuracy;
    return `
        <dt>${modelo.clave}</dt>
        <dd class="pista" id="pista-${id}">
            <i id="barra-${id}" style="background:${modelo.color};width:${tipo === "esperado" ? esperado * 100 : 0}%"></i>
        </dd>
        <dd class="valor" id="valor-${id}">${tipo === "esperado" ? porcentaje(esperado) : "—"}</dd>
        <dd class="marcas" id="marcas-${id}" aria-hidden="true"></dd>
    `;
}

function construir() {
    $("pruebas").innerHTML = PRUEBAS.map(p => `
        <section class="prueba" aria-labelledby="titulo-${p.numero}">
            <div class="titulo-prueba">
                <h2 id="titulo-${p.numero}">${p.titulo}</h2>
                <p>${p.detalle}</p>
            </div>

            <div class="bloque">
                <h3>Esperado <span>aciertos en los datos de prueba (Entrega 1)</span></h3>
                <dl class="barras">${MODELOS.map(m => filaBarra(p, m, "esperado")).join("")}</dl>
            </div>

            <div class="bloque">
                <h3>Tu prueba <span id="contador-${p.numero}">sin intentos</span></h3>
                <dl class="barras" aria-live="polite">${MODELOS.map(m => filaBarra(p, m, "obtenido")).join("")}</dl>
                <div class="pie-bloque">
                    <p class="ultimo" id="ultimo-${p.numero}"></p>
                    <button type="button" class="btn btn-reiniciar" id="reiniciar-${p.numero}" hidden>Reiniciar</button>
                </div>
            </div>

            <div class="bloque bloque-qr">
                <div class="qr" id="qr-${p.numero}" role="img" aria-label="Código QR para abrir la prueba en el teléfono"></div>
                <p class="estado"><span class="punto-sensor desconectado" id="punto-${p.numero}"></span><span id="estado-${p.numero}">Esperando teléfono…</span></p>
                <p class="instruccion">${p.instruccion}</p>
                <a class="enlace" id="enlace-${p.numero}" href="exploracion/${p.pagina}" target="_blank" rel="noopener"></a>
            </div>
        </section>
    `).join("");

    $("reiniciar-1").addEventListener("click", () => {
        intentos[1] = [];
        guardarP1();
        pintar(PRUEBAS[0]);
    });

    $("reiniciar-2").addEventListener("click", async () => {
        if (!window.confirm("¿Borrar los intentos de la Prueba 2?")) return;
        try {
            await fetch("api/prueba_2/reiniciar", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        } catch (err) {
            // Sin servidor: la próxima consulta lo indicará.
        }
    });
}

// ---------------------------------------------------------------
// Resultados de la prueba: barras + ✓/✗ de cada intento
// ---------------------------------------------------------------

function pintar(prueba) {
    const lista = intentos[prueba.numero];
    const n = lista.length;

    MODELOS.forEach(m => {
        const id = `obtenido-${prueba.numero}-${m.clave}`;
        const aciertos = lista.filter(i => i.modelos[m.clave].correcto).length;
        const parte = n ? aciertos / n : 0;

        $(`barra-${id}`).style.width = `${parte * 100}%`;
        $(`pista-${id}`).classList.toggle("vacia", n === 0);
        $(`valor-${id}`).innerHTML = n ? `${porcentaje(parte)}<small>${aciertos}/${n}</small>` : "—";
        $(`marcas-${id}`).innerHTML = lista.slice(-MAX_MARCAS).map(i => {
            const r = i.modelos[m.clave];
            return `<span class="${r.correcto ? "bien" : "mal"}" title="Real: ${escapar(i.real)} · ${m.clave} dijo ${escapar(r.dice)}">${r.correcto ? "✓" : "✗"}</span>`;
        }).join("");
    });

    $(`contador-${prueba.numero}`).textContent = n === 0 ? "sin intentos" : `${n} ${n === 1 ? "intento" : "intentos"}`;
    $(`reiniciar-${prueba.numero}`).hidden = n === 0;

    const ultimo = lista[n - 1];
    $(`ultimo-${prueba.numero}`).innerHTML = ultimo
        ? `Último: <strong>${escapar(ultimo.real)}</strong> → ${MODELOS.map(m => {
            const r = ultimo.modelos[m.clave];
            return `${m.clave} <span class="${r.correcto ? "bien" : "mal"}">${r.correcto ? "✓" : "✗"} ${escapar(r.dice)}</span>`;
        }).join(" · ")}`
        : "";
}

// Resalta la barra que acaba de cambiar
function destacar(prueba) {
    MODELOS.forEach(m => {
        const pista = $(`pista-obtenido-${prueba.numero}-${m.clave}`);
        pista.classList.remove("nuevo");
        void pista.offsetWidth;
        pista.classList.add("nuevo");
    });
}

function estado(prueba, conectado, texto) {
    $(`punto-${prueba.numero}`).className = `punto-sensor ${conectado ? "conectado" : "desconectado"}`;
    $(`estado-${prueba.numero}`).textContent = texto;
}

// ---------------------------------------------------------------
// Prueba 1: capturas del teléfono (el servidor guarda solo la última)
// ---------------------------------------------------------------

let ultimaCaptura = null;   // captura_seq ya contada

function guardarP1() {
    try {
        localStorage.setItem(CLAVE_P1, JSON.stringify({ intentos: intentos[1], ultimaCaptura }));
    } catch (err) {
        // Sin almacenamiento: los intentos duran mientras la página esté abierta.
    }
}

function cargarP1() {
    try {
        const guardado = JSON.parse(localStorage.getItem(CLAVE_P1) || "null");
        if (guardado && Array.isArray(guardado.intentos)) {
            intentos[1] = guardado.intentos;
            ultimaCaptura = guardado.ultimaCaptura ?? null;
        }
    } catch (err) {
        // Datos dañados: se empieza de cero.
    }
}

async function consultarP1() {
    const prueba = PRUEBAS[0];
    const e = await (await fetch("api/camara/estado", { cache: "no-store" })).json();
    const seq = e.captura_seq || 0;

    // Primera consulta (o servidor reiniciado): no contar capturas anteriores
    if (ultimaCaptura === null || seq < ultimaCaptura) {
        ultimaCaptura = seq;
        guardarP1();
    }

    const c = e.ultima_captura;
    if (seq > ultimaCaptura && c && c.captura_seq === seq && c.etiqueta !== null && c.modelos) {
        const clases = prueba.datos.clases;
        intentos[1].push({
            real: clases[c.etiqueta],
            modelos: Object.fromEntries(MODELOS.map(m => [m.clave, {
                dice: clases[c.modelos[m.clave].prediccion],
                correcto: c.modelos[m.clave].prediccion === c.etiqueta
            }]))
        });
        ultimaCaptura = seq;
        guardarP1();
        pintar(prueba);
        destacar(prueba);
    }

    if (!e.conectado) {
        estado(prueba, false, "Esperando teléfono…");
    } else if (e.tiene_dibujo && e.modelos) {
        const clases = prueba.datos.clases;
        estado(prueba, true, `Viendo un dibujo: CNN ${clases[e.modelos.CNN.prediccion]} · MLP ${clases[e.modelos.MLP.prediccion]}`);
    } else {
        estado(prueba, true, "Teléfono conectado");
    }
}

// ---------------------------------------------------------------
// Prueba 2: el servidor guarda todos los intentos
// ---------------------------------------------------------------

let firmaP2 = "";

async function consultarP2() {
    const prueba = PRUEBAS[1];
    const e = await (await fetch("api/prueba_2/estado", { cache: "no-store" })).json();
    const clases = prueba.datos.clases;

    const firma = e.intentos.map(i => i.id).join(",");
    if (firma !== firmaP2) {
        const huboNuevo = e.intentos.length > intentos[2].length && firmaP2 !== "";
        firmaP2 = firma;
        // Las actividades llegan como 1..6, en el mismo orden que DATOS.p2.clases
        intentos[2] = e.intentos.map(i => ({
            real: clases[i.actividad_real - 1],
            modelos: Object.fromEntries(MODELOS.map(m => [m.clave, {
                dice: clases[i.modelos[m.clave].prediccion - 1],
                correcto: i.modelos[m.clave].correcto
            }]))
        }));
        pintar(prueba);
        if (huboNuevo) destacar(prueba);
    }

    const actividad = e.actividad ? clases[e.actividad - 1] : "";
    const textos = {
        cuenta_regresiva: `Ponte en posición: ${actividad} en ${Math.ceil(e.segundos_para_iniciar)} s`,
        grabando: `Grabando ${actividad}… ${Math.round(e.progreso * 100)} %`,
        procesando: "Los modelos están analizando…"
    };
    estado(prueba, e.conectado, textos[e.fase] || (e.conectado ? "Teléfono conectado" : "Esperando teléfono…"));
}

// ---------------------------------------------------------------
// QR y consultas periódicas
// ---------------------------------------------------------------

async function prepararQr() {
    let info = null;
    try {
        info = await (await fetch("api/info", { cache: "no-store" })).json();
    } catch (err) {
        $("aviso-servidor").hidden = false;
    }

    PRUEBAS.forEach(p => {
        // La cámara y los sensores del teléfono exigen HTTPS: se usa el puerto 8443 del servidor
        let url = new URL(`exploracion/${p.pagina}`, window.location.href).href;
        if (info && info.ip_local) {
            const protocolo = info.puerto_https ? "https" : "http";
            url = `${protocolo}://${info.ip_local}:${info.puerto_https || info.puerto_http}/exploracion/${p.pagina}`;
        }

        const enlace = $(`enlace-${p.numero}`);
        enlace.href = url;
        enlace.textContent = url.replace(/^https?:\/\//, "");

        const qr = $(`qr-${p.numero}`);
        if (typeof QRCode !== "undefined") {
            qr.innerHTML = "";
            new QRCode(qr, { text: url, width: 168, height: 168, correctLevel: QRCode.CorrectLevel.M });
        } else {
            qr.textContent = "Abre el enlace en el teléfono.";
        }
    });
}

function consultarCada(prueba, consultar) {
    let fallos = 0;
    const ciclo = async () => {
        try {
            await consultar();
            fallos = 0;
            $("aviso-servidor").hidden = true;
        } catch (err) {
            fallos += 1;
            estado(prueba, false, "Sin servidor de Python");
            if (fallos > 1) $("aviso-servidor").hidden = false;
        }
        // Sin servidor se consulta con menos frecuencia
        setTimeout(ciclo, fallos ? 4000 : prueba.intervalo);
    };
    ciclo();
}

cargarP1();
construir();
PRUEBAS.forEach(pintar);
prepararQr();
consultarCada(PRUEBAS[0], consultarP1);
consultarCada(PRUEBAS[1], consultarP2);
