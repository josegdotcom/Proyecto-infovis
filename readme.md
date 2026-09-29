# Proyecto Infovis

## Grupo 11

## Integrantes

* **Jose Garcia** — `josegdotcom`
* **Daniel Rojas🗣️** — `DaniFantasy`
* **Sergio Hernández** — `SergioHdezDC`
* **Edgardo Jara** — `Fe412Dr`


---

## Descripcion

Visualización interactiva y sonora (Entrega 1 del curso IIC2026) que compara cuatro modelos de machine learning
en una tarea simple: **distinguir un dibujo de un gato de uno de un perro** (dataset
[Quick, Draw!](https://github.com/googlecreativelab/quickdraw-dataset) de Google).

**Mensaje:** la red neuronal MLP alcanza la misma precisión que la SVM (84%) entrenando 100 veces más rápido,
mientras que el clustering no supervisado (HDBSCAN) queda por debajo del azar.

### Visualización

1. **Overview:** dispersión de precisión vs. tiempo de entrenamiento (escala logarítmica), con la línea del azar (50%).
2. **Aplausómetro:** al hacer click en un modelo, el público lo evalúa con sonido.
3. **Detalle:** grilla con 10 dibujos que ningún modelo vio, con la predicción de cada modelo. Filtro "solo errores".

### Sonificación (aplausómetro)

| Dato | Parámetro sonoro |
|---|---|
| Tiempo de entrenamiento | Duración del redoble de tambor antes del veredicto (ritmo) |
| Precisión sobre el azar | Cantidad de personas aplaudiendo y duración del aplauso (densidad/ritmo) |
| Precisión | Altura de la nota de la aguja, de Do3 (0%) a Do6 (100%) (tono) |
| Precisión alta | Se suman silbidos de celebración (timbre) |
| Precisión bajo el azar | Grillos y trombón triste en vez de aplausos (timbre, icono auditivo) |
| Predicción individual | Earcons: dos aplausos (acierto), bocina (error), grillos (ruido/sin clase) |

### Tecnologías

* **HTML / CSS / JavaScript** (página estática en GitHub Pages).
* **Plotly.js** para el gráfico de dispersión.
* **Tone.js** y Web Audio API para sintetizar los sonidos (no se usan archivos de audio).
* **Python** (scikit-learn, hdbscan, numpy, pandas) para entrenar los modelos.

---

## Pagina del proyecto

La página se encuentra publicada mediante GitHub Pages:

**[Visitar página del proyecto](https://josegdotcom.github.io/Proyecto-infovis/)**

---

## Estructura del proyecto

```text
Proyecto-infovis/
├── index.html
├── css/style.css
├── js/
│   ├── main.js            # Carga de datos, gráfico, aplausómetro visual y grilla
│   └── aplausometro.js    # Motor de sonido (Tone.js)
├── assets/icons/logo.png
└── data/
    ├── prueba_1.ipynb     # Entrenamiento y evaluación de los modelos
    ├── exportar_web.py    # Exporta los 10 dibujos y sus etiquetas reales a JSON
    ├── datos/
    │   ├── gatos_perros_dataset.npz
    │   └── info-biblio.txt
    └── resultados/
        ├── resultados_globales.csv
        ├── experimento_individual_resultados.csv
        ├── experimento_individual_imagenes.npz
        └── dibujos.json
```

## Flujo de datos

```text
Quick, Draw! (.npy) → prueba_1.ipynb → resultados/*.csv + imagenes.npz
                                      → exportar_web.py → dibujos.json
                                      → main.js → Plotly.js + Tone.js
```

Para regenerar los datos de la web, ejecutar el notebook y luego, desde `data/`:

```bash
python exportar_web.py
```

---

## Ejecucion

El proyecto está diseñado para funcionar como una página web estática.

La página publicada puede accederse directamente desde GitHub Pages.

Para trabajar localmente, también es posible abrir `index.html` directamente en el navegador para visualizar la estructura de la página.

En ese caso, se recomienda utilizar un servidor HTTP local durante el desarrollo.

Por ejemplo, utilizando Python:

```bash
python -m http.server 8000
```

Luego se puede acceder a:

```text
http://localhost:8000
```

---

### Importante

**Evitar realizar cambios directamente sobre `main` cuando sea posible. Utilizen branchs**

Antes de comenzar a trabajar:

```bash
git pull
```

Crear una rama para la modificación:

```bash
git checkout -b feature/nombre-de-la-funcionalidad
```

Después de realizar los cambios:

```bash
git add .
git commit -m "Descripcion de los cambios"
git push -u origin feature/nombre-de-la-funcionalidad
```

Posteriormente, la rama puede integrarse a `main` mediante un Pull Request.

```text
main
 │
 ├── feature/graficos
 │
 ├── feature/diseno
 │
 ├── feature/datos
 │
 └── feature/audio
```

---

## Estado actual

### V1 implementado

* [x] Gráfico de dispersión precisión vs. tiempo de entrenamiento con línea de azar.
* [x] Aplausómetro visual (medidor) y sonoro.
* [x] Botón "Competencia de aplausos" que recorre los cuatro modelos.
* [x] Grilla de 10 dibujos con predicciones, tooltip y filtro de errores.
* [x] Tabla de datos accesible y modo claro/oscuro.

### Pendiente

* [ ] Definir las visualizaciones finales.
* [ ] Incorporar nuevos gráficos.
* [ ] Implementar interactividad.
* [ ] Incorporar funcionalidades de audio.
* [ ] Diseñar la interfaz definitiva.
* [ ] Incorporar filtros y controles.
* [ ] Realizar pruebas finales de visualización.
* [ ] Completar la documentación del proyecto.
