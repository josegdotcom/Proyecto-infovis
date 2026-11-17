// Configuración de Protobject (Physical Viz Toolkit - Cápsulas 32-34 / Entrega 2)
// Conecta el teléfono (sensor_camara.html) con la pantalla principal (prueba_1.html).
//
// Cómo empareja Protobject las páginas:
//   El ID de la página principal se calcula con  ptjuid + origen + esta configuración.
//   Por eso el teléfono SOLO se conecta por WebRTC si abre sensor_camara.html
//     1) con el mismo parámetro ?ptjuid=... que la pantalla principal, y
//     2) desde el mismo origen (protocolo + IP/dominio + puerto).
//   El QR de prueba_1.html ya incluye el ptjuid. Si la pantalla se abrió en
//   http://localhost:8000 el origen no coincide con el del teléfono
//   (https://IP:8443), y la conexión se hace por el puente local de Python
//   (/api/camara/frame y /api/camara/estado), que funciona igual.
//
// No cambies los nombres de página ni el orden sin actualizar ambas páginas:
// cualquier cambio en esta configuración cambia el ID de conexión.
if (typeof Protobject !== "undefined") {
    // Agrega ?ptjuid=<aleatorio> a la URL (recarga la página) si aún no existe,
    // para que cada sesión tenga su propio canal y no choque con otras.
    Protobject.setProduction(true);

    // Si setProduction acaba de redirigir, no inicializar: la página se recargará
    // con el ptjuid y se inicializará entonces (evita registrar un ID inválido).
    if (new URLSearchParams(window.location.search).has("ptjuid")) {
        Protobject.initialize([
            {
                name: "Cámara (Teléfono)",
                page: "sensor_camara.html",
                debug: "local"
            },
            {
                name: "Pantalla Principal",
                page: "prueba_1.html",
                main: true,
                debug: "master"
            }
        ]);
    }
}
