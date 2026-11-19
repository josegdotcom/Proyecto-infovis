// Página principal pensada para niños y jóvenes: «¿Qué robot adivina mejor?».
//
// Cada modelo es un personaje: Robo-Lupa (CNN) y Robo-Lista (MLP). Para cada prueba:
//   «Lo que prometió»     -> aciertos esperados (Entrega 1, exploracion/datos.js) en 10 casillas
//   «Lo que logró contigo» -> una casilla por intento (✓ acertó / ✗ falló), en vivo
//   QR                     -> abre la prueba en el teléfono
// Las dos pruebas usan las mismas columnas, así cada robot de la Prueba 2 queda justo
// debajo del mismo robot en la Prueba 1. Al final, un tablero resume quién ganó cada una.
//
// Las pruebas se hacen desde el teléfono; esta página solo consulta al servidor de Python:
//   Prueba 1: /api/camara/estado. Cada vez que el teléfono pulsa «Capturar» con una
//             etiqueta (Gato/Perro), el servidor guarda esa captura con la predicción de
//             cada modelo. Aquí se cuentan como intentos y se guardan en el navegador.
//   Prueba 2: /api/prueba_2/estado. El servidor guarda todos los intentos de la sesión.

const ROBOTS = [
    {
        clave: "CNN",
        nombre: "Robo-Lupa",
        sigla: "CNN · red convolucional",
        piensa: "Mira el dibujo por pedacitos con su lupa: orejas, bigotes, cola.",
        color: "var(--modelo-cnn)",
        dibujo: `<svg viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 6V12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            <circle cx="32" cy="5" r="3" fill="currentColor"/>
            <rect x="12" y="12" width="40" height="30" rx="9" fill="currentColor"/>
            <circle cx="24" cy="26" r="5" fill="#fff"/><circle cx="40" cy="26" r="5" fill="#fff"/>
            <circle cx="25" cy="26" r="2.2" fill="#000"/><circle cx="41" cy="26" r="2.2" fill="#000"/>
            <path d="M25 35Q32 39 39 35" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <rect x="18" y="44" width="28" height="16" rx="5" fill="currentColor"/>
            <circle cx="52" cy="50" r="7" fill="#fff" stroke="#000" stroke-width="2.5"/>
            <path d="M46.5 55.5L41 61" stroke="#000" stroke-width="3" stroke-linecap="round"/>
        </svg>`
    },
    {
        clave: "MLP",
        nombre: "Robo-Lista",
        sigla: "MLP · red densa",
        piensa: "Lee una lista larga de números y busca patrones que se repiten.",
        color: "var(--modelo-mlp)",
        dibujo: `<svg viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 6V12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            <circle cx="32" cy="5" r="3" fill="currentColor"/>
            <rect x="12" y="12" width="40" height="30" rx="9" fill="currentColor"/>
            <rect x="19" y="22" width="10" height="8" rx="2" fill="#fff"/><rect x="35" y="22" width="10" height="8" rx="2" fill="#fff"/>
            <path d="M25 35H39" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="18" y="44" width="28" height="16" rx="5" fill="currentColor"/>
            <rect x="41" y="40" width="18" height="22" rx="2" fill="#fff" stroke="#000" stroke-width="2"/>
            <path d="M45 46H55M45 51H55M45 56H51" stroke="#000" stroke-width="2" stroke-linecap="round"/>
        </svg>`
    }
];

const PRUEBAS = [
    {
        numero: 1,
        datos: DATOS.p1,
        emoji: "🖍️",
        titulo: "¿Es un gato o un perro?",
        detalle: "Muestra un dibujo en papel a la cámara del teléfono",
        pagina: "sensor_camara.html",
        instruccion: "Elige <strong>Gato</strong> o <strong>Perro</strong> en el teléfono y pulsa <strong>Capturar</strong>.",
        unidad: "dibujos",
        intervalo: 800
    },
    {
        numero: 2,
        datos: DATOS.p2,
        emoji: "🏃",
        titulo: "¿Qué estás haciendo?",
        detalle: "El teléfono en tu cintura siente cómo te mueves",
        pagina: "sensor_prueba_2.html",
        instruccion: "Elige qué harás en el teléfono, ponlo <strong>en tu cintura</strong> y pulsa <strong>Grabar</strong>.",
        unidad: "movimientos",
        intervalo: 1000
    }
];

const CASILLAS = 10;
const CLAVE_P1 = "infovis:intentos-prueba-1";

// Intentos de cada prueba: { real: "Gato", modelos: { CNN: { dice, correcto }, MLP: {...} } }
const intentos = { 1: [], 2: [] };

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------
// API de Python
// ---------------------------------------------------------------

// La API de Python sirve también las páginas (http://localhost:8000). Si la página se abre
// desde otro servidor (por ejemplo Live Server en el puerto 5500), se busca la API en el
// puerto 8000 del mismo equipo; el servidor de Python permite estas consultas (CORS).
const BASES_API = [
    new URL("./", window.location.href).href,
    "http://localhost:8000/",
    "http://127.0.0.1:8000/"
];
let baseApi = null;

async function buscarApi() {
    for (const base of BASES_API) {
        try {
            const r = await fetch(new URL("api/info", base), { cache: "no-store" });
            if (r.ok) {
                const info = await r.json();
                if (info && info.ip_local) {
                    baseApi = base;
                    return info;
                }
            }
        } catch (err) {
            // Probar la siguiente dirección
        }
    }
    baseApi = null;
    return null;
}

async function api(ruta, opciones = { cache: "no-store" }) {
    if (!baseApi) {
        await buscarApi();
        if (!baseApi) throw new Error("Sin servidor de Python");
    }
    try {
        const r = await fetch(new URL(ruta, baseApi), opciones);
        if (!r.ok) throw new Error(String(r.status));
        return await r.json();
    } catch (err) {
        baseApi = null; // volver a buscar en la próxima consulta
        throw err;
    }
}

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------

function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function robot(clave) {
    return ROBOTS.find(r => r.clave === clave);
}

function nombreConColor(r) {
    return `<strong class="nombre-robot" style="--color:${r.color}">${r.nombre}</strong>`;
}

// Pictogramas de las actividades (los mismos de la Entrega 1)
const ESCALERA = '<path d="M3 26H10V21H17V16H25"/>';
const PERSONA_ESCALERA = '<circle cx="11" cy="5" r="2.4"/><path d="M11 7.5L12 15M12 15L10.5 21M12 15L16.5 13L17 16M11.3 10L15.5 11.5M11.3 10L8.5 13.5"/>';
const FIGURAS = {
    "Camina": '<circle cx="14" cy="5" r="2.4"/><path d="M14 7.5V17M14 17L9.5 25.5M14 17L18 21L19 25.5M14 10.5L9.5 14.5M14 10.5L18.5 14"/>',
    "Sube": `${ESCALERA}${PERSONA_ESCALERA}<path d="M20 9L25 4M21 4H25V8"/>`,
    "Baja": `<g transform="translate(28 0) scale(-1 1)">${ESCALERA}${PERSONA_ESCALERA}</g><path d="M3 4L8 9M4 9H8V5"/>`,
    "Sentado": '<circle cx="12" cy="6" r="2.4"/><path d="M12 8.5V17H19V25.5M12 12L17 14.5"/><path d="M8 9V25.5M8 20H15.5V25.5"/>',
    "Parado": '<circle cx="14" cy="5" r="2.4"/><path d="M14 7.5V18M14 18L12 26M14 18L16 26M14 10.5L11 17M14 10.5L17 17"/>',
    "Acostado": '<circle cx="6.5" cy="16.5" r="2.4"/><path d="M9 17.5H25M12 17.5L16 14.5"/><path d="M3 21.5H26M4 21.5V25M25 21.5V25"/>'
};

// Ícono de la casilla k: en dibujos se alternan gato y perro; en movimientos, las actividades
function iconoCasilla(prueba, k) {
    if (prueba.numero === 1) {
        return `<img src="assets/images/${k % 2 ? "perro" : "gato"}.svg" alt="">`;
    }
    const clases = prueba.datos.clases;
    return `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FIGURAS[clases[k % clases.length]]}</svg>`;
}

// ---------------------------------------------------------------
// Estructura de la página
// ---------------------------------------------------------------

function filaRobot(prueba, r) {
    const esperado = prueba.datos.generales[r.clave].accuracy;
    const deDiez = Math.round(esperado * CASILLAS);
    const casillas = Array.from({ length: CASILLAS }, (_, k) =>
        `<span class="casilla ${k < deDiez ? "llena" : ""}">${iconoCasilla(prueba, k)}</span>`).join("");
    const id = `${prueba.numero}-${r.clave}`;

    return `
        <div class="celda-robot" style="--color:${r.color}">
            <span class="cara">${r.dibujo}</span>
            <span><strong>${r.nombre}</strong><small>${r.clave}</small></span>
        </div>
        <div class="celda-casillas" data-etiqueta="Prometió" style="--color:${r.color}"
             title="${r.nombre} (${r.clave}) acertó el ${Math.round(esperado * 100)} % en los datos de prueba de la Entrega 1">
            <div class="casillas" role="img" aria-label="${r.nombre} prometió acertar ${deDiez} de cada 10">${casillas}</div>
            <span class="cuenta"><b>${deDiez}</b> de 10</span>
        </div>
        <div class="celda-casillas" data-etiqueta="Logró" style="--color:${r.color}">
            <div class="casillas intentos" id="intentos-${id}" role="img" aria-live="polite"></div>
            <span class="cuenta" id="cuenta-${id}">—</span>
        </div>
    `;
}

function construir() {
    $("personajes").innerHTML = ROBOTS.map(r => `
        <article class="personaje" style="--color:${r.color}">
            <span class="cara">${r.dibujo}</span>
            <div>
                <h2>${r.nombre} <small>${r.sigla}</small></h2>
                <p>${r.piensa}</p>
            </div>
        </article>
    `).join("");

    $("pruebas").innerHTML = PRUEBAS.map(p => `
        <section class="prueba" aria-labelledby="titulo-${p.numero}">
            <h2 class="titulo-prueba" id="titulo-${p.numero}">
                <span aria-hidden="true">${p.emoji}</span> Prueba ${p.numero} · ${p.titulo}
                <small>${p.detalle}</small>
            </h2>

            <div class="tabla-robots">
                <span class="columna"></span>
                <span class="columna">Lo que prometió <small>de cada 10</small></span>
                <span class="columna">Lo que logró contigo <small>tus últimos 10 intentos</small></span>
                ${ROBOTS.map(r => filaRobot(p, r)).join("")}
                <p class="frase" id="frase-${p.numero}" aria-live="polite"></p>
            </div>

            <aside class="bloque-qr">
                <div class="qr" id="qr-${p.numero}" role="img" aria-label="Código QR para jugar con el teléfono"></div>
                <p class="estado"><span class="punto-sensor desconectado" id="punto-${p.numero}"></span><span id="estado-${p.numero}">Esperando teléfono…</span></p>
                <p class="instruccion">${p.instruccion}</p>
                <button type="button" class="btn btn-reiniciar" id="reiniciar-${p.numero}" hidden>Empezar de nuevo</button>
                <a class="enlace" id="enlace-${p.numero}" href="exploracion/${p.pagina}" target="_blank" rel="noopener"></a>
            </aside>
        </section>
    `).join("");

    $("reiniciar-1").addEventListener("click", () => {
        intentos[1] = [];
        guardarP1();
        pintar(PRUEBAS[0]);
    });

    $("reiniciar-2").addEventListener("click", async () => {
        if (!window.confirm("¿Borrar los intentos de la prueba de movimiento?")) return;
        try {
            await api("api/prueba_2/reiniciar", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        } catch (err) {
            // Sin servidor: la próxima consulta lo indicará.
        }
    });
}

// ---------------------------------------------------------------
// Resultados en vivo
// ---------------------------------------------------------------

function ganadorEsperado(prueba) {
    const [a, b] = ROBOTS.map(r => prueba.datos.generales[r.clave].accuracy);
    return a >= b ? ROBOTS[0] : ROBOTS[1];
}

// null si no hay intentos; "empate" si aciertan lo mismo
function ganadorObtenido(prueba) {
    const lista = intentos[prueba.numero];
    if (!lista.length) return null;
    const [a, b] = ROBOTS.map(r => lista.filter(i => i.modelos[r.clave].correcto).length);
    if (a === b) return "empate";
    return a > b ? ROBOTS[0] : ROBOTS[1];
}

function frase(prueba) {
    const lista = intentos[prueba.numero];
    const prometio = ganadorEsperado(prueba);
    if (!lista.length) {
        return `Escanea el QR y ¡a jugar! ${nombreConColor(prometio)} promete ganar esta prueba.`;
    }

    const ganador = ganadorObtenido(prueba);
    let texto;
    if (ganador === "empate") {
        texto = `🤝 ¡Por ahora van empatados! ${nombreConColor(prometio)} prometió ganar.`;
    } else if (ganador === prometio) {
        texto = `🏆 Ganó ${nombreConColor(ganador)}, ¡como prometió!`;
    } else {
        texto = `😮 ¡Sorpresa! Prometió ganar ${nombreConColor(prometio)}, pero contigo ganó ${nombreConColor(ganador)}.`;
    }

    // Si un robot responde siempre lo mismo aunque cambie la respuesta correcta, se dice
    const respuestasReales = new Set(lista.map(i => i.real));
    if (lista.length >= 3 && respuestasReales.size > 1) {
        ROBOTS.forEach(r => {
            const dichas = new Set(lista.map(i => i.modelos[r.clave].dice));
            if (dichas.size === 1) {
                texto += ` 🤔 ${nombreConColor(r)} dijo «${escapar([...dichas][0])}» todas las veces… ¡se confundió!`;
            }
        });
    }
    return texto;
}

function pintar(prueba) {
    const lista = intentos[prueba.numero];
    const n = lista.length;

    ROBOTS.forEach(r => {
        const id = `${prueba.numero}-${r.clave}`;
        const aciertos = lista.filter(i => i.modelos[r.clave].correcto).length;
        // Efecto de barra: primero todos los aciertos (izquierda), luego los errores y al
        // final los espacios libres. Dentro de cada grupo se mantiene el orden de los intentos.
        const ultimos = lista.slice(-CASILLAS).map((intento, k) => ({
            intento,
            numero: n - Math.min(n, CASILLAS) + k + 1,
            respuesta: intento.modelos[r.clave]
        }));
        const ordenados = [
            ...ultimos.filter(u => u.respuesta.correcto),
            ...ultimos.filter(u => !u.respuesta.correcto)
        ];

        const casillas = Array.from({ length: CASILLAS }, (_, k) => {
            const u = ordenados[k];
            if (!u) return `<span class="casilla vacia"></span>`;
            const nuevo = u.numero === n ? " nuevo" : "";
            return `<span class="casilla ${u.respuesta.correcto ? "acierto" : "error"}${nuevo}"
                title="Intento ${u.numero}: era ${escapar(u.intento.real)}, ${r.nombre} dijo ${escapar(u.respuesta.dice)}">${u.respuesta.correcto ? "✓" : "✗"}</span>`;
        }).join("");

        const contenedor = $(`intentos-${id}`);
        contenedor.innerHTML = casillas;
        contenedor.setAttribute("aria-label", n
            ? `${r.nombre} acertó ${aciertos} de ${n} intentos`
            : `${r.nombre} todavía no tiene intentos`);
        $(`cuenta-${id}`).innerHTML = n ? `<b>${aciertos}</b> de ${n}` : "—";
    });

    $(`frase-${prueba.numero}`).innerHTML = frase(prueba);
    $(`reiniciar-${prueba.numero}`).hidden = n === 0;
    pintarTablero();
}

// Tablero final: quién gana cada prueba (en tus intentos, o lo prometido si aún no juegas)
function pintarTablero() {
    const filas = ROBOTS.map(r => `
        <tr>
            <th scope="row" style="--color:${r.color}"><span class="cara">${r.dibujo}</span>${r.nombre}</th>
            ${PRUEBAS.map(p => {
                const ganador = ganadorObtenido(p) ?? ganadorEsperado(p);
                const jugado = intentos[p.numero].length > 0;
                const gana = ganador === r || ganador === "empate";
                const simbolo = ganador === "empate" ? "🤝" : (gana ? "🏆" : "");
                return `<td class="${jugado ? "" : "prometido"}">${simbolo || "<span class=\"nada\">—</span>"}</td>`;
            }).join("")}
        </tr>
    `).join("");

    const ganadores = PRUEBAS.map(p => ganadorObtenido(p));
    const ambasJugadas = ganadores.every(g => g && g !== "empate");
    let mensaje;
    if (ambasJugadas && ganadores[0] !== ganadores[1]) {
        mensaje = "¡Lo descubriste! Cada robot es bueno en cosas distintas. Por eso no hay una red neuronal que sirva para todo.";
    } else if (ambasJugadas) {
        mensaje = `Contigo ${ganadores[0].nombre} ganó las dos pruebas. ¿Pasará lo mismo si juegas más veces? Lo prometido dice que cada robot es bueno en cosas distintas.`;
    } else {
        mensaje = "Cada robot es bueno en cosas distintas. Por eso no hay una red neuronal que sirva para todo. ¡Juega las dos pruebas para comprobarlo!";
    }

    $("tablero").innerHTML = `
        <h2>¿Quién ganó cada prueba?</h2>
        <table>
            <thead><tr><th scope="col"><span class="solo-lectores">Robot</span></th>
                ${PRUEBAS.map(p => `<th scope="col"><span aria-hidden="true">${p.emoji}</span> ${p.unidad[0].toUpperCase()}${p.unidad.slice(1)}</th>`).join("")}
            </tr></thead>
            <tbody>${filas}</tbody>
        </table>
        <p class="nota-tablero">Los trofeos grises son lo prometido; se pintan cuando juegas esa prueba.</p>
        <p class="mensaje-final">${mensaje}</p>
    `;
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
    const e = await api("api/camara/estado");
    const seq = e.captura_seq || 0;
    const clases = prueba.datos.clases;

    // Primera consulta (o servidor reiniciado): no contar capturas anteriores
    if (ultimaCaptura === null || seq < ultimaCaptura) {
        ultimaCaptura = seq;
        guardarP1();
    }

    const c = e.ultima_captura;
    if (seq > ultimaCaptura && c && c.captura_seq === seq && c.etiqueta !== null && c.modelos) {
        intentos[1].push({
            real: clases[c.etiqueta],
            modelos: Object.fromEntries(ROBOTS.map(r => [r.clave, {
                dice: clases[c.modelos[r.clave].prediccion],
                correcto: c.modelos[r.clave].prediccion === c.etiqueta
            }]))
        });
        ultimaCaptura = seq;
        guardarP1();
        pintar(prueba);
    }

    if (!e.conectado) {
        estado(prueba, false, "Esperando teléfono…");
    } else if (e.tiene_dibujo && e.modelos) {
        estado(prueba, true, `Veo un dibujo: Robo-Lupa dice ${clases[e.modelos.CNN.prediccion]}, Robo-Lista dice ${clases[e.modelos.MLP.prediccion]}`);
    } else {
        estado(prueba, true, "¡Teléfono listo! Muestra un dibujo");
    }
}

// ---------------------------------------------------------------
// Prueba 2: el servidor guarda todos los intentos
// ---------------------------------------------------------------

let firmaP2 = null;

async function consultarP2() {
    const prueba = PRUEBAS[1];
    const e = await api("api/prueba_2/estado");
    const clases = prueba.datos.clases;

    const firma = e.intentos.map(i => i.id).join(",");
    if (firma !== firmaP2) {
        firmaP2 = firma;
        // Las actividades llegan como 1..6, en el mismo orden que DATOS.p2.clases
        intentos[2] = e.intentos.map(i => ({
            real: clases[i.actividad_real - 1],
            modelos: Object.fromEntries(ROBOTS.map(r => [r.clave, {
                dice: clases[i.modelos[r.clave].prediccion - 1],
                correcto: i.modelos[r.clave].correcto
            }]))
        }));
        pintar(prueba);
    }

    const actividad = e.actividad ? clases[e.actividad - 1] : "";
    const textos = {
        cuenta_regresiva: `¡Prepárate! ${actividad} en ${Math.ceil(e.segundos_para_iniciar)}…`,
        grabando: `Grabando: ${actividad} ${Math.round(e.progreso * 100)} %`,
        procesando: "Los robots están pensando…"
    };
    estado(prueba, e.conectado, textos[e.fase] || (e.conectado ? "¡Teléfono listo!" : "Esperando teléfono…"));
}

// ---------------------------------------------------------------
// QR y consultas periódicas
// ---------------------------------------------------------------

let qrConServidor = false;   // el QR ya apunta a la IP local que entrega el servidor

async function prepararQr() {
    const info = await buscarApi();
    if (!info) $("aviso-servidor").hidden = false;
    qrConServidor = Boolean(info);

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
            new QRCode(qr, { text: url, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
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
            // Si el servidor se inició después de abrir la página, rehacer el QR
            if (!qrConServidor) {
                qrConServidor = true;
                prepararQr();
            }
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
