Visualizador cartográfico de rutas en bicicleta

### Información personalizada de cada ruta

Cada ruta tiene un botón de información. Para mostrar contenido en su modal, añade un elemento `<template>` en `index.html` usando como `data-route-info` el nombre exacto del archivo GPX:

```html
<template data-route-info="A_Yebes.gpx">
  <p>Texto descriptivo de la ruta.</p>
  <img src="assets/img/imagen-ruta.jpg" alt="Descripción de la imagen">
</template>
```

Dentro del elemento puedes incluir texto, imágenes y otro HTML. Las imágenes se ajustan al ancho del modal. Si no existe una plantilla para una ruta, el modal indica cómo añadirla.