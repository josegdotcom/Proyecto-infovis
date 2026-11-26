// Experiencia (experiencia.html) «¿Qué red adivina mejor?»: flujo de 3 pasos en una sola página.
//
//   1 · El truco      (js/paso_truco.js)
//   2 · Los retos     (js/paso_retos.js)
//   3 · Resultados    (js/paso_resultados.js)
//
// Este archivo tiene lo compartido: la cantidad de retos, las redes, la conexión con la
// API de Python, el QR y la navegación entre pasos (una vista visible a la vez, sin
// recargar). Cada paso se registra con Juego.alEntrar / Juego.alSalir.

const RETOS_TOTAL = 5;

const Juego = (() => {
    // Las dos redes, en el orden en que se muestran y suenan (primero la CNN)
    const REDES = [
        { clave: "CNN", color: "var(--modelo-cnn)" },
        { clave: "MLP", color: "var(--modelo-mlp)" }
    ];

    const $ = id => document.getElementById(id);

    function escapar(texto) {
        return String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    // ---------------------------------------------------------------
    // API de Python
    // ---------------------------------------------------------------

    // La API sirve también las páginas (http://localhost:8000). Si la página se abre desde
    // otro servidor (por ejemplo Live Server), se busca la API en el puerto 8000 (CORS ya permitido).
    const BASES_API = [
        new URL("./", window.location.href).href,
        "http://localhost:8000/",
        "http://127.0.0.1:8000/"
    ];
    let baseApi = null;
    let info = null;

    async function buscarApi() {
        for (const base of BASES_API) {
            try {
                const r = await fetch(new URL("api/info", base), { cache: "no-store" });
                if (r.ok) {
                    const datos = await r.json();
                    if (datos && datos.ip_local) {
                        baseApi = base;
                        info = datos;
                        $("aviso-servidor").hidden = true;
                        return datos;
                    }
                }
            } catch (err) {
                // Probar la siguiente dirección
            }
        }
        baseApi = null;
        $("aviso-servidor").hidden = false;
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

    function post(ruta, cuerpo = {}) {
        return api(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    }

    // Dirección absoluta de un recurso de la API (por ejemplo la vista de la cámara)
    function urlApi(ruta) {
        return baseApi ? new URL(ruta, baseApi).href : null;
    }

    // ---------------------------------------------------------------
    // QR: la cámara y los sensores del teléfono exigen HTTPS (puerto 8443 del servidor)
    // ---------------------------------------------------------------

    function urlTelefono(pagina) {
        if (info && info.ip_local) {
            const protocolo = info.puerto_https ? "https" : "http";
            return `${protocolo}://${info.ip_local}:${info.puerto_https || info.puerto_http}/exploracion/${pagina}`;
        }
        return new URL(`exploracion/${pagina}`, window.location.href).href;
    }

    const qrPintados = {};
    function pintarQr(id, pagina) {
        const url = urlTelefono(pagina);
        if (qrPintados[id] === url) return;
        qrPintados[id] = url;
        const contenedor = $(id);
        contenedor.innerHTML = "";
        contenedor.title = url;
        if (typeof QRCode !== "undefined") {
            new QRCode(contenedor, { text: url, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.M });
        } else {
            contenedor.textContent = url;
        }
    }

    function pintarQrs() {
        pintarQr("qr-1", "telefono_retos.html");
    }

    // ---------------------------------------------------------------
    // Navegación entre pasos
    // ---------------------------------------------------------------

    const entradas = {};
    const salidas = {};
    let pasoActual = null;

    function alEntrar(paso, fn) { (entradas[paso] = entradas[paso] || []).push(fn); }
    function alSalir(paso, fn) { (salidas[paso] = salidas[paso] || []).push(fn); }

    function irA(paso, { enfocar = true } = {}) {
        paso = Math.min(3, Math.max(1, Number(paso) || 1));
        if (paso === pasoActual) return;
        if (pasoActual) (salidas[pasoActual] || []).forEach(fn => fn());

        document.querySelectorAll(".vista").forEach(v => { v.hidden = Number(v.dataset.paso) !== paso; });
        document.querySelectorAll(".paso-boton").forEach(b => {
            const n = Number(b.dataset.paso);
            b.classList.toggle("hecho", n < paso);
            if (n === paso) b.setAttribute("aria-current", "step");
            else b.removeAttribute("aria-current");
        });
        pasoActual = paso;

        try {
            history.replaceState(null, "", `#paso-${paso}`);
        } catch (err) {
            // Sin historial: no importa.
        }
        (entradas[paso] || []).forEach(fn => fn());
        if (enfocar) {
            const titulo = document.querySelector(`#paso-${paso} h1`);
            titulo.setAttribute("tabindex", "-1");
            titulo.focus({ preventScroll: true });
        }
    }

    function iniciar() {
        document.querySelectorAll("[data-ir]").forEach(b => b.addEventListener("click", () => irA(b.dataset.ir)));
        document.querySelectorAll(".paso-boton").forEach(b => b.addEventListener("click", () => irA(b.dataset.paso)));

        const desdeHash = /^#paso-([1-3])$/.exec(window.location.hash);
        irA(desdeHash ? desdeHash[1] : 1, { enfocar: false });

        buscarApi().then(pintarQrs);
        // Si el servidor aparece después (o cambia la IP), rehacer los QR
        setInterval(async () => {
            if (await buscarApi()) pintarQrs();
        }, 10000);
    }

    document.addEventListener("DOMContentLoaded", iniciar);

    return { REDES, $, escapar, api, post, urlApi, irA, alEntrar, alSalir };
})();
