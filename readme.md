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

### Diseño

- Explicación de ambos modelos con diagramas antes de los resultados.
- CNN en azul y MLP en verde, identificadas también con texto.
- Dos filas: datos de imágenes y datos tabulares, con ilustraciones y contexto.
- Aciertos y entrenamiento en columnas; el mejor resultado de cada par aparece en negrita.
- Escalas lineales compartidas entre pruebas: 0–100 % de aciertos y 0–24 segundos de entrenamiento. Las barras parten de cero.
- Diseño adaptable a escritorio, tablet y teléfono, con controles accesibles por teclado.

| Prueba | CNN: aciertos | MLP: aciertos | CNN: entrenamiento | MLP: entrenamiento |
|---|---:|---:|---:|---:|
| Dibujos | 88 % | 82 % | 21,8 s | 2,1 s |
| Actividades | 92 % | 95 % | 5,5 s | 2,7 s |

Los porcentajes se redondean a enteros y los tiempos a un decimal. Los resultados proceden de `exploracion/datos.js`; el cambio de diseño no modifica los datos experimentales.

Los dibujos de gato y perro son pictogramas ilustrativos. Las imágenes de entrada son de 28 × 28 píxeles. La tabla x/y/z también es ilustrativa: las entradas del modelo contienen 561 características derivadas de acelerómetro y giroscopio, no únicamente tres lecturas crudas. Se muestran cinco actividades como ejemplos; el conjunto de datos incluye además «Parado».

### Sonificación

Los botones «Escuchar» reproducen cada prueba; «Escuchar todo» recorre ambas. También se puede activar una barra con clic, Enter o espacio. Después de activar el audio, pasar el cursor por una barra la reproduce, salvo durante una secuencia.

| Dato | Representación sonora |
|---|---|
| Aciertos | Altura de la nota: más agudo significa más aciertos |
| Entrenamiento | Duración de una serie de pulsos |
| Modelo | Timbre y posición estéreo: CNN a la izquierda, MLP a la derecha |

El audio utiliza Tone.js 15.0.4 desde un CDN y requiere conexión a Internet. La reproducción comienza tras una interacción del usuario.

## Archivos principales

- `index.html`: cabecera, explicación de modelos y contenedor de la comparación.
- `css/style.css`: estilos compartidos y página principal.
- `css/comparacion.css`: tarjetas, barras y adaptación a pantallas pequeñas.
- `exploracion/comparacion.js`: gráficos y controles de audio.
- `exploracion/datos.js`: resultados y ejemplos exportados.
- `js/modelos_audio.js`: síntesis de audio.
- `assets/images/`: pictogramas SVG.
- `exploracion/index.html`: galería de exploración.
- `exploracion/comparacion.html`: vista independiente de la comparación.
- `data/`: notebooks, exportadores y resultados de experimentos.

## Ejecutar localmente

No hay paso de compilación ni dependencias de npm. Desde la raíz del repositorio:

```bash
python -m http.server 8000
```

Abrir `http://localhost:8000`. También es posible usar cualquier servidor estático, como Live Server.

## Publicar en GitHub Pages

El sitio utiliza rutas relativas y puede publicarse bajo `/Proyecto-infovis/`. Subir los cambios en una rama, revisarlos mediante un Pull Request e integrarlos en la rama configurada en **Settings → Pages**, con la carpeta raíz como origen. No se requieren claves ni un backend.

## Fuentes

- [Quick, Draw!](https://quickdraw.withgoogle.com/data): dibujos de gatos y perros.
- [Human Activity Recognition Using Smartphones](https://archive.ics.uci.edu/dataset/240/human+activity+recognition+using+smartphones): registros de sensores y actividades.
