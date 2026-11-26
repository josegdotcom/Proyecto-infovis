// Prueba 2 · pantalla principal: conecta el teléfono, inicia grabaciones,
// muestra lo que vieron los modelos y evalúa su rendimiento.
// Toda la sesión vive en el servidor (/api/prueba_2/*), así que esta página
// puede recargarse sin perder los intentos.

(function () {
    const ICONOS = { 1: "🚶", 2: "⬆️", 3: "⬇️", 4: "🪑", 5: "🧍", 6: "🛌" };
    const COLOR = { CNN: "var(--p2-cnn)", MLP: "var(--p2-mlp)" };
    const INTERVALO_ESTADO_MS = 300;
    const SEGUNDOS_GRAFICO = 20;
    const GRAVEDAD = 9.80665;

    const $ = (id) => document.getElementById(id);
    const el = {
        punto: $("punto-conexion"),
        textoConexion: $("texto-conexion"),
        qr: $("qr-sensor"),
        enlace: $("enlace-sensor"),
        grafico: $("grafico-vivo"),
        orientacion: $("texto-orientacion"),
        grilla: $("grilla-actividades"),
        btnGrabar: $("btn-grabar"),
        btnCancelar: $("btn-cancelar"),
        progreso: $("progreso-p2"),
        progresoEtapa: $("progreso-etapa"),
        progresoDetalle: $("progreso-detalle"),
        progresoBarra: $("progreso-barra"),
        mensaje: $("mensaje-estado"),
        panelIntento: $("panel-intento"),
        detalleIntento: $("detalle-intento"),
        contador: $("contador-intentos"),
        cuerpoIntentos: $("cuerpo-intentos"),
        btnEvaluar: $("btn-evaluar"),
        btnReiniciar: $("btn-reiniciar"),
        bloqueMetricas: $("bloque-metricas"),
        resumenMetricas: $("resumen-metricas")
    };

    let actividades = { 1: "Caminar", 2: "Subir escaleras", 3: "Bajar escaleras", 4: "Sentado", 5: "De pie", 6: "Acostado" };
    let actividadElegida = null;
    let estado = null;
    let firmaIntentos = "";
    let ultimoResultadoId = null;
    let ultimoErrorMostrado = null;
    let serieVivo = [];
    let ultimaMuestraT = null;

    function mostrarMensaje(texto, tipo = "info") {
        el.mensaje.textContent = texto;
        el.mensaje.dataset.tipo = tipo;
    }

    function porcentaje(v) {
        return `${(v * 100).toFixed(1).replace(".", ",")}%`;
    }

    function escapar(texto) {
        return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    async function api(ruta, cuerpo) {
        const opciones = cuerpo === undefined
            ? { cache: "no-store" }
            : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) };
        const r = await fetch(ruta, opciones);
        const datos = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(datos.error || `Error ${r.status}`);
        return datos;
    }

    // ---------------------------------------------------------------
    // 1. QR del sensor (generado localmente)
    // ---------------------------------------------------------------
    async function prepararQr() {
        let url = new URL("sensor_prueba_2.html", window.location.href).href;
        try {
            const datos = await api("/api/prueba_2/url");
            if (datos.url) url = datos.url;
        } catch (e) {
            mostrarMensaje("No se encontró el servidor de Python. Ejecuta «python -m api.main» y recarga.", "error");
        }
        el.enlace.href = url;
        el.enlace.textContent = url;
        if (typeof QRCode !== "undefined") {
            el.qr.innerHTML = "";
            new QRCode(el.qr, { text: url, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
        } else {
            el.qr.textContent = "No se pudo cargar el generador de QR: abre el enlace en el teléfono.";
        }
    }

    // ---------------------------------------------------------------
    // Señal en vivo (desde la última lectura que envía el teléfono)
    // ---------------------------------------------------------------
    function registrarMuestraViva(m) {
        if (!m || m.t === ultimaMuestraT) return;
        ultimaMuestraT = m.t;
        const ahora = performance.now() / 1000;
        const movimiento = Math.abs(Math.hypot(m.ax, m.ay, m.az) - GRAVEDAD) / GRAVEDAD;
        const giro = (Math.hypot(m.gx, m.gy, m.gz) * Math.PI) / 180;
        serieVivo.push({ t: ahora, movimiento, giro });
        serieVivo = serieVivo.filter((p) => ahora - p.t <= SEGUNDOS_GRAFICO);

        // Orientación aproximada: eje del teléfono con más gravedad.
        const ejes = [["horizontal (de lado)", Math.abs(m.ax)], ["vertical", Math.abs(m.ay)], ["acostado (pantalla arriba/abajo)", Math.abs(m.az)]];
        ejes.sort((a, b) => b[1] - a[1]);
        el.orientacion.textContent = `Teléfono: ${ejes[0][0]}`;
    }

    function colorCss(variable) {
        return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || "#888";
    }

    function dibujarGrafico() {
        const c = el.grafico;
        const dpr = window.devicePixelRatio || 1;
        const ancho = c.clientWidth;
        const alto = c.clientHeight;
        if (c.width !== Math.round(ancho * dpr)) {
            c.width = Math.round(ancho * dpr);
            c.height = Math.round(alto * dpr);
        }
        const g = c.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, ancho, alto);

        // Rejilla suave
        g.strokeStyle = colorCss("--grilla");
        g.lineWidth = 1;
        [0.25, 0.5, 0.75].forEach((f) => {
            g.beginPath();
            g.moveTo(0, alto * f);
            g.lineTo(ancho, alto * f);
            g.stroke();
        });

        const ahora = performance.now() / 1000;
        const x = (t) => ancho - ((ahora - t) / SEGUNDOS_GRAFICO) * ancho;
        const escala = { movimiento: 1.0, giro: 4.0 }; // tope visible de cada serie
        [["movimiento", "--p2-acc"], ["giro", "--p2-giro"]].forEach(([clave, variable]) => {
            g.strokeStyle = colorCss(variable);
            g.lineWidth = 2;
            g.beginPath();
            serieVivo.forEach((p, i) => {
                const y = alto - 6 - Math.min(1, p[clave] / escala[clave]) * (alto - 12);
                if (i === 0) g.moveTo(x(p.t), y); else g.lineTo(x(p.t), y);
            });
            g.stroke();
        });

        if (!serieVivo.length) {
            g.fillStyle = colorCss("--texto-tenue");
            g.font = "13px system-ui, sans-serif";
            g.textAlign = "center";
            g.fillText("Sin datos: conecta el teléfono y activa sus sensores", ancho / 2, alto / 2);
        }
        requestAnimationFrame(dibujarGrafico);
    }

    // ---------------------------------------------------------------
    // 2. Actividades y grabación
    // ---------------------------------------------------------------
    let firmaActividades = "";
    function pintarActividades(bloqueado) {
        // Redibujar solo si algo cambió: reemplazar los botones durante un clic lo anula.
        const firma = `${bloqueado}|${actividadElegida}|${JSON.stringify(actividades)}`;
        if (firma === firmaActividades) return;
        firmaActividades = firma;
        el.grilla.innerHTML = "";
        Object.entries(actividades).forEach(([id, nombre]) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "btn-actividad-p2";
            b.disabled = bloqueado;
            b.setAttribute("aria-pressed", String(Number(id) === actividadElegida));
            b.innerHTML = `<span class="icono" aria-hidden="true">${ICONOS[id] || "•"}</span>${escapar(nombre)}`;
            b.addEventListener("click", () => {
                actividadElegida = Number(id);
                pintarActividades(false);
                actualizarControles();
            });
            el.grilla.appendChild(b);
        });
    }

    function actualizarControles() {
        const e = estado || {};
        const ocupado = e.fase && e.fase !== "espera";
        el.btnGrabar.disabled = !e.conectado || actividadElegida === null || ocupado;
        el.btnCancelar.hidden = !(e.fase === "cuenta_regresiva" || e.fase === "grabando");
        if (!ocupado && !el.mensaje.dataset.fijo) {
            if (!e.conectado) mostrarMensaje("Conecta el teléfono para poder grabar.");
            else if (actividadElegida === null) mostrarMensaje("Elige la actividad que vas a realizar.");
            else mostrarMensaje(`Listo para grabar: ${actividades[actividadElegida]}.`);
        }
    }

    el.btnGrabar.addEventListener("click", async () => {
        try {
            el.mensaje.dataset.fijo = "";
            await api("/api/prueba_2/iniciar", { actividad: actividadElegida, cuenta_regresiva: 5 });
        } catch (err) {
            mostrarMensaje(err.message, "error");
        }
    });

    el.btnCancelar.addEventListener("click", async () => {
        try { await api("/api/prueba_2/cancelar", {}); } catch (err) { mostrarMensaje(err.message, "error"); }
    });

    function pintarProgreso(e) {
        const activo = ["cuenta_regresiva", "grabando", "procesando"].includes(e.fase);
        el.progreso.hidden = !activo;
        if (!activo) return;
        const nombre = `${ICONOS[e.actividad] || ""} ${e.nombre_actividad || ""}`;
        if (e.fase === "cuenta_regresiva") {
            el.progresoEtapa.textContent = `Prepárate: ${nombre}`;
            el.progresoDetalle.textContent = `Empieza en ${Math.ceil(e.segundos_para_iniciar)} s · coloca el teléfono en la cintura`;
            el.progresoBarra.style.width = "0%";
            mostrarMensaje("Cuenta regresiva en curso…");
        } else if (e.fase === "grabando") {
            const restante = Math.max(0, Math.ceil(e.duracion_s * (1 - e.progreso)));
            el.progresoEtapa.textContent = `Grabando: ${nombre}`;
            el.progresoDetalle.textContent = `Quedan ${restante} s`;
            el.progresoBarra.style.width = `${Math.round(e.progreso * 100)}%`;
            mostrarMensaje("Grabando… realiza la actividad sin parar.");
        } else {
            el.progresoEtapa.textContent = "Analizando…";
            el.progresoDetalle.textContent = "Calculando las 561 características y consultando a los modelos";
            el.progresoBarra.style.width = "100%";
        }
    }

    // ---------------------------------------------------------------
    // 3. Último intento
    // ---------------------------------------------------------------
    function pintarIntento(r) {
        if (!r) {
            el.panelIntento.hidden = true;
            return;
        }
        el.panelIntento.hidden = false;
        const filas = ["MLP", "CNN"].map((m) => {
            const d = r.modelos[m];
            if (!d) return "";
            const ventanas = d.ventanas.map((p, i) => {
                const ok = p === r.actividad_real;
                const nombre = actividades[p] || `Clase ${p}`;
                return `<div class="ventana-p2 ${ok ? "correcta" : "incorrecta"}" title="Ventana ${i + 1}: ${escapar(nombre)}">
                            <span aria-hidden="true">${ICONOS[p] || "?"}</span>
                            <small>${escapar(nombre)}</small>
                        </div>`;
            }).join("");
            const marca = d.correcto ? '<span class="marca-ok">✓ Acierta</span>' : '<span class="marca-mal">✗ Falla</span>';
            return `
                <div class="fila-modelo-p2">
                    <div class="nombre-modelo-p2"><span class="muestra" style="background:${COLOR[m]}"></span>Red ${m}</div>
                    <div class="ventanas-p2" role="list" aria-label="Predicción de ${m} por ventana">${ventanas}</div>
                    <div class="veredicto-p2">${marca}: ${ICONOS[d.prediccion] || ""} <strong>${escapar(d.actividad)}</strong>
                        <small>${d.votos} de ${r.ventanas} ventanas</small></div>
                </div>`;
        }).join("");
        el.detalleIntento.innerHTML = `
            <p class="real-intento">Intento #${r.id} · actividad real: <strong>${ICONOS[r.actividad_real] || ""} ${escapar(r.nombre_real)}</strong>
                <span class="ayuda">(${r.muestras} lecturas a ${String(r.frecuencia_hz).replace(".", ",")} Hz)</span></p>
            ${filas}`;
    }

    // ---------------------------------------------------------------
    // 4. Historial y métricas
    // ---------------------------------------------------------------
    function pintarIntentos(intentos, minimo) {
        const total = intentos.length;
        const listo = total >= minimo;
        el.contador.textContent = listo ? `${total} intentos (listo para evaluar)` : `${total} / ${minimo} intentos mínimos`;
        el.contador.classList.toggle("completo", listo);
        el.btnEvaluar.disabled = !listo;
        el.btnEvaluar.textContent = listo ? `Evaluar modelos (${total} intentos)` : `Evaluar modelos (${total}/${minimo})`;
        el.btnReiniciar.disabled = total === 0;

        if (!total) {
            el.cuerpoIntentos.innerHTML = '<tr><td colspan="6" class="texto-vacio">Aún no hay intentos.</td></tr>';
            return;
        }
        el.cuerpoIntentos.innerHTML = intentos.slice().reverse().map((r) => {
            const celda = (m) => {
                const d = r.modelos[m];
                const marca = d.correcto ? '<span class="marca-ok">✓</span>' : '<span class="marca-mal">✗</span>';
                return `<td>${marca} ${ICONOS[d.prediccion] || ""} ${escapar(d.actividad)}</td>`;
            };
            return `<tr>
                <td>${r.id}</td>
                <td>${ICONOS[r.actividad_real] || ""} ${escapar(r.nombre_real)}</td>
                ${celda("CNN")}
                ${celda("MLP")}
                <td>${escapar(r.hora)}</td>
                <td><button type="button" class="btn-eliminar-intento" data-id="${r.id}" aria-label="Eliminar intento ${r.id}" title="Eliminar intento">×</button></td>
            </tr>`;
        }).join("");
    }

    el.cuerpoIntentos.addEventListener("click", async (evento) => {
        const boton = evento.target.closest(".btn-eliminar-intento");
        if (!boton) return;
        try {
            await api("/api/prueba_2/eliminar", { id: Number(boton.dataset.id) });
            el.bloqueMetricas.hidden = true;
        } catch (err) {
            mostrarMensaje(err.message, "error");
        }
    });

    el.btnReiniciar.addEventListener("click", async () => {
        if (!window.confirm("¿Borrar todos los intentos de esta sesión?")) return;
        try {
            await api("/api/prueba_2/reiniciar", {});
            el.bloqueMetricas.hidden = true;
        } catch (err) {
            mostrarMensaje(err.message, "error");
        }
    });

    el.btnEvaluar.addEventListener("click", async () => {
        try {
            const r = await api("/api/prueba_2/metricas", {});
            pintarMetricas(r);
        } catch (err) {
            mostrarMensaje(err.message, "error");
        }
    });

    function pintarMetricas(r) {
        el.resumenMetricas.innerHTML = ["MLP", "CNN"].map((m) => {
            const met = r.metricas[m];
            const aciertos = r.predicciones[m].filter((p, i) => p === r.etiquetas_reales[i]).length;
            return `
                <article class="tarjeta-metrica-modelo">
                    <div class="cabecera-metrica-modelo">
                        <h4><span class="muestra-modelo" style="background:${COLOR[m]}"></span>Modelo ${m}</h4>
                        <span class="resumen-aciertos">${aciertos} / ${r.intentos} aciertos</span>
                    </div>
                    <div class="barra-rendimiento-contenedor">
                        <div class="barra-rendimiento-relleno" style="width:${(met.accuracy * 100).toFixed(1)}%; background:${COLOR[m]}"></div>
                    </div>
                    <dl class="lista-metricas-modelo">
                        <div><dt>Accuracy</dt><dd>${porcentaje(met.accuracy)}</dd></div>
                        <div><dt>Precisión</dt><dd>${porcentaje(met.precision)}</dd></div>
                        <div><dt>Recall</dt><dd>${porcentaje(met.recall)}</dd></div>
                        <div><dt>F1-Score</dt><dd>${porcentaje(met.f1_score)}</dd></div>
                    </dl>
                </article>`;
        }).join("");
        el.bloqueMetricas.hidden = false;
        el.bloqueMetricas.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ---------------------------------------------------------------
    // Sincronización con el servidor
    // ---------------------------------------------------------------
    async function sincronizar() {
        let e;
        try {
            e = await api("/api/prueba_2/estado");
        } catch (err) {
            el.punto.className = "punto-sensor desconectado";
            el.textoConexion.textContent = "Sin servidor de Python";
            return;
        }
        estado = e;
        if (e.actividades) actividades = e.actividades;

        el.punto.className = `punto-sensor ${e.conectado ? "conectado" : "desconectado"}`;
        el.textoConexion.textContent = e.conectado ? "Teléfono conectado" : "Esperando teléfono…";
        if (e.conectado) registrarMuestraViva(e.ultima_muestra);

        // Si se inició desde el teléfono, reflejar la actividad elegida allí.
        const ocupado = e.fase !== "espera";
        if (ocupado && e.actividad && e.actividad !== actividadElegida) actividadElegida = e.actividad;
        pintarActividades(ocupado);
        pintarProgreso(e);

        if (e.resultado && e.resultado.id !== ultimoResultadoId) {
            const esNuevo = ultimoResultadoId !== null;
            ultimoResultadoId = e.resultado.id;
            pintarIntento(e.resultado);
            if (esNuevo) {
                const mlp = e.resultado.modelos.MLP;
                const cnn = e.resultado.modelos.CNN;
                mostrarMensaje(`Intento #${e.resultado.id}: MLP dice «${mlp.actividad}», CNN dice «${cnn.actividad}».`, "exito");
                el.mensaje.dataset.fijo = "1";
                setTimeout(() => { el.mensaje.dataset.fijo = ""; }, 6000);
                el.panelIntento.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        } else if (!e.resultado && !el.panelIntento.hidden) {
            pintarIntento(null); // se eliminó o reinició el último intento
        }

        if (e.error && e.error !== ultimoErrorMostrado) {
            ultimoErrorMostrado = e.error;
            if (!ocupado) {
                mostrarMensaje(e.error, "error");
                el.mensaje.dataset.fijo = "1";
                setTimeout(() => { el.mensaje.dataset.fijo = ""; }, 6000);
            }
        }

        const firma = JSON.stringify(e.intentos.map((i) => i.id));
        if (firma !== firmaIntentos) {
            firmaIntentos = firma;
            pintarIntentos(e.intentos, e.minimo_intentos);
        }
        actualizarControles();
    }

    pintarActividades(false);
    prepararQr();
    requestAnimationFrame(dibujarGrafico);
    sincronizar();
    setInterval(sincronizar, INTERVALO_ESTADO_MS);
})();
