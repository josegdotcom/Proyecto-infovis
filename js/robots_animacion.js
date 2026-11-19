// Paso 1 · Conoce a los robots: animación de cómo toma los datos cada uno.
//
//   Robo-Lupa (CNN): una lupa de 2×2 casillas recorre un dibujo pixelado de un gato y
//                    anota cuánta tinta encuentra en cada pedacito (un «mapa» de 5×5).
//   Robo-Lista (MLP): el mismo dibujo se lee fila por fila y se convierte en una fila
//                    larga de 100 números (0 = blanco, 1 = tinta).
//
// Solo se anima mientras el paso 1 está visible. Con «reducir movimiento» activado en el
// sistema, avanza más lento y sin transiciones.

(() => {
    // Gato de 10×10 (1 = tinta)
    const DIBUJO = [
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
    const N = DIBUJO.length;
    const LUPA = 2;
    const PASOS_LUPA = (N / LUPA) ** 2;          // 25 pedacitos
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const MS_LUPA = reducir ? 1400 : 480;
    const MS_FILA = reducir ? 2400 : 1150;
    const PAUSA_FINAL = 1800;

    const $ = Juego.$;

    function grillaDibujo(clase = "") {
        return `<div class="pixeles ${clase}" style="--n:${N}">${DIBUJO.flat().map(v =>
            `<span class="${v ? "tinta" : ""}"></span>`).join("")}</div>`;
    }

    // ---------------- Robo-Lupa ----------------
    function construirLupa() {
        $("escena-lupa").innerHTML = `
            <div class="lado">
                <div class="marco-pixeles">
                    ${grillaDibujo()}
                    <div class="lupa" id="lupa" style="--x:0;--y:0;--n:${N}"><span>🔍</span></div>
                </div>
                <p class="pie-escena">El dibujo, en casillas</p>
            </div>
            <div class="flecha" aria-hidden="true">→</div>
            <div class="lado">
                <div class="pixeles mapa" id="mapa-lupa" style="--n:${N / LUPA}">
                    ${Array.from({ length: PASOS_LUPA }, () => "<span></span>").join("")}
                </div>
                <p class="pie-escena" id="texto-lupa">Pedacitos con forma</p>
            </div>`;
    }

    let pasoLupa = 0;
    function avanzarLupa() {
        const mapa = $("mapa-lupa").children;
        if (pasoLupa === 0) [...mapa].forEach(c => { c.style.opacity = ""; c.classList.remove("visto"); });
        if (pasoLupa >= PASOS_LUPA) {
            pasoLupa = 0;
            return PAUSA_FINAL;
        }
        const columnas = N / LUPA;
        const fx = pasoLupa % columnas;
        const fy = Math.floor(pasoLupa / columnas);
        let tinta = 0;
        for (let dy = 0; dy < LUPA; dy++) {
            for (let dx = 0; dx < LUPA; dx++) tinta += DIBUJO[fy * LUPA + dy][fx * LUPA + dx];
        }
        const lupa = $("lupa");
        lupa.style.setProperty("--x", fx * LUPA);
        lupa.style.setProperty("--y", fy * LUPA);
        const celda = mapa[pasoLupa];
        celda.classList.add("visto");
        celda.style.opacity = String(0.12 + 0.88 * tinta / (LUPA * LUPA));
        $("texto-lupa").textContent = `Pedacito ${pasoLupa + 1}: ${tinta} de 4 casillas con tinta`;
        pasoLupa += 1;
        return MS_LUPA;
    }

    // ---------------- Robo-Lista ----------------
    function construirLista() {
        $("escena-lista").innerHTML = `
            <div class="lado">
                <div class="marco-pixeles">
                    ${grillaDibujo("pixeles-lista")}
                    <div class="fila-actual" id="fila-actual" style="--y:0;--n:${N}"></div>
                </div>
                <p class="pie-escena">El mismo dibujo</p>
            </div>
            <div class="flecha" aria-hidden="true">→</div>
            <div class="lado lado-ancho">
                <p class="numeros-fila" id="numeros-fila" aria-hidden="true"></p>
                <div class="tira" id="tira" style="--total:${N * N}">
                    ${Array.from({ length: N * N }, () => "<span></span>").join("")}
                </div>
                <p class="pie-escena" id="texto-lista">Una fila larga de números</p>
            </div>`;
    }

    let filaLista = 0;
    function avanzarLista() {
        const tira = $("tira").children;
        if (filaLista === 0) [...tira].forEach(c => { c.className = ""; });
        if (filaLista >= N) {
            filaLista = 0;
            $("texto-lista").textContent = `¡Listo! ${N * N} números en una sola fila`;
            return PAUSA_FINAL;
        }
        $("fila-actual").style.setProperty("--y", filaLista);
        const valores = DIBUJO[filaLista];
        $("numeros-fila").innerHTML = valores.map(v => `<span class="${v ? "uno" : ""}">${v}</span>`).join("");
        valores.forEach((v, k) => { tira[filaLista * N + k].className = v ? "lleno uno" : "lleno"; });
        $("texto-lista").textContent = `Fila ${filaLista + 1} de ${N} → números ${filaLista * N + 1} a ${(filaLista + 1) * N}`;
        filaLista += 1;
        return MS_FILA;
    }

    // ---------------- Ciclo ----------------
    const temporizadores = {};
    function animar(nombre, avanzar) {
        const siguiente = () => { temporizadores[nombre] = setTimeout(siguiente, avanzar()); };
        siguiente();
    }

    function detener() {
        Object.values(temporizadores).forEach(clearTimeout);
    }

    construirLupa();
    construirLista();
    Juego.alEntrar(1, () => {
        detener();
        pasoLupa = 0;
        filaLista = 0;
        animar("lupa", avanzarLupa);
        animar("lista", avanzarLista);
    });
    Juego.alSalir(1, detener);
})();
