// Paso 1 · El truco: el mismo gato, quieto y después movido 2 casillas.
//
//   CNN: una lupa recorre las orejas. Cuando el gato se mueve, las encuentra igual.
//   MLP: cuando el gato se mueve, se marcan en rojo las casillas que cambiaron. Para la
//        MLP es otro dibujo y deja de reconocerlo.
//
// Se anima sola y en ciclo, solo mientras el paso 1 está visible:
//   quieto (4 s) -> se mueve (1 casilla por vez) -> movido (4,5 s) -> vuelve al centro.
// La lupa de la CNN cambia de oreja cada 1,9 s.
// Con «reducir movimiento» activado en el sistema, cada fase dura el doble y sin transiciones.

(() => {
    const $ = Juego.$;

    // Gato de 10×10 (1 = tinta) dentro de una grilla de 14×14
    const GATO = [
        "1000000001",
        "1100000011",
        "1111111111",
        "1001111001",
        "1111111111",
        "1111001111",
        "0111111110",
        "0011111100",
        "0001111000",
        "0000000000"
    ].map(fila => [...fila].map(Number));
    const N = 14;
    const INICIO = 1;          // casilla donde empieza el gato
    const MOVIMIENTO = 2;      // casillas que se mueve hacia abajo y a la derecha
    const LENTO = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 2 : 1;

    function lamina(desplazamiento) {
        const g = Array.from({ length: N }, () => new Array(N).fill(0));
        const o = INICIO + desplazamiento;
        GATO.forEach((fila, y) => fila.forEach((v, x) => { if (v) g[y + o][x + o] = 1; }));
        return g.flat();
    }
    const QUIETO = lamina(0);

    function armar(id, conLupa) {
        const el = $(id);
        el.innerHTML = Array.from({ length: N * N }, () => "<i></i>").join("") +
            (conLupa ? '<span class="lupa-truco" id="lupa-truco"></span>' : "");
        return [...el.querySelectorAll("i")];
    }
    const celdasCnn = armar("grilla-cnn", true);
    const celdasMlp = armar("grilla-mlp", false);

    // Las orejas están en las columnas 0 y 9 del gato (filas 0 y 1)
    let oreja = 0;
    function moverLupa(desplazamiento) {
        const o = INICIO + desplazamiento;
        const lupa = $("lupa-truco");
        lupa.style.setProperty("--x", o + (oreja ? 8 : 0));
        lupa.style.setProperty("--y", o);
        lupa.style.setProperty("--n", N);
    }

    let desplazamientoActual = 0;
    function pintar(desplazamiento, fase) {
        desplazamientoActual = desplazamiento;
        const actual = lamina(desplazamiento);
        let cambios = 0;
        celdasCnn.forEach((c, i) => c.classList.toggle("tinta", actual[i] === 1));
        celdasMlp.forEach((c, i) => {
            const cambio = desplazamiento > 0 && actual[i] !== QUIETO[i];
            if (cambio) cambios += 1;
            c.classList.toggle("tinta", actual[i] === 1 && !cambio);
            c.classList.toggle("cambio", cambio);
        });
        moverLupa(desplazamiento);

        $("estado-truco").textContent = fase === "quieto" ? "Quieto" : fase === "moviendo" ? "Se mueve…" : `Movido ${MOVIMIENTO} casillas`;
        $("estado-truco").dataset.fase = fase;
        $("globo-cnn").textContent = "Gato";
        $("motivo-cnn").textContent = fase === "movido" ? "Las orejas siguen ahí." : "";
        const dudaMlp = fase === "movido";
        $("globo-mlp").textContent = dudaMlp ? "¿Perro?" : fase === "moviendo" ? "…" : "Gato";
        $("globo-mlp").classList.toggle("duda", dudaMlp);
        $("motivo-mlp").textContent = dudaMlp ? `Cambiaron ${cambios} casillas: ya no lo reconoce.` : "";
    }

    // Guion de la animación: [desplazamiento, fase, milisegundos]
    const GUION = [
        [0, "quieto", 4000],
        [1, "moviendo", 600],
        [2, "movido", 4500],
        [1, "moviendo", 600]
    ];

    let paso = 0;
    let temporizador = null;
    let lupaTemporizador = null;

    function siguiente() {
        const [desplazamiento, fase, ms] = GUION[paso];
        pintar(desplazamiento, fase);
        paso = (paso + 1) % GUION.length;
        temporizador = setTimeout(siguiente, ms * LENTO);
    }

    function iniciar() {
        detener();
        paso = 0;
        siguiente();
        lupaTemporizador = setInterval(() => {
            oreja = 1 - oreja;
            moverLupa(desplazamientoActual);
        }, 1900 * LENTO);
    }

    function detener() {
        clearTimeout(temporizador);
        clearInterval(lupaTemporizador);
    }

    pintar(0, "quieto");
    Juego.alEntrar(1, iniciar);
    Juego.alSalir(1, detener);
})();
