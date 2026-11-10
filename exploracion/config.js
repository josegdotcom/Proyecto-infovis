// Configuración de Protobject (Physical Viz Toolkit - Cápsulas 32-34 / Entrega 2)
// Conecta el teléfono (sensor_camara.html) con la pantalla principal (prueba_1.html)
if (typeof Protobject !== "undefined") {
    Protobject.setProduction(true);
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
