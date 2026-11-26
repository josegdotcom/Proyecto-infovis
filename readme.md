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

### Página principal: 3 pasos

La página principal (`index.html`), «¿Qué red adivina mejor?», usa solo la prueba de los dibujos. Mensaje: **la CNN busca formas y la MLP memoriza posiciones**; por eso la CNN sirve para imágenes y la MLP para datos ordenados, como una tabla. Se ve una pantalla a la vez, sin recargar la página, y `#paso-N` en la URL abre directo un paso. Está pensada para la pantalla del computador: cada paso cabe sin desplazamiento (revisado a 1440×900 y 1280×720).

| Paso | Qué muestra | Archivo |
|---|---|---|
| 1 · El truco | Cómo mira cada red (la CNN pasa una lupa buscando partes; la MLP recuerda casillas) y una animación en ciclo: un gato pixelado quieto y luego movido 2 casillas. La lupa de la CNN encuentra las orejas igual; en la MLP se marcan en rojo las casillas que cambiaron y deja de reconocerlo. Abajo, el desafío: que una red adivine y la otra no. | `js/paso_truco.js` |
| 2 · Tus intentos | 5 intentos libres: cada persona elige si dibuja un perro o un gato, y cómo. Gana puntos quien logra que una red acierte y la otra no, es decir, quien mejor entiende cómo mira cada red. Cada intento tiene 3 s de preparación y 10 s para dibujar, con la cuenta sobre la cámara en vivo; al terminar, la foto se toma sola. Luego la pantalla pregunta «¿Qué dibujaste?» (Gato o Perro, con clic o las teclas G y P) y recién ahí muestra lo que dijo cada red y suena su tono de acierto o error. Si en la foto no se ve un dibujo, se repite el intento. | `js/paso_retos.js` |
| 3 · Resultados | Aciertos de la CNN y la MLP en los 2.999 dibujos de test: en el centro, movidos y pequeños en una esquina. «¿Por qué se confunde la MLP?»: la mancha (promedio de los gatos o perros de entrenamiento) con uno de tus dibujos encima y el % de tu dibujo que cae en ella. El ranking (tarjeta con desplazamiento, medallas; el primer lugar es quien mejor entendió cómo funcionan estas redes). *Jugar de nuevo* borra los retos y vuelve al paso 1. | `js/paso_resultados.js` |

- `js/principal.js` tiene lo compartido: `RETOS_TOTAL = 5`, las redes, la conexión con la API, el QR y la navegación. Los estilos están en `css/principal.css`.
- **Celular** (`exploracion/telefono_retos.html`, se abre con el QR): solo la cámara. Se toca una vez al abrirlo (para activar el sonido) y después queda fijo apuntando a la pizarra: cuando termina el tiempo, la pantalla pide la foto (`POST /api/camara/capturar`) y el celular la toma sola. Al abrir un intento, la pantalla lo avisa al servidor (`POST /api/camara/reto`) para que acepte la foto; la etiqueta (Gato o Perro) la da la persona en la pantalla después de la foto. El celular **no recentra el dibujo**: el recuadro completo pasa a 28×28, para que un dibujo pequeño en una esquina llegue así a las redes. El celular va **de costado**: gira la imagen 90° antes de usarla. Si el dibujo se ve girado en la pantalla, toca **↻ Girar imagen** sobre la cámara hasta que se vea derecho (`POST /api/camara/giro`; el navegador lo recuerda).
- **Sonidos** (`js/sonidos.js`): suenan en el celular y en el computador, primero la CNN y luego la MLP. Acierto: dos tonos que suben; error: dos tonos que bajan. Los navegadores solo dejan sonar después del primer clic o toque en cada dispositivo.
- **Ranking:** `GET` y `POST /api/ranking`. Lo comparten todos los visitantes y se guarda en `grabaciones/ranking.json` (ignorada por git). Se entra con los 5 intentos hechos, una vez por partida.
- **Datos del paso 3:** `exploracion/datos_retos.js`, generado con `python data/exportar_retos.py` a partir de los modelos guardados.
- **MLP de los dibujos:** el archivo anterior respondía «Perro» para todos los dibujos. `python data/reentrenar_mlp_dibujos.py` la reentrena con los mismos datos (83 % en test) y la guarda en `data/modelos/test-1_mlp.joblib`. Después, vuelve a correr `data/exportar_retos.py`.

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
