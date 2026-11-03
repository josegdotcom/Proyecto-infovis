// modelos_audio.js
// Motor de sonificación comparativa entre CNN y MLP (usa Tone.js, cargado por la página).
// Lo usa exploracion/comparacion.js a través del objeto global ModelosAudio.
//
// Solo suena una cosa a la vez: cada sonido nuevo corta al anterior.

// Módulo autoejecutable: el estado queda privado y solo se expone la API del final
const ModelosAudio = (() => {
    let listo = false;
    let cnnSynth = null;
    let mlpSynth = null;
    let canalIzquierdo = null;
    let canalDerecho = null;

    // Temporizadores de las notas que faltan por sonar, para poder cancelarlas
    let pendientes = [];

    // Crea los sintetizadores y canales. Debe llamarse tras un gesto del usuario
    // (click o tecla), porque el navegador bloquea el audio hasta entonces.
    async function activar() {
        if (listo) return;

        // Se asegura de que el contexto de audio esté iniciado
        await Tone.start();

        // 1. Timbre CNN: Sintético digital y brillante (FM Synth)
        cnnSynth = new Tone.FMSynth({
            harmonicity: 2,
            modulationIndex: 5,
            oscillator: { type: "sawtooth" },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.5 },
            modulation: { type: "square" }
        });

        // 2. Timbre MLP: Acústico, orgánico y directo (Triángulo percusivo)
        mlpSynth = new Tone.Synth({
            oscillator: { type: "triangle" },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.0, release: 0.1 }
        });

        // Nodos de paneo para la comparación estéreo
        canalIzquierdo = new Tone.Panner(-0.8).toDestination();
        canalDerecho = new Tone.Panner(0.8).toDestination();

        listo = true;
    }

    // Mapeo de precisión a una nota MIDI. El rango útil va de 80% (Do4) a 100% (Do6):
    // dos octavas para 20 puntos, así unos pocos puntos de diferencia se oyen como
    // varios semitonos. Con el rango anterior (0% a 100% en tres octavas) los cuatro
    // resultados quedaban a uno o dos semitonos entre sí.
    const PRECISION_MIN = 0.8;
    const MIDI_MIN = 60;
    const MIDI_MAX = 84;

    // Convierte una precisión (0 a 1) en un nombre de nota de Tone, p. ej. "E5"
    function calcularNota(accuracy) {
        const t = Math.max(0, Math.min(1, (accuracy - PRECISION_MIN) / (1 - PRECISION_MIN)));
        const midi = Math.round(MIDI_MIN + t * (MIDI_MAX - MIDI_MIN));
        return Tone.Frequency(midi, "midi").toNote();
    }

    // Indica si el nombre del modelo corresponde a la CNN (si no, se trata como MLP)
    function esCNN(modelo) {
        return modelo.toLowerCase().includes("cnn") || modelo.toLowerCase().includes("convolucional");
    }

    // Corta lo que esté sonando y cancela lo que faltaba por sonar
    function detener() {
        pendientes.forEach(clearTimeout);
        pendientes = [];

        if (listo) {
            cnnSynth.triggerRelease();
            mlpSynth.triggerRelease();
        }
    }

    // Tone exige que cada nota de un sintetizador empiece después de la anterior. Si el
    // navegador atrasa los temporizadores (pestaña en segundo plano) dos notas podrían
    // caer en el mismo instante, así que se separan unos milisegundos.
    const ultimoDisparo = new Map();

    // Toca `nota` durante `duracion` lo antes posible respetando esa separación mínima
    function disparar(synth, nota, duracion) {
        const cuando = Math.max(Tone.now(), (ultimoDisparo.get(synth) || 0) + 0.02);

        ultimoDisparo.set(synth, cuando);
        synth.triggerAttackRelease(nota, duracion, cuando);
    }

    // Ejecuta `accion` dentro de `segundos`, guardando el temporizador para poder cancelarlo
    function programar(accion, segundos) {
        pendientes.push(setTimeout(accion, segundos * 1000));
    }

    // Serie de pulsos de un modelo (Tiempo = duración de la serie, Aciertos = Tono).
    // Empieza `inicio` segundos después de ahora y devuelve cuánto dura.
    function pulsos(modelo, datos, salida, inicio) {
        const synth = esCNN(modelo) ? cnnSynth : mlpSynth;

        // Ritmo CNN: pulsos más lentos (1 cada 0.25s). Ritmo MLP: ráfaga rápida (1 cada 0.1s)
        const paso = esCNN(modelo) ? 0.25 : 0.1;
        const nota = calcularNota(datos.accuracy);

        // Escalamos el tiempo de entrenamiento (ej. 21.8s reales -> 2.18s de audio)
        const duracion = datos.tiempo_entrenamiento_s / 10;

        programar(() => synth.disconnect().connect(salida), inicio);

        for (let t = 0; t < duracion; t += paso) {
            programar(() => disparar(synth, nota, 0.05), inicio + t);
        }

        // Earcon de cierre (nota más aguda y larga)
        programar(() => disparar(synth, calcularNota(datos.accuracy + 0.05), 0.5), inicio + duracion);

        return duracion + 0.7;
    }

    // Dispara una sola nota con el timbre correcto al hacer Hover en el gráfico
    function sonarHover(modelo, accuracy) {
        if (!listo) return;
        detener();

        const synth = esCNN(modelo) ? cnnSynth : mlpSynth;

        synth.disconnect().toDestination(); // Centro
        disparar(synth, calcularNota(accuracy), "8n");
    }

    // Entrenamiento de un solo modelo, al centro. Devuelve los segundos que dura.
    function sonarEntrenamiento(modelo, datos) {
        if (!listo) return 0;
        detener();

        return pulsos(modelo, datos, Tone.getDestination(), 0);
    }

    // Reproduce una lista de pasos, uno después del otro para que no se mezclen.
    // Cada paso es { tipo: "nota" | "pulsos", modelo, datos, pausa }:
    //   "nota"   -> una sola nota (Aciertos = Tono)
    //   "pulsos" -> la serie de pulsos del entrenamiento (Tiempo = duración)
    // La CNN suena por la izquierda y el MLP por la derecha. `pausa` son los segundos
    // de silencio antes del paso. Devuelve cuándo empieza y cuánto dura cada paso.
    function reproducirSecuencia(pasos) {
        if (!listo) return [];
        detener();

        let inicio = 0;

        return pasos.map(paso => {
            const salida = esCNN(paso.modelo) ? canalIzquierdo : canalDerecho;
            let duracion;

            inicio += paso.pausa || 0;

            if (paso.tipo === "nota") {
                const synth = esCNN(paso.modelo) ? cnnSynth : mlpSynth;

                programar(() => {
                    synth.disconnect().connect(salida);
                    disparar(synth, calcularNota(paso.datos.accuracy), 0.4);
                }, inicio);

                duracion = 0.8;
            } else {
                duracion = pulsos(paso.modelo, paso.datos, salida, inicio);
            }

            const tramo = { inicio, duracion };
            inicio += duracion;

            return tramo;
        });
    }

    // API pública del módulo
    return { activar, detener, sonarHover, sonarEntrenamiento, reproducirSecuencia };
})();
