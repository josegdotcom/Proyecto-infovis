let running = false;
let samples = [];


const axElement = document.getElementById("ax");
const ayElement = document.getElementById("ay");
const azElement = document.getElementById("az");

const alphaElement = document.getElementById("alpha");
const betaElement = document.getElementById("beta");
const gammaElement = document.getElementById("gamma");

const timestampElement = document.getElementById("timestamp");
const samplesElement = document.getElementById("samples");

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");


function updateSensorData(event) {

    if (!running) {
        return;
    }

    const acceleration = event.acceleration;
    const rotation = event.rotationRate;

    const timestamp = Date.now();


    // =========================
    // ACELEROMETRO
    // =========================

    let ax = acceleration?.x ?? 0;
    let ay = acceleration?.y ?? 0;
    let az = acceleration?.z ?? 0;


    // =========================
    // GIROSCOPIO
    // =========================

    let alpha = rotation?.alpha ?? 0;
    let beta = rotation?.beta ?? 0;
    let gamma = rotation?.gamma ?? 0;


    // =========================
    // MOSTRAR DATOS
    // =========================

    axElement.textContent = ax.toFixed(6);
    ayElement.textContent = ay.toFixed(6);
    azElement.textContent = az.toFixed(6);

    alphaElement.textContent = alpha.toFixed(6);
    betaElement.textContent = beta.toFixed(6);
    gammaElement.textContent = gamma.toFixed(6);

    timestampElement.textContent = timestamp;


    // =========================
    // GUARDAR MUESTRA
    // =========================

    samples.push({
        timestamp: timestamp,

        ax: ax,
        ay: ay,
        az: az,

        alpha: alpha,
        beta: beta,
        gamma: gamma
    });


    samplesElement.textContent = samples.length;
}


async function startSensors() {

    /*
     * Algunos navegadores, especialmente en iOS,
     * requieren solicitar permiso explicitamente.
     */

    if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
    ) {

        try {

            const permission =
                await DeviceMotionEvent.requestPermission();

            if (permission !== "granted") {

                alert("Permiso para acceder a los sensores denegado.");

                return;
            }

        } catch (error) {

            console.error(
                "Error solicitando permiso:",
                error
            );

            return;
        }
    }


    running = true;

    samples = [];

    window.addEventListener(
        "devicemotion",
        updateSensorData
    );

    console.log("Sensores iniciados.");
}


function stopSensors() {

    running = false;

    window.removeEventListener(
        "devicemotion",
        updateSensorData
    );

    console.log("Sensores detenidos.");

    console.log("Muestras:", samples);
}


startButton.addEventListener(
    "click",
    startSensors
);


stopButton.addEventListener(
    "click",
    stopSensors
);