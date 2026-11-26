// Paso 2 · Los intentos: 5 dibujos libres en la pizarra, vistos por la cámara del celular.
// Cada persona elige si dibuja un perro o un gato, y cómo. Gana puntos quien logra que una
// red acierte y la otra no: quien mejor entiende cómo mira cada red.
//
// El celular (exploracion/telefono_retos.html, abierto con el QR) queda fijo, de costado,
// apuntando a la pizarra. No se toca: esta página lleva el tiempo de cada intento.
//
//   1. Preparación: 3 s para pensar qué dibujar.
//   2. Dibujo: 10 s para dibujar en la pizarra.
//   3. Foto: se pide al celular (POST /api/camara/capturar) y él la toma sola.
//   4. Pregunta: «¿Qué dibujaste?» (Gato o Perro, con clic o con las teclas G y P). Lo que
//      dijeron las redes se muestra recién después de responder.
//   5. Resultado: lo que dijo cada red y su tono de acierto o error (primero la CNN y
//      luego la MLP). A los pocos segundos empieza el siguiente intento; después del
//      último se abre el paso 3.
// Si en la foto no se ve un dibujo, se repite el mismo intento.
//
// Al abrir un intento, esta página lo avisa al servidor (POST /api/camara/reto, sin
// etiqueta) para que el servidor acepte la foto.
//   - La cámara en vivo se ve con GET /api/camara/vista.
//   - Cada captura llega por GET /api/camara/estado (captura_seq aumenta).
//   - Un punto por cada reto en que una red acierta y la otra no.
//   - El celular va de costado: «Girar imagen» le dice cuántos grados girar la imagen
//     (POST /api/camara/giro). Se recuerda en este navegador.
// Los intentos se guardan en el navegador.

(() => {
    const $ = Juego.$;
    const CLAVE = "infovis:retos";
    const CLAVE_GIRO = "infovis:giro";
    const CLASES = ["Gato", "Perro"];
    const IMAGENES = ["assets/images/gato.svg", "assets/images/perro.svg"];
    // Intentos libres: la etiqueta la da la persona después de la foto
    const RETOS = Array.from({ length: RETOS_TOTAL }, (_, k) => ({ texto: `Intento ${k + 1}` }));
    const SEGUNDOS_PREPARACION = 3;
    const SEGUNDOS_DIBUJO = 10;
    const SEGUNDOS_RESULTADO = 4;    // tiempo que se ve el resultado antes del siguiente reto
    const ESPERA_FOTO_MS = 6000;     // si la foto no llega en este tiempo, se repite el reto

    // intentos[k] = { etiqueta, pixeles, imagen, modelos: { CNN: { prediccion }, MLP: { prediccion } } }
    let intentos = [];
    let ultimaCaptura = null;   // captura_seq ya revisada
    let fallidasVistas = null;  // capturas_fallidas ya revisadas
    // Fase del intento abierto: "camara" (esperando el celular), "preparacion", "dibujo",
    // "foto", "pregunta", "resultado" o "fin"
    let fase = "camara";
    let pendiente = null;       // foto recibida, esperando «¿Qué dibujaste?»
    let generacion = 0;         // evita ciclos duplicados al entrar y salir del paso
    let temporizadores = [];

    // ---------------- Guardado en el navegador ----------------
    function guardar() {
        const datos = lista => JSON.stringify({ intentos: lista, ultimaCaptura });
        try {
            localStorage.setItem(CLAVE, datos(intentos));
        } catch (err) {
            try {
                localStorage.setItem(CLAVE, datos(intentos.map(i => ({ ...i, imagen: null }))));
            } catch (err2) {
                // Sin almacenamiento: dura mientras la página esté abierta.
            }
        }
    }

    function cargar() {
        try {
            const datos = JSON.parse(localStorage.getItem(CLAVE) || "null");
            if (datos && Array.isArray(datos.intentos)) {
                intentos = datos.intentos.slice(0, RETOS.length);
                ultimaCaptura = datos.ultimaCaptura ?? null;
            }
        } catch (err) {
            // Datos dañados: se empieza de cero.
        }
    }

    const acerto = (intento, red) => intento.modelos[red].prediccion === intento.etiqueta;
    const esPunto = intento => !!intento && acerto(intento, "CNN") !== acerto(intento, "MLP");
    const puntos = () => intentos.filter(esPunto).length;
    const retoActual = () => Math.min(intentos.length, RETOS.length - 1);
    const terminado = () => intentos.length >= RETOS.length;

    // ---------------- Pintado ----------------
    function pintarProgreso() {
        const actual = fase === "resultado" ? intentos.length - 1 : intentos.length;
        $("progreso-retos").innerHTML = RETOS.map((_, k) => {
            const i = intentos[k];
            const clase = esPunto(i) ? "punto" : i ? "hecho" : "";
            const estado = esPunto(i) ? ", punto" : i ? ", hecho" : "";
            return `<span class="${clase}" ${k === actual ? 'aria-current="step"' : ""} aria-label="Intento ${k + 1}${estado}">${k + 1}</span>`;
        }).join("") + `<b class="puntos">${puntos()} ${puntos() === 1 ? "punto" : "puntos"}</b>`;
    }

    function pintarConsigna(k) {
        $("consigna").innerHTML = `<span class="iconos" aria-hidden="true"><img src="${IMAGENES[0]}" alt=""><img src="${IMAGENES[1]}" alt=""></span>
            <span><small>Intento ${k + 1} de ${RETOS.length}</small>Dibuja un perro o un gato<em>Tú eliges cómo. ¿Lograrás engañar a una red?</em></span>`;
    }

    function pintarRespuesta(red, intento) {
        const el = $(`respuesta-${red.toLowerCase()}`);
        if (!intento) {
            el.className = "respuesta";
            el.innerHTML = `<span class="red">${red}</span><span class="dice esperando">Esperando el dibujo…</span>`;
            return;
        }
        const ok = acerto(intento, red);
        el.className = `respuesta ${ok ? "acerto" : "fallo"} aparece`;
        el.innerHTML = `<span class="red">${red} dice</span><strong class="dice">${CLASES[intento.modelos[red].prediccion]}</strong>
            <span class="marca-resultado">${ok ? "✓ Acertó" : "✗ Falló"}</span>`;
    }

    function veredicto(texto, clase = "") {
        const v = $("veredicto");
        v.className = `veredicto ${clase}`;
        v.textContent = texto;
        delete v.dataset.cuenta;
    }

    // Cuenta sobre la cámara. modo: "grande" (centrada), "esquina" (mientras se dibuja) o null
    function cuenta(modo, etiqueta = "", numero = "") {
        const c = $("cuenta");
        c.hidden = !modo;
        if (!modo) return;
        c.className = `cuenta ${modo}`;
        c.innerHTML = `<span>${etiqueta}</span><strong>${numero}</strong>`;
    }

    function barraTiempo(segundos) {
        const barra = $("barra-tiempo");
        const relleno = barra.querySelector("i");
        barra.hidden = segundos === null;
        relleno.style.transition = "none";
        relleno.style.width = "100%";
        if (segundos === null) return;
        void relleno.offsetWidth;
        relleno.style.transition = `width ${segundos}s linear`;
        relleno.style.width = "0%";
    }

    function pintarEspera() {
        pintarConsigna(retoActual());
        pintarRespuesta("CNN", null);
        pintarRespuesta("MLP", null);
        pintarProgreso();
    }

    // ---------------- Reto abierto en el servidor ----------------
    function avisarReto() {
        const abierto = fase !== "resultado" && fase !== "fin" && !terminado();
        const cuerpo = abierto ? { numero: intentos.length + 1, etiqueta: null } : {};
        return Juego.post("api/camara/reto", cuerpo).catch(() => {});
    }

    // ---------------- Giro de la imagen del celular ----------------
    let giro = 90;
    try {
        const g = localStorage.getItem(CLAVE_GIRO);
        if (g !== null && [0, 90, 180, 270].includes(Number(g))) giro = Number(g);
    } catch (err) { /* sin almacenamiento */ }

    function avisarGiro() {
        return Juego.post("api/camara/giro", { grados: giro }).catch(() => {});
    }

    $("btn-girar").addEventListener("click", () => {
        giro = (giro + 90) % 360;
        try { localStorage.setItem(CLAVE_GIRO, String(giro)); } catch (err) { /* sin almacenamiento */ }
        avisarGiro();
    });

    // ---------------- Tiempo de cada reto ----------------
    function despues(ms, fn) { temporizadores.push(setTimeout(fn, ms)); }

    function cancelarTemporizadores() {
        temporizadores.forEach(clearTimeout);
        temporizadores = [];
    }

    // Empieza el reto abierto: preparación, dibujo y foto
    function iniciarReto() {
        cancelarTemporizadores();
        $("pregunta").hidden = true;
        pendiente = null;
        if (terminado()) {
            fase = "fin";
            cuenta(null);
            barraTiempo(null);
            veredicto("¡Terminaste los 5 intentos!");
            return;
        }
        if (!hayVista) {
            fase = "camara";
            cuenta(null);
            barraTiempo(null);
            veredicto("Conecta el celular para empezar");
            return;
        }
        fase = "preparacion";
        pintarEspera();
        avisarReto();
        veredicto("Prepárate…");

        for (let s = SEGUNDOS_PREPARACION; s >= 1; s--) {
            despues((SEGUNDOS_PREPARACION - s) * 1000, () => {
                cuenta("grande", "¿Perro o gato? Prepárate", s);
                Sonidos.tic();
            });
        }
        despues(SEGUNDOS_PREPARACION * 1000, () => {
            fase = "dibujo";
            veredicto("¡Dibuja!");
            barraTiempo(SEGUNDOS_DIBUJO);
            for (let s = SEGUNDOS_DIBUJO; s >= 1; s--) {
                despues((SEGUNDOS_DIBUJO - s) * 1000, () => {
                    cuenta("esquina", "✏️ ¡Dibuja!", s);
                    if (s <= 3) Sonidos.tic(true);
                });
            }
            despues(SEGUNDOS_DIBUJO * 1000, tomarFoto);
        });
    }

    function tomarFoto() {
        fase = "foto";
        barraTiempo(null);
        cuenta("grande", "¡Foto!", "📸");
        veredicto("Tomando la foto…");
        Sonidos.foto();
        Juego.post("api/camara/capturar", {}).catch(() => {});
        despues(ESPERA_FOTO_MS, () => repetirReto("No llegó la foto. Si se repite, recarga la página del celular."));
    }

    // El servidor que está corriendo es anterior a la captura automática: no sirve repetir.
    // Se espera hasta que se reinicie (consultarEstado lo detecta y sigue sola).
    function servidorDesactualizado() {
        if (fase === "servidor") return;
        cancelarTemporizadores();
        fase = "servidor";
        cuenta(null);
        barraTiempo(null);
        veredicto("Reinicia el servidor de Python (Ctrl+C y python -m api.main) y recarga el celular.", "con-aviso");
    }

    function repetirReto(motivo) {
        if (fase !== "foto") return;
        cancelarTemporizadores();
        fase = "repetir";
        cuenta(null);
        veredicto(motivo, "con-aviso");
        despues(3000, iniciarReto);
    }

    // ---------------- ¿Qué dibujaste? ----------------
    function preguntar(intento) {
        cancelarTemporizadores();
        fase = "pregunta";
        pendiente = intento;
        cuenta(null);
        $("pregunta").hidden = false;
        veredicto("¿Qué dibujaste?");
        $("pregunta").querySelector("button").focus({ preventScroll: true });
    }

    function responder(etiqueta) {
        if (fase !== "pregunta" || !pendiente) return;
        const intento = { ...pendiente, etiqueta };
        pendiente = null;
        $("pregunta").hidden = true;
        intentos.push(intento);
        guardar();
        mostrarResultado(intento);
    }

    $("pregunta").querySelectorAll("button").forEach(b =>
        b.addEventListener("click", () => responder(Number(b.dataset.etiqueta))));
    window.addEventListener("keydown", e => {
        if (fase !== "pregunta" || e.ctrlKey || e.metaKey || e.altKey) return;
        const tecla = e.key.toLowerCase();
        if (tecla === "g") responder(0);
        if (tecla === "p") responder(1);
    });

    // ---------------- Resultado de una captura ----------------
    function mostrarResultado(intento) {
        cancelarTemporizadores();
        fase = "resultado";
        cuenta(null);
        barraTiempo(null);
        avisarReto();
        pintarProgreso();
        const aciertos = { CNN: acerto(intento, "CNN"), MLP: acerto(intento, "MLP") };
        Sonidos.resultado(aciertos);

        // Cada red aparece cuando suena su tono
        pintarRespuesta("CNN", intento);
        $("respuesta-mlp").className = "respuesta";
        $("respuesta-mlp").innerHTML = `<span class="red">MLP</span><span class="dice esperando">Pensando…</span>`;
        veredicto("…");
        despues(Sonidos.RETRASO_MLP * 1000, () => {
            pintarRespuesta("MLP", intento);
            veredicto(esPunto(intento) ? "¡Punto! No se pusieron de acuerdo." : "Se pusieron de acuerdo. Sin punto.",
                esPunto(intento) ? "con-punto" : "");
        });

        const ultimo = terminado();
        for (let s = SEGUNDOS_RESULTADO; s >= 1; s--) {
            despues((SEGUNDOS_RESULTADO - s + 1.5) * 1000, () => {
                $("veredicto").dataset.cuenta = ultimo ? `Resultados en ${s}…` : `Siguiente intento en ${s}…`;
            });
        }
        despues((SEGUNDOS_RESULTADO + 1.5) * 1000, () => {
            if (ultimo) {
                fase = "fin";
                avisarReto();
                Juego.irA(3);
            } else {
                iniciarReto();
            }
        });
    }

    // ---------------- Capturas (/api/camara/estado) ----------------
    let hayVista = false;

    async function consultarEstado() {
        const e = await Juego.api("api/camara/estado");
        if (e.pedido_captura === undefined) {
            if (fase !== "fin") servidorDesactualizado();
            return;
        }
        if (fase === "servidor") {
            // Ya se reinició con la versión nueva
            fase = "camara";
            if (hayVista) iniciarReto();
            else veredicto("Conecta el celular para empezar");
        }
        const seq = e.captura_seq || 0;
        const fallidas = e.capturas_fallidas || 0;

        // Primera consulta (o servidor reiniciado): no contar capturas anteriores
        if (ultimaCaptura === null || seq < ultimaCaptura) {
            ultimaCaptura = seq;
            guardar();
        }
        if (fallidasVistas === null || fallidas < fallidasVistas) fallidasVistas = fallidas;

        if (seq > ultimaCaptura) {
            ultimaCaptura = seq;
            const c = e.ultima_captura;
            const esperado = intentos.length + 1;
            guardar();
            if (fase === "foto" && c && c.captura_seq === seq && c.reto === esperado && c.modelos) {
                preguntar({
                    pixeles: c.pixeles,
                    imagen: c.imagen_original || null,
                    modelos: Object.fromEntries(Juego.REDES.map(r => [r.clave, { prediccion: c.modelos[r.clave].prediccion }]))
                });
            }
        }
        if (fallidas > fallidasVistas) {
            fallidasVistas = fallidas;
            repetirReto("No se vio un dibujo en la pizarra. Repetimos el intento.");
        }

        // Si el servidor se reinició, volver a avisar el reto abierto y el giro
        const abierto = (fase === "preparacion" || fase === "dibujo" || fase === "foto") && !terminado();
        if (abierto && (!e.reto || e.reto.numero !== intentos.length + 1)) avisarReto();
        if (e.giro !== undefined && e.giro !== giro) avisarGiro();

        if (!e.conectado && !hayVista) $("camara-espera").hidden = false;
    }

    // ---------------- Cámara en vivo (/api/camara/vista) ----------------
    let urlAnterior = null;
    async function consultarVista() {
        const url = Juego.urlApi("api/camara/vista");
        if (!url) return;
        const r = await fetch(url, { cache: "no-store" });
        const img = $("camara-vivo");
        if (r.status === 200) {
            const nueva = URL.createObjectURL(await r.blob());
            img.onload = () => {
                if (urlAnterior && urlAnterior !== nueva) URL.revokeObjectURL(urlAnterior);
                urlAnterior = nueva;
            };
            img.src = nueva;
            img.hidden = false;
            $("btn-girar").hidden = false;
            hayVista = true;
            $("camara-espera").hidden = true;
            // El celular se acaba de conectar: empieza el reto
            if (fase === "camara") iniciarReto();
        } else {
            img.hidden = true;
            $("btn-girar").hidden = true;
            hayVista = false;
            $("camara-espera").hidden = false;
        }
    }

    function ciclo(funcion, ms) {
        const mia = generacion;
        const vuelta = async () => {
            if (mia !== generacion) return;
            try {
                await funcion();
            } catch (err) {
                // Sin servidor: se reintenta en la próxima vuelta
            }
            if (mia === generacion) setTimeout(vuelta, ms);
        };
        vuelta();
    }

    cargar();
    pintarEspera();
    veredicto("Conecta el celular para empezar");

    Juego.alEntrar(2, () => {
        generacion += 1;
        cancelarTemporizadores();
        fallidasVistas = null;
        pendiente = null;
        $("pregunta").hidden = true;
        fase = "camara";
        cuenta(null);
        barraTiempo(null);
        pintarEspera();
        if (terminado()) {
            fase = "fin";
            veredicto("¡Terminaste los 5 intentos!");
        } else {
            veredicto("Conecta el celular para empezar");
        }
        avisarReto();
        avisarGiro();
        ciclo(consultarEstado, 300);
        ciclo(consultarVista, 180);
    });
    Juego.alSalir(2, () => {
        generacion += 1;
        cancelarTemporizadores();
        fase = "camara";
        Juego.post("api/camara/reto", {}).catch(() => {});
    });

    Juego.retos = {
        lista: () => RETOS,
        intentos: () => intentos.slice(),
        puntos,
        aciertos: red => intentos.filter(i => acerto(i, red)).length,
        reiniciar() {
            intentos = [];
            guardar();
            pintarEspera();
        }
    };
})();
