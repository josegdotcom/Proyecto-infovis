// Paso 4 · Resultados: por cada prueba, una barra por robot con sus aciertos «de N»
// (N = INTENTOS_POR_PRUEBA) y una raya negra con lo que prometió (aciertos de la
// Entrega 1, exploracion/datos.js). Una frase dice quién ganó cada prueba.
// «Jugar de nuevo» borra los intentos de las dos pruebas y vuelve al paso 1.

(() => {
    const $ = Juego.$;
    const PRUEBAS = [
        { numero: 1, emoji: "🖍️", titulo: "Prueba 1 · ¿Es un gato o un perro?", datos: DATOS.p1, intentos: () => Juego.prueba1.intentos() },
        { numero: 2, emoji: "🏃", titulo: "Prueba 2 · ¿Qué estás haciendo?", datos: DATOS.p2, intentos: () => Juego.prueba2.intentos() }
    ];

    function nombre(r) {
        return `<strong class="nombre-robot" style="--color:${r.color}">${r.nombre}</strong>`;
    }

    function frase(prueba, lista) {
        const [a, b] = Juego.ROBOTS.map(r => prueba.datos.generales[r.clave].accuracy);
        const prometio = a >= b ? Juego.ROBOTS[0] : Juego.ROBOTS[1];
        if (!lista.length) return `Todavía no hay intentos en esta prueba. ${nombre(prometio)} prometió ganar.`;

        const [ca, cb] = Juego.ROBOTS.map(r => lista.filter(i => i.modelos[r.clave].correcto).length);
        if (ca === cb) return `🤝 ¡Empate! Los dos acertaron ${ca}. ${nombre(prometio)} había prometido ganar.`;
        const ganador = ca > cb ? Juego.ROBOTS[0] : Juego.ROBOTS[1];
        return ganador === prometio
            ? `🏆 Ganó ${nombre(ganador)}, ¡como prometió!`
            : `😮 ¡Sorpresa! Prometió ganar ${nombre(prometio)}, pero ganó ${nombre(ganador)}.`;
    }

    function pintar() {
        $("resultados").innerHTML = PRUEBAS.map(p => {
            const lista = p.intentos();
            const filas = Juego.ROBOTS.map((r, indice) => {
                const aciertos = lista.filter(i => i.modelos[r.clave].correcto).length;
                const prometido = p.datos.generales[r.clave].accuracy;
                const descripcion = `${r.nombre}: ${aciertos} aciertos de ${INTENTOS_POR_PRUEBA}; prometió ${Math.round(prometido * 100)} %`;
                return `
                    <div class="fila-resultado" style="--color:${r.color}">
                        <span class="robot-resultado"><span class="cara">${r.dibujo}</span>${r.nombre}</span>
                        <div class="pista-resultado" role="img" aria-label="${descripcion}" title="${descripcion}">
                            <i class="barra-resultado" style="width:${aciertos / INTENTOS_POR_PRUEBA * 100}%"></i>
                            ${Array.from({ length: INTENTOS_POR_PRUEBA - 1 }, (_, k) =>
                                `<span class="division" style="left:${(k + 1) / INTENTOS_POR_PRUEBA * 100}%"></span>`).join("")}
                            <span class="raya-prometido" style="left:${prometido * 100}%"><small class="${indice ? "abajo" : ""}">prometió ${Math.round(prometido * 100)} %</small></span>
                        </div>
                        <span class="valor-resultado"><b>${aciertos}</b> de ${INTENTOS_POR_PRUEBA}</span>
                    </div>`;
            }).join("");

            const faltan = lista.length < INTENTOS_POR_PRUEBA
                ? `<p class="faltan">Hiciste ${lista.length} de ${INTENTOS_POR_PRUEBA} intentos.</p>` : "";

            return `
                <section class="bloque-resultado" aria-labelledby="titulo-resultado-${p.numero}">
                    <h2 id="titulo-resultado-${p.numero}"><span aria-hidden="true">${p.emoji}</span> ${p.titulo}</h2>
                    ${filas}
                    <p class="frase-resultado">${frase(p, lista)}</p>
                    ${faltan}
                </section>`;
        }).join("");
    }

    Juego.alEntrar(4, async () => {
        pintar();
        try {
            await Juego.prueba2.actualizar();
            pintar();
        } catch (err) {
            // Sin servidor: se muestran los datos que ya había.
        }
    });

    $("btn-jugar-de-nuevo").addEventListener("click", async () => {
        Juego.prueba1.reiniciar();
        try {
            await Juego.prueba2.reiniciar();
        } catch (err) {
            // Sin servidor: la Prueba 2 se reiniciará cuando vuelva.
        }
        Juego.irA(1);
    });
})();
