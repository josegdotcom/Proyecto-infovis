// Grafico de comparacion: aciertos y tiempo de entrenamiento de cada modelo en las dos pruebas.
// Usa los mismos datos que la galeria (datos.js) pero es una pagina independiente.
//
// Sonido (js/modelos_audio.js):
//   aciertos                -> altura de la nota (mas agudo = mas aciertos)
//   tiempo de entrenamiento -> duracion de la serie de pulsos
//   modelo                  -> timbre y lado (CNN a la izquierda, MLP a la derecha)
// Orden de "Escuchar todo": aciertos en dibujos, entrenamiento en dibujos, aciertos en
// actividades y entrenamiento en actividades; dentro de cada uno, CNN y luego MLP.
// Solo suena una cosa a la vez: cada sonido nuevo corta al anterior.

// Color fijo por modelo (por entidad, nunca por ranking)
const MODELOS = [
    { clave: "CNN", nombre: "CNN (convolucional)", color: "var(--modelo-cnn)" },
    { clave: "MLP", nombre: "MLP (red densa)", color: "var(--modelo-mlp)" }
];

const PRUEBAS = [
    // ejemplo: dibujo que representa a cada clase (posicion dentro de los 10 casos individuales)
    { datos: DATOS.p1, nombre: "Dibujos", detalle: "Gato vs. perro", ejemplo: [4, 6] },
    { datos: DATOS.p2, nombre: "Actividades", detalle: "Acciones humanas" }
];

// Escalas constantes en las dos pruebas, para poder compararlas entre si
const ESCALA_ACIERTOS = 100;
const ESCALA_TIEMPO = 22;

function decimal(valor, decimales = 1) {
    return valor.toFixed(decimales).replace(".", ",");
}

function css(variable) {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

function hexARgb(hex) {
    const limpio = hex.replace("#", "");
    return [0, 2, 4].map(i => parseInt(limpio.slice(i, i + 2), 16));
}

function pintarDibujo(canvas, pixeles) {
    canvas.width = 28;
    canvas.height = 28;

    const c = canvas.getContext("2d");
    const imagen = c.createImageData(28, 28);
    const [tr, tg, tb] = hexARgb(css("--texto-primario"));
    const [fr, fg, fb] = hexARgb(css("--plano"));

    pixeles.forEach((valor, i) => {
        const a = valor / 255;
        imagen.data[i * 4] = Math.round(fr + (tr - fr) * a);
        imagen.data[i * 4 + 1] = Math.round(fg + (tg - fg) * a);
        imagen.data[i * 4 + 2] = Math.round(fb + (tb - fb) * a);
        imagen.data[i * 4 + 3] = 255;
    });

    c.putImageData(imagen, 0, 0);
}

// Pictogramas de las actividades de la Prueba 2 (lienzo de 28 x 28, igual que los dibujos)
const ESCALERA = '<path d="M3 26H10V21H17V16H25"/>';
const PERSONA_ESCALERA = '<circle cx="11" cy="5" r="2.4"/><path d="M11 7.5L12 15M12 15L10.5 21M12 15L16.5 13L17 16M11.3 10L15.5 11.5M11.3 10L8.5 13.5"/>';

const FIGURAS = {
    "Camina": '<circle cx="14" cy="5" r="2.4"/><path d="M14 7.5V17M14 17L9.5 25.5M14 17L18 21L19 25.5M14 10.5L9.5 14.5M14 10.5L18.5 14"/>',
    "Sube": `${ESCALERA}${PERSONA_ESCALERA}<path d="M20 9L25 4M21 4H25V8"/>`,
    "Baja": `<g transform="translate(28 0) scale(-1 1)">${ESCALERA}${PERSONA_ESCALERA}</g><path d="M3 4L8 9M4 9H8V5"/>`,
    "Sentado": '<circle cx="12" cy="6" r="2.4"/><path d="M12 8.5V17H19V25.5M12 12L17 14.5"/><path d="M8 9V25.5M8 20H15.5V25.5" opacity="0.45"/>',
    "Parado": '<circle cx="14" cy="5" r="2.4"/><path d="M14 7.5V18M14 18L12 26M14 18L16 26M14 10.5L11 17M14 10.5L17 17"/>',
    "Acostado": '<circle cx="6.5" cy="16.5" r="2.4"/><path d="M9 17.5H25M12 17.5L16 14.5"/><path d="M3 21.5H26M4 21.5V25M25 21.5V25" opacity="0.45"/>'
};

function figura(clase) {
    return `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FIGURAS[clase]}</svg>`;
}

// Imagen de una clase: un dibujo de ejemplo si la prueba tiene, o su pictograma
function iconoClase(prueba, clase) {
    if (prueba.ejemplo) {
        const canvas = document.createElement("canvas");
        pintarDibujo(canvas, prueba.datos.individuales.imagenes[prueba.ejemplo[clase]]);
        return canvas;
    }

    const caja = document.createElement("span");
    caja.innerHTML = figura(prueba.datos.clases[clase]);
    return caja.firstChild;
}

// Un bloque de barras: una por modelo, con su pista y su valor
function barras(titulo, tipo, prueba, filas) {
    return `
        <div class="medida">
            <div class="encabezado">${titulo}</div>
            <dl class="barras">
                ${filas.map(f => `
                    <dt>${f.modelo.clave}</dt>
                    <dd class="pista" tabindex="0" role="button" title="${f.modelo.clave}: ${f.detalle}"
                        aria-label="Escuchar ${f.modelo.clave}: ${f.detalle}"
                        data-tipo="${tipo}" data-prueba="${prueba}" data-modelo="${f.modelo.clave}"><i style="width:${f.ancho}%;background:${f.modelo.color}"></i></dd>
                    <dd class="valor">${f.valor}</dd>
                `).join("")}
            </dl>
        </div>
    `;
}

function dibujar() {
    const TITULO_ACIERTOS = "ACIERTOS / 100";
    const TITULO_TIEMPO = "ENTRENAMIENTO (s)";

    const filas = PRUEBAS.map((p, i) => {
        const resumen = MODELOS.map(m => ({
            modelo: m,
            aciertos: Math.round(p.datos.generales[m.clave].accuracy * 100),
            tiempo: p.datos.generales[m.clave].tiempo_entrenamiento_s
        }));

        return `
            <section class="fila prueba">
                <div>
                    <h3>${p.nombre}</h3>
                    <p class="detalle">${p.detalle}</p>
                    <div class="clases" data-prueba="${i}"></div>
                    <button class="btn escuchar" type="button" data-prueba="${i}">▶ Escuchar</button>
                </div>
                ${barras(TITULO_ACIERTOS, "aciertos", i, resumen.map(r => ({
                    modelo: r.modelo,
                    ancho: r.aciertos / ESCALA_ACIERTOS * 100,
                    valor: r.aciertos,
                    detalle: `${r.aciertos} aciertos de cada 100 casos`
                })))}
                ${barras(TITULO_TIEMPO, "tiempo", i, resumen.map(r => ({
                    modelo: r.modelo,
                    ancho: r.tiempo / ESCALA_TIEMPO * 100,
                    valor: decimal(r.tiempo),
                    detalle: `${decimal(r.tiempo)} segundos de entrenamiento`
                })))}
            </section>
        `;
    });

    document.getElementById("grafico").innerHTML = `
        <h2 class="titulo">La MLP entrena más rápido en ambas pruebas</h2>
        <p class="bajada">La CNN solo obtiene más aciertos en dibujos.</p>
        <ul class="leyenda">
            ${MODELOS.map(m => `<li><span class="muestra" style="background:${m.color}"></span>${m.nombre}</li>`).join("")}
        </ul>
        <div class="sonido">
            <button id="btn-todo" class="btn escuchar" type="button">▶ Escuchar todo</button>
            <p>Más agudo = más aciertos · pulsos más largos = más entrenamiento · ▶ toca primero los aciertos y después el entrenamiento, siempre CNN (izquierda) y luego MLP (derecha).</p>
        </div>
        <div class="fila encabezados">
            <span></span>
            <span class="encabezado">${TITULO_ACIERTOS}</span>
            <span class="encabezado">${TITULO_TIEMPO}</span>
        </div>
        ${filas.join("")}
        <p class="nota">Escalas constantes: aciertos de 0 a ${ESCALA_ACIERTOS} · entrenamiento de 0 a ${ESCALA_TIEMPO} segundos</p>
    `;

    // Las imagenes de las clases de cada prueba van bajo su nombre
    document.querySelectorAll(".clases").forEach(contenedor => {
        const p = PRUEBAS[contenedor.dataset.prueba];

        p.datos.clases.forEach((nombre, c) => {
            const clase = document.createElement("span");
            clase.appendChild(iconoClase(p, c));
            clase.appendChild(document.createTextNode(nombre));
            contenedor.appendChild(clase);
        });
    });

    conectarSonido();
}

// ---------------------------------------------------------------
// Sonido
// ---------------------------------------------------------------

let sonidoActivo = false;

// El navegador solo deja sonar despues de un gesto, asi que el sonido se activa
// con el primer click en una barra o en un boton de escuchar
async function activarSonido() {
    if (!sonidoActivo) {
        await ModelosAudio.activar();
        sonidoActivo = true;
    }
}

// Solo suena y se resalta una cosa a la vez: lo nuevo corta a lo anterior
let resaltados = [];
let comparandoHasta = 0;

function limpiarResaltado() {
    resaltados.forEach(clearTimeout);
    resaltados = [];
    comparandoHasta = 0;

    document.querySelectorAll(".sonando").forEach(el => el.classList.remove("sonando"));
    document.querySelectorAll(".escuchar").forEach(boton => { boton.disabled = false; });
}

// Marca lo que esta sonando, desde `inicio` y durante `duracion` segundos
function resaltar(elementos, inicio, duracion) {
    resaltados.push(setTimeout(() => elementos.forEach(el => el.classList.add("sonando")), inicio * 1000));
    resaltados.push(setTimeout(() => elementos.forEach(el => el.classList.remove("sonando")), (inicio + duracion) * 1000));
}

function sonarBarra(pista) {
    const { tipo, prueba, modelo } = pista.dataset;
    const datos = PRUEBAS[prueba].datos.generales[modelo];

    limpiarResaltado();

    if (tipo === "aciertos") {
        ModelosAudio.sonarHover(modelo, datos.accuracy);
        resaltar([pista], 0, 0.4);
    } else {
        resaltar([pista], 0, ModelosAudio.sonarEntrenamiento(modelo, datos));
    }
}

// Orden en que se escucha una prueba: primero los aciertos (CNN y luego MLP)
// y despues el entrenamiento (CNN y luego MLP)
function pasosPrueba(prueba) {
    const pasos = [];

    [["aciertos", "nota"], ["tiempo", "pulsos"]].forEach(([medida, tipo], k) => {
        MODELOS.forEach((m, j) => {
            pasos.push({
                tipo,
                modelo: m.clave,
                datos: PRUEBAS[prueba].datos.generales[m.clave],
                // Silencio mas largo al cambiar de medida que entre un modelo y el otro
                pausa: j > 0 ? 0.15 : (k > 0 ? 0.6 : 0),
                prueba,
                medida
            });
        });
    });

    return pasos;
}

// Reproduce los pasos en orden y marca la barra de cada uno mientras suena
function reproducir(pasos, boton) {
    limpiarResaltado();

    const tramos = ModelosAudio.reproducirSecuencia(pasos);
    const total = Math.max(...tramos.map(t => t.inicio + t.duracion));

    tramos.forEach((tramo, k) => {
        const p = pasos[k];
        const pista = document.querySelector(`.pista[data-prueba="${p.prueba}"][data-tipo="${p.medida}"][data-modelo="${p.modelo}"]`);
        resaltar([pista], tramo.inicio, tramo.duracion);
    });

    boton.disabled = true;
    comparandoHasta = Date.now() + total * 1000;
    resaltados.push(setTimeout(limpiarResaltado, total * 1000));
}

function conectarSonido() {
    // Pasar el mouse por una barra la hace sonar (solo si el sonido ya esta activado);
    // el click o Enter ademas activan el sonido, porque el navegador exige un gesto.
    document.querySelectorAll(".pista").forEach(pista => {
        pista.addEventListener("mouseenter", () => {
            // Durante una comparacion el mouse no la interrumpe; un click si
            if (sonidoActivo && Date.now() > comparandoHasta) {
                sonarBarra(pista);
            }
        });

        pista.addEventListener("click", async () => {
            await activarSonido();
            sonarBarra(pista);
        });

        pista.addEventListener("keydown", async evento => {
            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                await activarSonido();
                sonarBarra(pista);
            }
        });
    });

    // Una prueba: sus aciertos y despues su entrenamiento
    document.querySelectorAll(".escuchar[data-prueba]").forEach(escuchar => {
        escuchar.addEventListener("click", async () => {
            await activarSonido();
            reproducir(pasosPrueba(Number(escuchar.dataset.prueba)), escuchar);
        });
    });

    // Todo el grafico: las pruebas en orden, con un silencio entre una y otra
    const todo = document.getElementById("btn-todo");

    todo.addEventListener("click", async () => {
        await activarSonido();

        const pasos = PRUEBAS.flatMap((_, i) => {
            const prueba = pasosPrueba(i);
            prueba[0].pausa = i > 0 ? 1 : 0;
            return prueba;
        });

        reproducir(pasos, todo);
    });
}

dibujar();

// Redibujar si cambia el modo claro/oscuro del sistema (los dibujos usan los colores del tema)
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", dibujar);
