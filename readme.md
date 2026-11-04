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
.\instalacion-python.ps1
```

Para crear el entorno de Python con todas sus dependencias y bibliotecas, *se necesita tener Python en la versión 3.10 o superior*.

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

python -m http.server 8000
```

Abrir `http://localhost:8000`. También es posible usar cualquier servidor estático, como Live Server.


## Publicar en GitHub Pages

El sitio utiliza rutas relativas y puede publicarse bajo `/Proyecto-infovis/`. Subir los cambios en una rama, revisarlos mediante un Pull Request e integrarlos en la rama configurada en **Settings → Pages**, con la carpeta raíz como origen. No se requieren claves ni un backend.

## Fuentes

- [Quick, Draw!](https://quickdraw.withgoogle.com/data): dibujos de gatos y perros.
- [Human Activity Recognition Using Smartphones](https://archive.ics.uci.edu/dataset/240/human+activity+recognition+using+smartphones): registros de sensores y actividades.
