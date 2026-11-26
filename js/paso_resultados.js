// Paso 3 · Resultados.
//
//   - Gráfico: aciertos de la CNN y la MLP en los dibujos de test, en el centro, movidos
//     y pequeños en una esquina (exploracion/datos_retos.js, de data/exportar_retos.py).
//   - ¿Por qué se confunde la MLP?: la «mancha» (promedio de los dibujos de entrenamiento
//     de gato o de perro) con uno de tus dibujos encima, y cuánto de tu dibujo cae en ella.
//   - Ranking compartido por todos los visitantes (GET y POST /api/ranking).
//     Se entra con los 5 intentos hechos y una sola vez por partida. El primer lugar es
//     quien mejor entendió cómo funcionan estas redes.

(() => {
    const $ = Juego.$;
    const CLAVE_GUARDADO = "infovis:ranking-guardado";
    const FILAS = [
        ["centro", "En el centro"],
        ["movidos", "Movidos un poco"],
        ["esquina", "Pequeños, en una esquina"]
    ];
    const pct = v => `${Math.round(v * 100)} %`;
    const miles = n => n.toLocaleString("es-CL");

    let idGuardado = null;
    try { idGuardado = localStorage.getItem(CLAVE_GUARDADO); } catch (err) { /* sin almacenamiento */ }

    // ---------------- Gráfico ----------------
    function pintarGrafico() {
        const a = DATOS_RETOS.aciertos;
        $("grafico").innerHTML = FILAS.map(([clave, nombre]) => `
            <div class="fila-grafico">
                <span class="nombre-fila">${nombre}</span>
                <div class="barras">
                    ${Juego.REDES.map(r => `
                        <div class="pista" title="${r.clave}, ${nombre.toLowerCase()}: ${pct(a[clave][r.clave])} de aciertos">
                            <i style="width:${a[clave][r.clave] * 100}%;background:${r.color}"></i>
                            <b>${pct(a[clave][r.clave])}</b>
                        </div>`).join("")}
                    <span class="raya-azar" aria-hidden="true"></span>
                </div>
            </div>`).join("");
        $("n-dibujos").textContent = miles(DATOS_RETOS.dibujos_test);

        const n = Juego.retos.intentos().length;
        $("tus-aciertos").textContent = n
            ? `Tus intentos: la CNN acertó ${Juego.retos.aciertos("CNN")} de ${n} y la MLP ${Juego.retos.aciertos("MLP")} de ${n}.`
            : "Todavía no haces tus intentos.";
    }

    // ---------------- La mancha de la MLP ----------------
    const MANCHAS = [
        { datos: DATOS_RETOS.gato_promedio, n: DATOS_RETOS.gatos_promedio, nombre: "gatos" },
        { datos: DATOS_RETOS.perro_promedio, n: DATOS_RETOS.perros_promedio, nombre: "perros" }
    ];
    const EN_MANCHA = 120;   // casilla «de la mancha»: promedio ≥ 120 de 255
    const TINTA = 80;        // casilla con tinta en tu dibujo

    function pintarMancha(mancha, pixeles) {
        const g = $("mancha").getContext("2d");
        const img = g.createImageData(28, 28);
        const verde = [0, 185, 130];
        for (let i = 0; i < 784; i++) {
            const a = mancha.datos[i] / 255 * (pixeles ? 0.7 : 0.95);
            let px = verde.map(c => Math.round(255 + (c - 255) * a));
            if (pixeles && pixeles[i] > TINTA) px = [17, 17, 17];
            img.data.set([...px, 255], i * 4);
        }
        g.putImageData(img, 0, 0);
    }

    // Fracción de la tinta de tu dibujo que cae dentro de la mancha
    function dentroDeLaMancha(mancha, pixeles) {
        let tinta = 0, dentro = 0;
        for (let i = 0; i < 784; i++) {
            if (pixeles[i] > TINTA) {
                tinta++;
                if (mancha.datos[i] >= EN_MANCHA) dentro++;
            }
        }
        return tinta ? dentro / tinta : 0;
    }

    function miniatura(canvas, pixeles) {
        const g = canvas.getContext("2d");
        const img = g.createImageData(28, 28);
        for (let i = 0; i < 784; i++) {
            const v = 255 - Math.min(255, pixeles[i]);
            img.data.set([v, v, v, 255], i * 4);
        }
        g.putImageData(img, 0, 0);
    }

    const acerto = (intento, red) => intento.modelos[red].prediccion === intento.etiqueta;
    const marca = (intento, red) => acerto(intento, red)
        ? `<span class="si">${red} ✓ acertó</span>` : `<span class="no">${red} ✗ falló</span>`;

    function elegir(k) {
        const intento = Juego.retos.intentos()[k];
        const mancha = MANCHAS[intento.etiqueta];
        pintarMancha(mancha, intento.pixeles);
        $("tus-dibujos").querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", String(j === k)));
        const p = Math.round(dentroDeLaMancha(mancha, intento.pixeles) * 100);
        $("nota-promedio").textContent = `La mancha verde junta ${miles(mancha.n)} dibujos de ${mancha.nombre}: es donde casi siempre hay tinta. La MLP la memorizó casilla por casilla; si tu dibujo cae fuera, no lo reconoce.`;
        $("dato-mancha").innerHTML = `<b>Intento ${k + 1}:</b> el ${p} % de tu dibujo cae en la mancha. ${marca(intento, "CNN")} ${marca(intento, "MLP")}`;
    }

    function pintarTarjetaMancha() {
        const intentos = Juego.retos.intentos();
        const lista = Juego.retos.lista();
        const cont = $("tus-dibujos");
        cont.hidden = !intentos.length;
        if (!intentos.length) {
            pintarMancha(MANCHAS[0], null);
            $("nota-promedio").textContent = `La mancha verde junta ${miles(MANCHAS[0].n)} dibujos de gatos: es donde casi siempre hay tinta. La MLP la memorizó casilla por casilla.`;
            $("dato-mancha").textContent = "Haz tus intentos para ver tus dibujos encima de la mancha.";
            return;
        }
        cont.innerHTML = intentos.map((i, k) => {
            const punto = acerto(i, "CNN") !== acerto(i, "MLP");
            return `<button type="button" class="${punto ? "punto" : ""}" title="${lista[k].texto}"
                aria-label="Intento ${k + 1}"><canvas width="28" height="28"></canvas><span>${k + 1}</span></button>`;
        }).join("");
        cont.querySelectorAll("button").forEach((b, k) => {
            miniatura(b.querySelector("canvas"), intentos[k].pixeles);
            b.addEventListener("click", () => elegir(k));
        });
        // Al entrar se ve el ejemplo más claro: de los dibujos que confundieron a la MLP (o de
        // todos, si no confundió ninguno), el que menos cae en la mancha
        const enMancha = k => dentroDeLaMancha(MANCHAS[intentos[k].etiqueta], intentos[k].pixeles);
        const indices = intentos.map((_, k) => k);
        const confundieron = indices.filter(k => !acerto(intentos[k], "MLP"));
        const candidatos = confundieron.length ? confundieron : indices;
        elegir(candidatos.reduce((a, b) => (enMancha(b) < enMancha(a) ? b : a)));
    }

    // ---------------- Ranking ----------------
    const MEDALLAS = ["🥇", "🥈", "🥉"];
    const bolitas = p => `<span class="bolitas" aria-hidden="true">${"●".repeat(p)}${"○".repeat(Math.max(0, 5 - p))}</span>`;

    function pintarRanking(filas, recienGuardado = false) {
        const cuerpo = $("ranking");
        if (!filas.length) {
            cuerpo.innerHTML = `<tr><td colspan="3" class="vacio">¡Sé el primero en el ranking! 🚀</td></tr>`;
            return;
        }
        cuerpo.innerHTML = filas.map((f, k) => {
            const tuya = f.id === idGuardado;
            const clases = [k === 0 && "primero", tuya && "tu", tuya && recienGuardado && "nuevo"].filter(Boolean).join(" ");
            return `
            <tr class="${clases}">
                <td class="lugar">${MEDALLAS[k] || k + 1}</td>
                <td>${Juego.escapar(f.apodo)}${tuya ? ' <span class="eres-tu">tú</span>' : ""}${k === 0
                    ? '<small class="corona">👑 Quien mejor entendió cómo funcionan estas redes</small>' : ""}</td>
                <td class="num">${bolitas(f.puntos)}<b>${f.puntos}</b></td>
            </tr>`;
        }).join("");
        const propia = cuerpo.querySelector("tr.tu");
        if (propia) propia.scrollIntoView({ block: "nearest" });
    }

    function pintarFormulario(filas) {
        const n = Juego.retos.intentos().length;
        const completo = n >= Juego.retos.lista().length;
        const yaGuardado = !!idGuardado;
        $("apodo").disabled = !completo || yaGuardado;
        $("btn-guardar").disabled = !completo || yaGuardado;
        const p = Juego.retos.puntos();
        const k = filas ? filas.findIndex(f => f.id === idGuardado) : -1;
        const lugar = k >= 0 ? k + 1 : null;
        const estado = $("estado-ranking");
        estado.classList.toggle("campeon", yaGuardado && lugar === 1);
        estado.textContent = yaGuardado
            ? lugar === 1
                ? "🎉 ¡Primer lugar! Eres quien mejor entendió cómo funcionan estas redes."
                : lugar
                    ? `🎉 ¡Quedaste en el lugar ${lugar} de ${filas.length}!`
                    : "Ya estás en el ranking."
            : completo
                ? `¡Hiciste ${p} ${p === 1 ? "punto" : "puntos"}! Escribe tu apodo para entrar al ranking.`
                : "Termina los 5 intentos para entrar al ranking.";
    }

    async function cargarRanking() {
        try {
            const r = await Juego.api("api/ranking");
            pintarRanking(r.ranking || []);
            pintarFormulario(r.ranking || []);
        } catch (err) {
            $("ranking").innerHTML = `<tr><td colspan="3" class="vacio">Sin servidor: no se puede ver el ranking</td></tr>`;
        }
    }

    $("form-ranking").addEventListener("submit", async evento => {
        evento.preventDefault();
        const apodo = $("apodo").value.trim();
        if (!apodo) {
            $("estado-ranking").textContent = "Escribe un apodo para guardar tus puntos.";
            $("apodo").focus();
            return;
        }
        $("btn-guardar").disabled = true;
        try {
            const r = await Juego.post("api/ranking", {
                apodo,
                puntos: Juego.retos.puntos(),
                aciertos_cnn: Juego.retos.aciertos("CNN"),
                aciertos_mlp: Juego.retos.aciertos("MLP")
            });
            idGuardado = r.id;
            try { localStorage.setItem(CLAVE_GUARDADO, idGuardado); } catch (err) { /* sin almacenamiento */ }
            pintarRanking(r.ranking || [], true);
            pintarFormulario(r.ranking || []);
        } catch (err) {
            $("estado-ranking").textContent = "No se pudo guardar. Revisa que el servidor de Python esté encendido.";
            $("btn-guardar").disabled = false;
        }
    });

    $("btn-jugar-de-nuevo").addEventListener("click", () => {
        Juego.retos.reiniciar();
        idGuardado = null;
        try { localStorage.removeItem(CLAVE_GUARDADO); } catch (err) { /* sin almacenamiento */ }
        $("apodo").value = "";
        Juego.irA(1);
    });

    Juego.alEntrar(3, () => {
        pintarGrafico();
        pintarTarjetaMancha();
        pintarFormulario();
        cargarRanking();
    });
})();
