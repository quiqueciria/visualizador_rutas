# Visualizador de rutas GPX

Map Route es una aplicación web para visualizar rutas GPX sobre un mapa interactivo. Muestra las rutas en el mapa y permite consultar sus datos básicos y cambiar la vista de la cartografía. Está pensada para publicarse como una web estática de forma ligera.

<img height="411" alt="imagen" src="https://github.com/user-attachments/assets/41882673-7317-4460-a1b3-3a4cbcf02f2e" />



## Funcionalidades

- Carga las rutas GPX indicadas en `gpx/routes.json`.
- Dibuja cada ruta con un color distinto.
- Mustra la distancia y, cuando el GPX incluye elevaciones, el desnivel positivo acumulado.
- Permite centrar el mapa en una ruta, mostrarla u ocultarla y ajustar la vista a las rutas cargadas.
- Permite ordenar la lista por distancia o desnivel.
- Incluye cartografía base del IGN y OpenStreetMap, además de un filtro para ver el mapa en color o en blanco y negro.
- Ofrece un modal de información por ruta, cuyo contenido se puede personalizar con HTML.
- Adapta la interfaz a pantallas móviles (BETA).

## Cómo está hecha

El proyecto es una aplicación de frontend sin backend ni proceso de compilación. Está implementada con HTML, CSS y JavaScript, y utiliza la [API-IDEE](https://github.com/Desarrollos-IDEE/API-IDEE) para construir el visualizador. Tailwind CSS se carga desde CDN.

## Ejecución

Clona o descarga el repositorio y sirve la carpeta como un sitio web estático. Por ejemplo, si tienes Python instalado:

```bash
python3 -m http.server 8000
```

Abre <http://localhost:8000> en el navegador de forma local. También puedes publicar los archivos del proyecto en un servicio de alojamiento de webs estáticas.

Es necesario utilizar un servidor HTTP —local o remoto— porque el visor obtiene `gpx/routes.json` y los archivos GPX mediante `fetch`. Abrir `index.html` directamente como un archivo local puede impedir que se carguen las rutas.

## Añadir o quitar rutas

1. Copia el archivo `.gpx` en la carpeta `gpx/`.
2. Añade su nombre, respetando mayúsculas, minúsculas y extensión, a la lista de `gpx/routes.json`.
3. Vuelve a cargar el visor.

Por ejemplo:

```json
[
  "route.gpx",
  "route_2.gpx"
]
```

El nombre que aparece en el visor se obtiene del nombre de la ruta o del track dentro del GPX. Si el archivo no incluye ninguno, se utiliza su nombre de archivo.

## Información personalizada para cada ruta

Para mostrar una descripción, imágenes u otro HTML, añade un elemento `<template>` en `index.html`. El atributo `data-route-info` debe coincidir exactamente con el nombre del archivo GPX:

```html
<template data-route-info="route.gpx">
  <p>Descripción de la ruta.</p>
  <img src="assets/img/imagen-ruta.jpg" alt="Paisaje del recorrido">
</template>
```

El contenido se muestra al pulsar el icono de info de esa ruta. Las imágenes se ajustan al ancho del modal. Si no se ha definido una plantilla, el modal indica cómo añadirla.

## Estructura del proyecto

```text
.
├── index.html          # Estructura de la aplicación y configuración del mapa
├── assets/
│   ├── css/styles.css  # Estilos y adaptación a móviles
│   ├── img/            # Imágenes de la interfaz y contenido
│   ├── js/scripts.js   # Carga de GPX, cálculos y controles
│   └── themes/         # Configuración de temas
└── gpx/
    ├── routes.json     # Lista de archivos GPX que se mostrarán
    └── *.gpx            # Tracks y rutas
```

## Cartografía y atribuciones

El mapa y las capas utilizan la [API-IDEE](https://plataforma.idee.es/idee-api) y servicios cartográficos del [Instituto Geográfico Nacional](https://www.ign.es/web/ign/portal), así como teselas de [OpenStreetMap](https://www.openstreetmap.org/). Su carga depende de la disponibilidad de esos servicios y de una conexión a Internet. Al publicar o redistribuir el visor, conserva las atribuciones que muestran los proveedores y consulta las condiciones de uso aplicables a cada servicio.
