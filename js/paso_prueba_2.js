// Paso 3 · Prueba 2: ¿qué estás haciendo?
//
// El teléfono (exploracion/sensor_prueba_2.html, abierto con el QR) envía cada 250 ms su
// última lectura y, al grabar, las muestras de 10 s. Toda la sesión vive en el servidor
// (los mismos endpoints que usa js/prueba_2.js en exploracion/prueba_2.html):
//   GET  /api/prueba_2/estado     -> ultima_muestra (t, ax, ay, az, …), fase, intentos
//   POST /api/prueba_2/reiniciar  -> borra los intentos (botón «Jugar de nuevo»)
// Aquí se muestran X, Y, Z del acelerómetro en vivo, un gráfico de los últimos segundos,
// la tabla de lecturas que reciben los robots y los INTENTOS_POR_PRUEBA espacios de grabación.
// En este paso NO se muestran aciertos: los resultados se ven en el paso 4.

(() => {
    const $ = Juego.$;
    const SEGUNDOS_GRAFICO = 10;
    const FILAS_TABLA = 10;
    const EJES = [
        { clave: "ax", nombre: "X", color: "#e8590c" },
        { clave: "ay", nombre: "Y", color: "#7048e8" },
        { clave: "az", nombre: "Z", color: "#343a40" }
    ];

    let lecturas = [];          // { t (s desde la primera), ax, ay, az, recibida (performance.now) }
    let t0 = null;
    let ultimaT = null;
    let intentosServidor = [];
    let generacion = 0;

    function decimal(v, d = 1) {
        return Number(v).toFixed(d).replace(".", ",").replace(/^-0,0$/, "0,0");
    }

    function estado(conectado, texto) {
        $("punto-2").className = `punto-sensor ${conectado ? "conectado" : "desconectado"}`;
        $("estado-2").textContent = texto;
    }

    // ---------------- Lecturas en vivo ----------------
    function registrar(m) {
        if (!m || m.t === ultimaT) return;
        ultimaT = m.t;
        if (t0 === null) t0 = m.t;
        lecturas.push({ t: (m.t - t0) / 1000, ax: m.ax, ay: m.ay, az: m.az, recibida: performance.now() / 1000 });
        const limite = performance.now() / 1000 - SEGUNDOS_GRAFICO - 1;
        lecturas = lecturas.filter(l => l.recibida >= limite);

        EJES.forEach(e => { $(`valor-${e.nombre.toLowerCase()}`).textContent = decimal(m[e.clave]); });

        $("cuerpo-lecturas").innerHTML = lecturas.slice(-FILAS_TABLA).reverse().map((l, i) => `
            <tr class="${i === 0 ? "reciente" : ""}">
                <td>${decimal(l.t)} s</td>${EJES.map(e => `<td>${decimal(l[e.clave], 2)}</td>`).join("")}
            </tr>`).join("");
    }

    function dibujarGrafico() {
        const c = $("grafico-ejes");
        if (!c.offsetParent) return;
        const dpr = window.devicePixelRatio || 1;
        const ancho = c.clientWidth;
        const alto = c.clientHeight;
        if (c.width !== Math.round(ancho * dpr) || c.height !== Math.round(alto * dpr)) {
            c.width = Math.round(ancho * dpr);
            c.height = Math.round(alto * dpr);
        }
        const g = c.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, ancho, alto);

        const ahora = performance.now() / 1000;
        const visibles = lecturas.filter(l => ahora - l.recibida <= SEGUNDOS_GRAFICO);
        const valores = visibles.flatMap(l => EJES.map(e => l[e.clave]));
        let min = Math.min(-2, ...valores);
        let max = Math.max(2, ...valores);
        const margen = (max - min) * 0.1;
        min -= margen;
        max += margen;
        const y = v => alto - ((v - min) / (max - min)) * alto;
        const x = l => ancho - ((ahora - l.recibida) / SEGUNDOS_GRAFICO) * ancho;

        // Línea del cero
        g.strokeStyle = "#d9e0f0";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, y(0));
        g.lineTo(ancho, y(0));
        g.stroke();

        EJES.forEach(e => {
            g.strokeStyle = e.color;
            g.lineWidth = 2;
            g.beginPath();
            // Se corta la línea si faltan datos más de 1 s (por ejemplo, teléfono desconectado)
            visibles.forEach((l, i) => {
                const salto = i === 0 || l.recibida - visibles[i - 1].recibida > 1;
                if (salto) g.moveTo(x(l), y(l[e.clave])); else g.lineTo(x(l), y(l[e.clave]));
            });
            g.stroke();
        });

        if (!visibles.length) {
            g.fillStyle = "#888";
            g.font = `${Math.max(12, alto / 9)}px system-ui, sans-serif`;
            g.textAlign = "center";
            g.fillText("Conecta el teléfono y activa sus sensores", ancho / 2, alto / 2);
        }
    }

    // ---------------- Grabaciones ----------------
    function pintarEspacios() {
        const primeros = intentosServidor.slice(0, INTENTOS_POR_PRUEBA);
        $("espacios-2").innerHTML = Array.from({ length: INTENTOS_POR_PRUEBA }, (_, k) => {
            const intento = primeros[k];
            if (!intento) return `<li class="espacio vacio"><span class="numero-espacio">${k + 1}</span></li>`;
            const nuevo = k === primeros.length - 1 ? " nuevo" : "";
            return `<li class="espacio lleno espacio-texto${nuevo}">
                <span class="numero-espacio">${k + 1}</span>
                <span class="nombre-espacio">${Juego.escapar(intento.nombre_real)}</span>
            </li>`;
        }).join("");
        $("contador-2").textContent = `${primeros.length} de ${INTENTOS_POR_PRUEBA}`;
    }

    let firma = null;
    async function consultar() {
        const e = await Juego.api("api/prueba_2/estado");
        if (e.conectado) registrar(e.ultima_muestra);

        const nuevaFirma = e.intentos.map(i => i.id).join(",");
        if (nuevaFirma !== firma) {
            firma = nuevaFirma;
            intentosServidor = e.intentos;
            pintarEspacios();
        }

        const progreso = $("progreso-2");
        const ocupado = ["cuenta_regresiva", "grabando", "procesando"].includes(e.fase);
        progreso.hidden = !ocupado;
        $("barra-progreso-2").style.width = `${Math.round((e.fase === "grabando" ? e.progreso : e.fase === "procesando" ? 1 : 0) * 100)}%`;

        if (e.fase === "cuenta_regresiva") estado(true, `¡Prepárate! ${e.nombre_actividad} en ${Math.ceil(e.segundos_para_iniciar)}…`);
        else if (e.fase === "grabando") estado(true, `Grabando: ${e.nombre_actividad}…`);
        else if (e.fase === "procesando") estado(true, "Guardando la grabación…");
        else if (e.error) estado(e.conectado, `⚠️ ${e.error}`);   // grabación cancelada o fallida
        else if (!e.conectado) estado(false, "Esperando teléfono…");
        else if (intentosServidor.length >= INTENTOS_POR_PRUEBA) estado(true, `¡Ya tienes las ${INTENTOS_POR_PRUEBA} grabaciones!`);
        else estado(true, "Teléfono conectado: elige la actividad y graba");
    }

    function iniciarCiclo() {
        const mia = ++generacion;
        const vuelta = async () => {
            if (mia !== generacion) return;
            try {
                await consultar();
            } catch (err) {
                estado(false, "Sin servidor de Python");
            }
            if (mia === generacion) setTimeout(vuelta, 250);
        };
        vuelta();
        const animar = () => {
            if (mia !== generacion) return;
            dibujarGrafico();
            requestAnimationFrame(animar);
        };
        requestAnimationFrame(animar);
    }

    pintarEspacios();
    Juego.alEntrar(3, () => {
        lecturas = [];   // el gráfico y la tabla empiezan de nuevo al volver a este paso
        iniciarCiclo();
    });
    Juego.alSalir(3, () => { generacion += 1; });

    Juego.prueba2 = {
        // Trae los intentos del servidor (los resultados se calculan en el paso 4)
        async actualizar() {
            const e = await Juego.api("api/prueba_2/estado");
            intentosServidor = e.intentos;
            firma = e.intentos.map(i => i.id).join(",");
            pintarEspacios();
        },
        intentos: () => intentosServidor.slice(0, INTENTOS_POR_PRUEBA).map(i => ({
            real: i.nombre_real,
            modelos: Object.fromEntries(Juego.ROBOTS.map(r => [r.clave, {
                dice: i.modelos[r.clave].actividad,
                correcto: i.modelos[r.clave].correcto
            }]))
        })),
        async reiniciar() {
            await Juego.post("api/prueba_2/reiniciar");
            intentosServidor = [];
            firma = "";
            pintarEspacios();
        }
    };
})();
