// Sonidos de acierto y error de cada red, compartidos por la página principal (index.html)
// y el teléfono (exploracion/telefono_retos.html).
//
// Usa los mismos pitidos de exploracion/sensor_prueba_2.html (osciladores de Web Audio):
//   acierto: 660 Hz y luego 990 Hz (sube)
//   error:   330 Hz y luego 220 Hz (baja)
// Primero suena la CNN y, RETRASO_MLP segundos después, la MLP.
// Cuenta regresiva de los retos: tic() cada segundo (más agudo en los últimos) y foto().
//
// Los navegadores solo dejan sonar después de un toque o clic: Sonidos.activar() se llama
// sola con el primer toque o tecla en la página.

const Sonidos = (() => {
    const RETRASO_MLP = 0.9;
    let audio = null;

    function activar() {
        try {
            if (!audio) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                audio = new Ctx();
            }
            if (audio.state === "suspended") audio.resume();
        } catch (e) {
            audio = null;
        }
    }

    function pitido(frecuencia, inicio, duracion, tipo = "sine") {
        const osc = audio.createOscillator();
        const gan = audio.createGain();
        osc.type = tipo;
        osc.frequency.value = frecuencia;
        gan.gain.setValueAtTime(0.0001, inicio);
        gan.gain.exponentialRampToValueAtTime(tipo === "sine" ? 0.25 : 0.12, inicio + 0.01);
        gan.gain.exponentialRampToValueAtTime(0.001, inicio + duracion);
        osc.connect(gan).connect(audio.destination);
        osc.start(inicio);
        osc.stop(inicio + duracion + 0.02);
    }

    function tono(acerto, retraso = 0) {
        if (!audio) return;
        try {
            const t = audio.currentTime + retraso;
            if (acerto) {
                pitido(660, t, 0.1);
                pitido(990, t + 0.1, 0.25);
            } else {
                pitido(330, t, 0.12, "square");
                pitido(220, t + 0.12, 0.3, "square");
            }
        } catch (e) {
            // Sin audio: no importa.
        }
    }

    function tic(agudo = false) {
        if (!audio) return;
        try { pitido(agudo ? 1320 : 880, audio.currentTime, 0.08); } catch (e) { /* sin audio */ }
    }

    function foto() {
        if (!audio) return;
        try {
            const t = audio.currentTime;
            pitido(1760, t, 0.05);
            pitido(1320, t + 0.06, 0.12);
        } catch (e) { /* sin audio */ }
    }

    // aciertos = { CNN: true|false, MLP: true|false }
    function resultado(aciertos) {
        tono(aciertos.CNN, 0);
        tono(aciertos.MLP, RETRASO_MLP);
        if (navigator.vibrate) {
            // Una vibración corta por acierto, larga por error, una red tras otra
            const v = ok => (ok ? 80 : 300);
            navigator.vibrate([v(aciertos.CNN), RETRASO_MLP * 1000 - v(aciertos.CNN), v(aciertos.MLP)]);
        }
    }

    ["pointerdown", "keydown"].forEach(evento =>
        window.addEventListener(evento, activar, { passive: true }));

    return { activar, resultado, tic, foto, RETRASO_MLP };
})();
