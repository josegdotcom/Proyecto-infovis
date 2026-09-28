# Proyecto Infovis

## Grupo 11

## Integrantes

* **Jose Garcia** — `josegdotcom`
* **Daniel Rojas🗣️** — `DaniFantasy`
* **Sergio Hernández** — `SergioHdezDC`
* **Edgardo Jara** — `Fe412Dr`

coloquen sus nombres >:(

---

## Descripcion

Este proyecto consiste en el desarrollo de una página web orientada a la **visualización interactiva de datos**.

La aplicación permite representar información mediante distintos tipos de gráficos, facilitando su exploración y comprensión a través de representaciones visuales.

El proyecto está desarrollado como una aplicación web estática, utilizando:

* **HTML** para la estructura de la página.
* **CSS** para la presentación y estilos.
* **JavaScript** para la lógica y generación de los gráficos.
* **Chart.js** para la visualización de datos.
* **JSON** como formato de datos utilizado por la aplicación.
* **GitHub Pages** para publicar la página web.

---

## Pagina del proyecto

La página se encuentra publicada mediante GitHub Pages:

**[Visitar página del proyecto](https://josegdotcom.github.io/Proyecto-infovis/)**

---

## Estructura del proyecto

La estructura principal del proyecto es la siguiente:

```text
Proyecto-infovis/
│
├── index.html
├── README.md
│
├── css/
│   └── style.css
│
├── js/
│   └── main.js
│
├── assets/
│   └── icons/
│       └── logo.png
│
└── data/
    └── datos/
        ├── historico_mesas_operativas_2026-09-08_1002.xlsx
        └── especies.json
```

### `index.html`

Archivo principal de la aplicación. Contiene la estructura HTML de la página y carga los recursos necesarios para su funcionamiento.

### `css/`

Contiene las hojas de estilo utilizadas para definir la apariencia de la página.

### `js/`

Contiene el código JavaScript de la aplicación.

Actualmente, `main.js` se encarga de cargar los datos y generar los gráficos mediante Chart.js.

### `assets/`

Contiene recursos utilizados por la interfaz, como imágenes e iconos.

### `data/`

Contiene los archivos relacionados con los datos utilizados por la aplicación.

El archivo Excel corresponde a la fuente de datos original, mientras que los archivos JSON contienen los datos preparados para ser utilizados directamente por JavaScript.

---

## Flujo a seguir

```text
Archivo Excel
     │
     ▼
Preparación de datos
     │
     ▼
especies.json
     │
     ▼
main.js
     │
     ▼
Chart.js
     │
     ▼
Gráfico
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

### Implementado

* [x] Estructura inicial del proyecto.
* [x] Página HTML principal.
* [x] Integración de Chart.js.
* [x] Carga de datos mediante JSON.
* [x] Conversión de datos de especies desde el archivo Excel.
* [x] Gráfico de barras por especie.
* [x] Publicación mediante GitHub Pages.
* [x] Icono de la página mediante `logo.png`.

### Pendiente

* [ ] Definir las visualizaciones finales.
* [ ] Incorporar nuevos gráficos.
* [ ] Implementar interactividad.
* [ ] Incorporar funcionalidades de audio.
* [ ] Diseñar la interfaz definitiva.
* [ ] Incorporar filtros y controles.
* [ ] Realizar pruebas finales de visualización.
* [ ] Completar la documentación del proyecto.
