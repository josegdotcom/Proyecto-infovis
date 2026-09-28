// Motor de sonido del aplausometro (Tone.js + Web Audio).
//
// Mapeo dato -> sonido:
//   tiempo de entrenamiento -> duracion del redoble de tambor (ritmo)
//   precision sobre el azar -> cantidad de aplaudidores y duracion del aplauso (ritmo/densidad)
//   precision               -> altura de la nota de la aguja (tono, en MIDI)
//   precision alta          -> se suman silbidos de celebracion (timbre)
//   precision bajo el azar  -> grillos y trombon triste en vez de aplausos (timbre)

const Aplausometro = (() => {

    const AZAR = 0.5;

    let listo = false;
    let bufferRuido = null;
    let salida = null;

    function ctx() {
        return Tone.getContext().rawContext;
    }

    async function activar() {
        if (listo) {
            return;
        }

        await Tone.start();

        salida = new Tone.Gain(0.9).toDestination();

        // Un segundo de ruido blanco que se reutiliza para cada palmada
        const c = ctx();
        bufferRuido = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const datos = bufferRuido.getChannelData(0);

        for (let i = 0; i < datos.length; i++) {
            datos[i] = Math.random() * 2 - 1;
        }

        listo = true;
    }

    function estaListo() {
        return listo;
    }

    function ahora() {
        return Tone.now();
    }

    function limitar(valor, min, max) {
        return Math.max(min, Math.min(max, valor));
    }

    // Calidad del modelo por sobre el azar, en [0, 1]
    function calidad(accuracy) {
        return limitar((accuracy - AZAR) / (1 - AZAR), 0, 1);
    }

    // ---------------------------------------------------------------
    // Palmada: rafaga corta de ruido filtrado. Cada aplaudidor tiene
    // su propia frecuencia de filtro, asi el publico suena variado.
    // ---------------------------------------------------------------

    function palmada(tiempo, frecuencia, volumen) {
        const c = ctx();

        const fuente = c.createBufferSource();
        fuente.buffer = bufferRuido;

        const filtro = c.createBiquadFilter();
        filtro.type = "bandpass";
        filtro.frequency.value = frecuencia;
        filtro.Q.value = 1.2;

        const ganancia = c.createGain();
        ganancia.gain.setValueAtTime(0, tiempo);
        ganancia.gain.linearRampToValueAtTime(volumen, tiempo + 0.002);
        ganancia.gain.exponentialRampToValueAtTime(0.001, tiempo + 0.09);

        fuente.connect(filtro);
        filtro.connect(ganancia);
        Tone.connect(ganancia, salida);

        fuente.start(tiempo, Math.random() * 0.8, 0.12);
    }

    // ---------------------------------------------------------------
    // Redoble de tambor: su duracion codifica el tiempo de entrenamiento
    // ---------------------------------------------------------------

    function duracionRedoble(segundosEntrenamiento) {
        // Escala logaritmica: 1 s -> 0.4 s de redoble, 1000 s -> 3 s
        const t = limitar(Math.log10(segundosEntrenamiento) / 3, 0, 1);
        return 0.4 + t * 2.6;
    }

    function redoble(inicio, duracion) {
        let t = inicio;
        let i = 0;

        while (t < inicio + duracion) {
            const progreso = (t - inicio) / duracion;
            const volumen = 0.12 + progreso * 0.25;
            palmada(t, 250 + (i % 2) * 60, volumen);
            t += 0.045 + Math.random() * 0.01;
            i++;
        }

        // Golpe final
        palmada(inicio + duracion, 180, 0.6);

        return inicio + duracion + 0.15;
    }

    // ---------------------------------------------------------------
    // Aguja: una nota cuya altura sube con la precision
    // ---------------------------------------------------------------

    function notaAguja(inicio, accuracy) {
        // 0% -> MIDI 48 (Do3), 100% -> MIDI 84 (Do6)
        const midi = Math.round(48 + accuracy * 36);

        const synth = new Tone.Synth({
            oscillator: { type: "triangle" },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.6 }
        }).connect(salida);
        synth.volume.value = -10;

        synth.triggerAttackRelease(Tone.Frequency(midi, "midi"), 0.5, inicio);
        setTimeout(() => synth.dispose(), (inicio - ahora() + 2) * 1000);
    }

    // ---------------------------------------------------------------
    // Publico aplaudiendo: densidad y duracion segun la calidad
    // ---------------------------------------------------------------

    function aplauso(inicio, q) {
        const aplaudidores = Math.round(3 + q * 37);
        const duracion = 1 + q * 3;

        for (let a = 0; a < aplaudidores; a++) {
            const frecuencia = 900 + Math.random() * 1400;
            const periodo = 0.18 + Math.random() * 0.12;
            const volumen = (0.25 + Math.random() * 0.2) / Math.sqrt(aplaudidores) * 2;

            let t = inicio + Math.random() * 0.3;

            while (t < inicio + duracion) {
                // El aplauso se apaga al final
                const restante = (inicio + duracion - t) / duracion;
                palmada(t, frecuencia, volumen * Math.min(1, restante * 3));
                t += periodo + (Math.random() - 0.5) * 0.04;
            }
        }

        // Silbidos de celebracion solo para modelos claramente buenos
        const silbidos = q > 0.6 ? Math.round((q - 0.6) * 10) : 0;

        for (let s = 0; s < silbidos; s++) {
            silbido(inicio + 0.3 + s * 0.6 + Math.random() * 0.2);
        }

        return inicio + duracion;
    }

    function silbido(tiempo) {
        const osc = new Tone.Oscillator(1800, "sine").connect(salida);
        osc.volume.value = -22;

        osc.frequency.setValueAtTime(1600, tiempo);
        osc.frequency.exponentialRampToValueAtTime(2800, tiempo + 0.25);
        osc.frequency.exponentialRampToValueAtTime(2200, tiempo + 0.45);

        osc.start(tiempo).stop(tiempo + 0.45);
        setTimeout(() => osc.dispose(), (tiempo - ahora() + 1) * 1000);
    }

    // ---------------------------------------------------------------
    // Bajo el azar: grillos (silencio incomodo) y trombon triste
    // ---------------------------------------------------------------

    function grillos(inicio, duracion) {
        const osc = new Tone.Oscillator(4400, "sine");
        const envolvente = new Tone.Gain(0).connect(salida);
        osc.connect(envolvente);
        osc.volume.value = -14;

        let t = inicio;

        while (t < inicio + duracion) {
            // Tres pulsos cortos y una pausa
            for (let p = 0; p < 3; p++) {
                const tp = t + p * 0.06;
                envolvente.gain.setValueAtTime(0, tp);
                envolvente.gain.linearRampToValueAtTime(0.5, tp + 0.01);
                envolvente.gain.linearRampToValueAtTime(0, tp + 0.04);
            }
            t += 0.7;
        }

        osc.start(inicio).stop(inicio + duracion);
        setTimeout(() => {
            osc.dispose();
            envolvente.dispose();
        }, (inicio - ahora() + duracion + 1) * 1000);

        return inicio + duracion;
    }

    function tromboneTriste(inicio) {
        const synth = new Tone.MonoSynth({
            oscillator: { type: "sawtooth" },
            filter: { Q: 2, type: "lowpass" },
            filterEnvelope: { attack: 0.05, decay: 0.3, sustain: 0.4, baseFrequency: 300, octaves: 2 },
            envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.3 }
        }).connect(salida);
        synth.volume.value = -14;

        const notas = ["D4", "C#4", "C4", "B3"];

        notas.forEach((nota, i) => {
            const largo = i === notas.length - 1 ? 1.0 : 0.35;
            synth.triggerAttackRelease(nota, largo, inicio + i * 0.4);
        });

        setTimeout(() => synth.dispose(), (inicio - ahora() + 3.5) * 1000);

        return inicio + 2.4;
    }

    // ---------------------------------------------------------------
    // Secuencia completa para un modelo. Devuelve los tiempos (en
    // segundos desde ahora) para sincronizar la animacion visual.
    // ---------------------------------------------------------------

    function evaluar(modelo) {
        const inicio = ahora() + 0.05;
        const finRedoble = redoble(inicio, duracionRedoble(modelo.tiempo_entrenamiento_s));

        notaAguja(finRedoble, modelo.accuracy);

        let fin;

        if (modelo.accuracy < AZAR) {
            tromboneTriste(finRedoble + 0.3);
            fin = grillos(finRedoble + 0.5, 3);
        } else {
            fin = aplauso(finRedoble + 0.1, calidad(modelo.accuracy));
        }

        return {
            redoble: finRedoble - ahora(),
            total: fin - ahora()
        };
    }

    // ---------------------------------------------------------------
    // Earcons para un dibujo individual
    // ---------------------------------------------------------------

    function veredicto(tipo) {
        const t = ahora() + 0.02;

        if (tipo === "correcta") {
            palmada(t, 1400, 0.8);
            palmada(t + 0.22, 1400, 0.8);
            const synth = new Tone.Synth({ oscillator: { type: "sine" } }).connect(salida);
            synth.volume.value = -14;
            synth.triggerAttackRelease("E6", 0.15, t + 0.45);
            setTimeout(() => synth.dispose(), 1500);
        } else if (tipo === "incorrecta") {
            const synth = new Tone.Synth({
                oscillator: { type: "square" },
                envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.1 }
            }).connect(salida);
            synth.volume.value = -18;
            synth.triggerAttackRelease("A2", 0.45, t);
            setTimeout(() => synth.dispose(), 1500);
        } else {
            grillos(t, 1.4);
        }
    }

    return { activar, estaListo, evaluar, veredicto, duracionRedoble };

})();
