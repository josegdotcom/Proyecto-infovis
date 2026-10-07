// modelos_audio.js
// Motor de sonificación comparativa entre CNN y MLP.

const ModelosAudio = (() => {
    let listo = false;
    let cnnSynth = null;
    let mlpSynth = null;
    let canalIzquierdo = null;
    let canalDerecho = null;

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

    // Mapeo de precisión (0.0 a 1.0) a una nota MIDI
    function calcularNota(accuracy) {
        const midi = Math.round(48 + accuracy * 36); // Parecido a la lógica de la aguja
        return Tone.Frequency(midi, "midi").toNote();
    }

    // Dispara una sola nota con el timbre correcto al hacer Hover en el gráfico
    function sonarHover(modelo, accuracy) {
        if (!listo) return;
        const nota = calcularNota(accuracy);
        
        if (modelo.toLowerCase().includes("cnn") || modelo.toLowerCase().includes("convolucional")) {
            cnnSynth.disconnect().toDestination(); // Centro
            cnnSynth.triggerAttackRelease(nota, "8n");
        } else if (modelo.toLowerCase().includes("mlp") || modelo.toLowerCase().includes("densa")) {
            mlpSynth.disconnect().toDestination(); // Centro
            mlpSynth.triggerAttackRelease(nota, "8n");
        }
    }

    // Reproducción simultánea rítmica (Tiempo = Ritmo, Aciertos = Tono)
    function compararEstereo(modeloCNN, modeloMLP) {
        if (!listo) return;

        // Ruteo estéreo: CNN izquierda, MLP derecha
        cnnSynth.disconnect().connect(canalIzquierdo);
        mlpSynth.disconnect().connect(canalDerecho);

        const ahora = Tone.now() + 0.1;
        const notaCNN = calcularNota(modeloCNN.accuracy);
        const notaMLP = calcularNota(modeloMLP.accuracy);

        // Escalamos el tiempo de entrenamiento (ej. 21.8s reales -> 2.18s de audio)
        const duracionCNN = modeloCNN.tiempo_entrenamiento_s / 10;
        const duracionMLP = modeloMLP.tiempo_entrenamiento_s / 10;

        // Ritmo CNN: Pulsos más lentos y sostenidos (1 cada 0.25s)
        for (let t = 0; t < duracionCNN; t += 0.25) {
            cnnSynth.triggerAttackRelease(notaCNN, 0.05, ahora + t);
        }
        // Earcon de cierre CNN (acorde de victoria/fin)
        cnnSynth.triggerAttackRelease(calcularNota(modeloCNN.accuracy + 0.05), 0.5, ahora + duracionCNN);

        // Ritmo MLP: Ráfaga rápida (1 cada 0.1s) porque entrena más rápido
        for (let t = 0; t < duracionMLP; t += 0.1) {
            mlpSynth.triggerAttackRelease(notaMLP, 0.05, ahora + t);
        }
        // Earcon de cierre MLP
        mlpSynth.triggerAttackRelease(calcularNota(modeloMLP.accuracy + 0.05), 0.5, ahora + duracionMLP);
    }

    return { activar, sonarHover, compararEstereo };
})();