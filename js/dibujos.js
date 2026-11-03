console.log("dibujos.js se esta ejecutando");
const canvas = document.getElementById("canvas-dibujo");
console.log("Canvas encontrado:", canvas);

const ctx = canvas.getContext("2d");

const btnLimpiar = document.getElementById("btn-limpiar");

btnLimpiar.addEventListener("click", () => {
    ctx.clearRect(100, 0, canvas.width, canvas.height);
});

let dibujo = false;

canvas.addEventListener("mousedown", (e) => {
    dibujo = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY)
});

canvas.addEventListener("mousemove", (e) => {
    if (!dibujo) return;

    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.strokeStyle = "black";

    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
});

canvas.addEventListener("mouseup", () => {
    dibujo = false;
});

canvas.addEventListener("mouseleave", () => {
    dibujo = false;
});