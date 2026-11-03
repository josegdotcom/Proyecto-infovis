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

## Prueba interactiva (Etapa 2)

En `exploracion/prueba_1.html` hay una pizarra: se dibuja un gato o un perro, se indica qué se dibujó y, al terminar, la CNN y la MLP intentan adivinarlo. La etiqueta solo sirve para saber si acertaron. Con al menos 5 dibujos se puede ver el rendimiento general (accuracy, precisión, recall y F1).

Antes de enviarlo, el dibujo se recorta a su contorno y se centra en 28 × 28 píxeles, igual que las imágenes de Quick, Draw! con que se entrenaron los modelos.

La Prueba 2 (actividades) aún no tiene versión interactiva.

## Estructura del repositorio

```
index.html                  Página principal: explicación de modelos y comparación
css/
  style.css                 Estilos compartidos (secciones numeradas al inicio)
  comparacion.css           Gráfico de comparación
js/
  modelos_audio.js          Sonificación con Tone.js
  dibujos.js                Pizarra de la Prueba 1 y conexión con la API
exploracion/
  comparacion.js            Gráfico de comparación y controles de audio
  comparacion.html          Vista independiente de la comparación
  index.html, galeria.js    Galería de exploración de diseño (19 gráficos)
  datos.js                  Resultados exportados (generado, no editar)
  pruebas.html              Selector de pruebas interactivas
  prueba_1.html             Pizarra: gato o perro
  prueba_2.html             Pendiente
api/
  main.py                   Servidor local: archivos estáticos + endpoints de predicción
  models/base_predictor.py  Clase base de los predictores (evaluación y métricas)
  services/test_1.py        Predictor de la Prueba 1 (CNN y MLP)
  services/test_2.py        Predictor de la Prueba 2 (pendiente)
  probar_predictor.py       Prueba rápida del predictor sin servidor
data/
  Proceso_1/2.ipynb         Preparación de los datos de cada prueba
  Prueba_1/2.ipynb          Entrenamiento y evaluación de los modelos
  exportar_galeria.py       Genera exploracion/datos.js a partir de los resultados
  datos/                    Datasets (.npz)
  modelos/                  Modelos entrenados (.keras, .joblib)
  resultados/               Métricas y resultados individuales
assets/                     Ícono y pictogramas SVG
```

## Ejecutar localmente

No hay paso de compilación ni dependencias de npm.

**Solo las visualizaciones** (página principal y galería): cualquier servidor estático, desde la raíz del repositorio:

```bash
python -m http.server 8000
```

**Con la prueba interactiva:** se necesita la API, que también sirve los archivos estáticos. Requiere `numpy`, `scikit-learn` y `joblib`; TensorFlow es opcional (sin él, la CNN se ejecuta con NumPy). Desde la raíz:

```bash
python -m api.main          # puerto 8000; la carga de modelos tarda alrededor de un minuto
```

Abrir `http://localhost:8000/exploracion/prueba_1.html`. La página también funciona abierta desde otro servidor (por ejemplo Live Server) mientras la API esté corriendo en el puerto 8000.

Endpoints (etiquetas: 0 = gato, 1 = perro):

| Ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/test_1/predecir` | `{"imagen": [784 valores 0-255], "etiqueta": 0}` | Predicción y confianza de cada modelo |
| `POST /api/test_1` | `{"imagenes": [[...], ...], "etiquetas": [...]}` (mínimo 5) | Predicciones y métricas de cada modelo |

Para probar los modelos sin servidor: `python -m api.probar_predictor`.

Para regenerar `exploracion/datos.js` tras volver a entrenar: `cd data && python exportar_galeria.py`.

## Publicar en GitHub Pages

El sitio utiliza rutas relativas y puede publicarse bajo `/Proyecto-infovis/`. Subir los cambios en una rama, revisarlos mediante un Pull Request e integrarlos en la rama configurada en **Settings → Pages**, con la carpeta raíz como origen. Las visualizaciones no requieren claves ni un backend; la prueba interactiva sí necesita la API local, que GitHub Pages no puede ejecutar.

## Fuentes

- [Quick, Draw!](https://quickdraw.withgoogle.com/data): dibujos de gatos y perros.
- [Human Activity Recognition Using Smartphones](https://archive.ics.uci.edu/dataset/240/human+activity+recognition+using+smartphones): registros de sensores y actividades.
