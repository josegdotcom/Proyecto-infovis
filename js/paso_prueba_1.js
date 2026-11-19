// Paso 2 · Prueba 1: ¿es un gato o un perro?
//
// El teléfono (exploracion/sensor_camara.html, abierto con el QR) mira la pizarra y envía
// cada frame al puente local de Python. Aquí:
//   - la cámara en vivo se muestra con GET /api/camara/vista (JPEG pequeño de cada frame);
//     si no hay vista previa, se dibuja la matriz de 28×28 que ve el modelo;
//   - cada vez que el teléfono pulsa «Capturar» con una etiqueta (Gato/Perro), el servidor
//     guarda la captura con la predicción de cada modelo (/api/camara/estado). Se cuentan
//     las primeras INTENTOS_POR_PRUEBA y se guardan en el navegador.
// En este paso NO se muestran aciertos: los resultados se ven en el paso 4.
//
// (exploracion/prueba_1.html sigue funcionando aparte, también con Protobject.)

(() => {
    const $ = Juego.$;
    const CLAVE = "infovis:pasos-prueba-1";
    const CLASES = DATOS.p1.clases;              // ["Gato", "Perro"]
    const IMAGENES = ["assets/images/gato.svg", "assets/images/perro.svg"];

    // { etiqueta, pixeles, imagen, modelos: { CNN: { prediccion }, MLP: { prediccion } } }
    let intentos = [];
    let ultimaCaptura = null;   // captura_seq ya revisada
    let generacion = 0;         // evita ciclos duplicados al entrar y salir del paso

    function guardar() {
        try {
            localStorage.setItem(CLAVE, JSON.stringify({ intentos, ultimaCaptura }));
        } catch (err) {
            // Sin espacio: se intenta sin las fotos
            try {
                localStorage.setItem(CLAVE, JSON.stringify({ intentos: intentos.map(i => ({ ...i, imagen: null })), ultimaCaptura }));
            } catch (err2) {
                // Sin almacenamiento: dura mientras la página esté abierta.
            }
        }
    }

    function cargar() {
        try {
            const datos = JSON.parse(localStorage.getItem(CLAVE) || "null");
            if (datos && Array.isArray(datos.intentos)) {
                intentos = datos.intentos.slice(0, INTENTOS_POR_PRUEBA);
                ultimaCaptura = datos.ultimaCaptura ?? null;
            }
        } catch (err) {
            // Datos dañados: se empieza de cero.
        }
    }

    // ---------------- Dibujo de la matriz 28×28 ----------------
    function pintar28(canvas, pixeles) {
        const g = canvas.getContext("2d");
        const img = g.createImageData(28, 28);
        for (let i = 0; i < 784; i++) {
            const v = 255 - (pixeles[i] || 0);
            img.data.set([v, v, v, 255], i * 4);
        }
        g.putImageData(img, 0, 0);
    }

    // ---------------- Tarjeta y espacios ----------------
    function pintarTarjeta() {
        const k = intentos.length;
        const tarjeta = $("tarjeta-dibujo");
        if (k >= INTENTOS_POR_PRUEBA) {
            tarjeta.innerHTML = `<p class="tarjeta-titulo">¡Listo!</p><p class="tarjeta-texto">Ya dibujaste ${INTENTOS_POR_PRUEBA} veces. Pulsa <strong>Siguiente</strong>.</p>`;
            tarjeta.classList.add("lista");
            return;
        }
        // Se alterna gato y perro para que los robots vean de los dos
        const clase = k % 2;
        tarjeta.classList.remove("lista");
        tarjeta.innerHTML = `
            <p class="tarjeta-titulo">Tarjeta ${k + 1}: dibuja un</p>
            <img src="${IMAGENES[clase]}" alt="">
            <p class="tarjeta-animal">${CLASES[clase].toUpperCase()}</p>`;
    }

    function pintarEspacios() {
        const lista = $("espacios-1");
        lista.innerHTML = Array.from({ length: INTENTOS_POR_PRUEBA }, (_, k) => {
            const intento = intentos[k];
            if (!intento) return `<li class="espacio vacio"><span class="numero-espacio">${k + 1}</span></li>`;
            const nombre = CLASES[intento.etiqueta];
            const nuevo = k === intentos.length - 1 ? " nuevo" : "";
            return `<li class="espacio lleno${nuevo}">
                ${intento.imagen
                    ? `<img src="${intento.imagen}" alt="Dibujo ${k + 1}: ${nombre}">`
                    : `<canvas width="28" height="28" data-k="${k}" role="img" aria-label="Dibujo ${k + 1}: ${nombre}"></canvas>`}
                <span class="nombre-espacio">${nombre}</span>
            </li>`;
        }).join("");
        lista.querySelectorAll("canvas[data-k]").forEach(c => pintar28(c, intentos[Number(c.dataset.k)].pixeles));
        $("contador-1").textContent = `${Math.min(intentos.length, INTENTOS_POR_PRUEBA)} de ${INTENTOS_POR_PRUEBA}`;
        pintarTarjeta();
    }

    function estado(conectado, texto) {
        $("punto-1").className = `punto-sensor ${conectado ? "conectado" : "desconectado"}`;
        $("estado-1").textContent = texto;
    }

    // ---------------- Capturas (/api/camara/estado) ----------------
    let hayVista = false;

    async function consultarEstado() {
        const e = await Juego.api("api/camara/estado");
        const seq = e.captura_seq || 0;

        // Primera consulta (o servidor reiniciado): no contar capturas anteriores
        if (ultimaCaptura === null || seq < ultimaCaptura) {
            ultimaCaptura = seq;
            guardar();
        }

        const c = e.ultima_captura;
        if (seq > ultimaCaptura) {
            ultimaCaptura = seq;
            if (c && c.captura_seq === seq && (c.etiqueta === 0 || c.etiqueta === 1) && c.modelos
                && intentos.length < INTENTOS_POR_PRUEBA) {
                intentos.push({
                    etiqueta: c.etiqueta,
                    pixeles: c.pixeles,
                    imagen: c.imagen_original || null,
                    modelos: Object.fromEntries(Juego.ROBOTS.map(r => [r.clave, { prediccion: c.modelos[r.clave].prediccion }]))
                });
                pintarEspacios();
            }
            guardar();
        }

        // Sin vista previa (teléfono con una versión anterior de la página): matriz 28×28
        const canvas = $("camara-28");
        if (e.conectado && !hayVista && Array.isArray(e.pixeles)) {
            pintar28(canvas, e.pixeles);
            canvas.hidden = false;
            $("camara-espera").hidden = true;
        } else if (hayVista || !e.conectado) {
            canvas.hidden = true;
        }
        if (!e.conectado && !hayVista) $("camara-espera").hidden = false;

        if (!e.conectado) estado(false, "Esperando teléfono…");
        else if (intentos.length >= INTENTOS_POR_PRUEBA) estado(true, "¡Ya tienes los 5 dibujos!".replace("5", INTENTOS_POR_PRUEBA));
        else if (e.tiene_dibujo) estado(true, "Veo un dibujo: elige Gato o Perro y pulsa Capturar");
        else estado(true, "Cámara conectada: dibuja en la pizarra");
    }

    // ---------------- Cámara en vivo (/api/camara/vista) ----------------
    let urlAnterior = null;
    async function consultarVista() {
        const url = Juego.urlApi("api/camara/vista");
        if (!url) return;
        const r = await fetch(url, { cache: "no-store" });
        const img = $("camara-vivo");
        if (r.status === 200) {
            const blob = await r.blob();
            const nueva = URL.createObjectURL(blob);
            img.onload = () => { if (urlAnterior && urlAnterior !== nueva) URL.revokeObjectURL(urlAnterior); urlAnterior = nueva; };
            img.src = nueva;
            img.hidden = false;
            hayVista = true;
            $("camara-espera").hidden = true;
        } else {
            img.hidden = true;
            hayVista = false;
        }
    }

    function ciclo(funcion, ms) {
        const mia = generacion;
        const vuelta = async () => {
            if (mia !== generacion) return;
            try {
                await funcion();
            } catch (err) {
                if (funcion === consultarEstado) estado(false, "Sin servidor de Python");
            }
            if (mia === generacion) setTimeout(vuelta, ms);
        };
        vuelta();
    }

    cargar();
    pintarEspacios();

    Juego.alEntrar(2, () => {
        generacion += 1;
        ciclo(consultarEstado, 300);
        ciclo(consultarVista, 180);
    });
    Juego.alSalir(2, () => { generacion += 1; });

    Juego.prueba1 = {
        intentos: () => intentos.slice(0, INTENTOS_POR_PRUEBA).map(i => ({
            real: CLASES[i.etiqueta],
            modelos: Object.fromEntries(Juego.ROBOTS.map(r => [r.clave, {
                dice: CLASES[i.modelos[r.clave].prediccion],
                correcto: i.modelos[r.clave].prediccion === i.etiqueta
            }]))
        })),
        reiniciar() {
            intentos = [];
            guardar();
            pintarEspacios();
        }
    };
})();
