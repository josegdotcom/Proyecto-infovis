# Proyecto Infovis · Grupo 11

## Integrantes

- **Jose Garcia** — `josegdotcom`
- **Daniel Rojas** — `DaniFantasy`
- **Sergio Hernández** — `SergioHdezDC`
- **Edgardo Jara** — `Fe412Dr`

## Comparación de redes neuronales

Visualización interactiva que compara una red convolucional (CNN) y una red densa (MLP) en dos problemas: clasificar dibujos de gatos y perros, y reconocer actividades humanas a partir de sensores de un teléfono.

**Mensaje:** las redes neuronales no son tan universales. La CNN destaca en dibujos; la MLP entrena más rápido en ambas pruebas y obtiene más aciertos en actividades.

[Página publicada](https://josegdotcom.github.io/Proyecto-infovis/)

## Ejecutar localmente

A causa de las modificaciones recientes y la necesidad de utilizar APIs de Python, es necesario configurar el entorno. Saltate estos pasos y ya tienes el entorno virtual.

```bash
# en caso de que la ejecucion de scrips este deshabilitada
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process 

.\instalacion-python.ps1
```

Para crear el entorno de Python con todas sus dependencias y bibliotecas, **se necesita tener Python en la versión 3.10 o superior**.

Para entrar al entorno virtual:
```bash
.\.venv\Scripts\Activate.ps1
```

Para salir del entorno virtual:
```bash
deactivate
```

Una vez dentro del entorno y en la carpeta raiz
```bash
python -m api.main
```

Este único comando levanta la API **y** sirve las páginas (no hace falta `python -m http.server`, y ambos usarían el puerto 8000). Abrir `http://localhost:8000`.

La página principal (`index.html`, `js/principal.js`) está pensada para niños y jóvenes: «¿Qué robot adivina mejor?». La CNN es **Robo-Lupa** y la MLP **Robo-Lista**. Para cada prueba (una debajo de la otra, con las columnas alineadas) muestra «Lo que prometió» (aciertos de la Entrega 1 en 10 casillas, `exploracion/datos.js`), «Lo que logró contigo» (una casilla ✓/✗ por intento, en vivo) y el QR para jugar con el teléfono. Al final, un tablero muestra quién ganó cada prueba.

- **Prueba 1:** en el teléfono elige Gato o Perro y pulsa *Capturar*; cada captura cuenta como un intento (se guardan en el navegador, *Reiniciar* los borra).
- **Prueba 2:** en el teléfono elige la actividad y graba; los intentos los guarda el servidor.

Las pruebas también se pueden abrir solas:

- **Prueba 1 (dibujos):** `http://localhost:8000/exploracion/prueba_1.html`.
- **Cámara del teléfono:** el teléfono debe estar en la misma red WiFi. Escanea el QR de la Prueba 1 y acepta la advertencia del certificado local (*Opciones avanzadas → Continuar*). La cámara necesita HTTPS: el servidor abre el puerto 8443 con un certificado autofirmado creado con `openssl` (viene con Git para Windows).
- **Protobject (WebRTC):** solo empareja páginas del mismo origen y con el mismo `?ptjuid=`. Si la pantalla se abre en `localhost`, el teléfono se conecta por el puente local de Python, que funciona igual. Para usar también WebRTC, abre la pantalla en la dirección `https://<IP>:8443/exploracion/prueba_1.html` que imprime el servidor.
- Si Windows pregunta, permite el acceso de Python a **redes privadas** en el firewall; si no, el teléfono no llegará al servidor.

### Prueba 2 (actividades con el teléfono)

`http://localhost:8000/exploracion/prueba_2.html`

1. Escanea el QR con el teléfono (misma WiFi), acepta el certificado local y toca **Activar sensores**.
2. Elige la actividad (en la pantalla o en el teléfono) y pulsa **Grabar**. Hay 5 s de cuenta regresiva con voz y pitidos para colocar el teléfono **vertical en la cintura, con la pantalla hacia afuera** (así se grabó UCI HAR). Luego graba 10 s.
3. Los modelos clasifican 7 ventanas de 2,56 s y gana la actividad con más votos. Con 5 o más intentos se calculan las métricas.

El pipeline del teléfono (`api/services/sensor_har.py`) replica el preprocesamiento de UCI HAR (50 Hz, filtros, separación de gravedad, 561 características) y usa `data/modelos/har_normalizacion.npz`. Si cambias el pipeline, regenera ese archivo con `python data/calibrar_har.py "ruta/a/UCI HAR Dataset"` (instrucciones dentro del script). Con teléfono simulado a partir de UCI test, la MLP acierta el 92 % de las grabaciones. La CNN siempre responde «Acostado», igual que en el entrenamiento (18 %).

Cada grabación se guarda en `grabaciones/` (ignorada por git). Para reanalizar una: `python api/services/test_2.py grabaciones/<archivo>.csv`.

Las páginas que no usan modelos (`index.html`, la galería) también funcionan con cualquier servidor estático, como Live Server.


## Publicar en GitHub Pages

El sitio utiliza rutas relativas y puede publicarse bajo `/Proyecto-infovis/`. Subir los cambios en una rama, revisarlos mediante un Pull Request e integrarlos en la rama configurada en **Settings → Pages**, con la carpeta raíz como origen. No se requieren claves ni un backend.

## Fuentes

- [Quick, Draw!](https://quickdraw.withgoogle.com/data): dibujos de gatos y perros.
- [Human Activity Recognition Using Smartphones](https://archive.ics.uci.edu/dataset/240/human+activity+recognition+using+smartphones): registros de sensores y actividades.
