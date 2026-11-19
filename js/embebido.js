// Permite que prueba_1.html y prueba_2.html funcionen dentro de la página principal
// (index.html las carga en un <iframe>).
//
// - Si la página está dentro de un iframe, agrega la clase "embebido" a <html>
//   (oculta el botón "Volver", porque la página principal ya tiene las pestañas).
// - window.publicarResultados(prueba, resultados) guarda los resultados de una
//   evaluación y se los envía a la página principal, que los compara con lo
//   esperado (los resultados de la Entrega 1).
(function () {
    const embebido = window.self !== window.top;
    const CLAVE = (prueba) => `infovis:resultados-prueba-${prueba}`;

    function avisar(mensaje) {
        if (!embebido) return;
        try {
            window.parent.postMessage(mensaje, window.location.origin);
        } catch (err) {
            // La página principal no está disponible: no hay nada que avisar.
        }
    }

    window.publicarResultados = function (prueba, resultados) {
        const datos = {
            prueba,
            fecha: Date.now(),
            etiquetas_reales: resultados.etiquetas_reales,
            predicciones: resultados.predicciones,
            metricas: resultados.metricas
        };
        try {
            localStorage.setItem(CLAVE(prueba), JSON.stringify(datos));
        } catch (err) {
            // Sin almacenamiento (modo privado): igual se envía a la página principal.
        }
        avisar({ tipo: "resultados-prueba", datos });
    };

    window.borrarResultados = function (prueba) {
        try {
            localStorage.removeItem(CLAVE(prueba));
        } catch (err) {
            // Nada que borrar.
        }
        avisar({ tipo: "resultados-borrados", prueba });
    };

    if (!embebido) return;

    document.documentElement.classList.add("embebido");
})();
