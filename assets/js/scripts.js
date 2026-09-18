
    (function () {
      // ================================================================
      // 1. CONFIGURACION Y ESTADO DE LA APLICACION
      // ================================================================
      // Paleta de colores para cada nueva ruta
      const PALETTE = ['#e8542b', '#3b9c4b', '#3b82c4', '#c94f9e', '#e0a72b', '#4fb8a8', '#8b5fbf', '#c4443b'];
      // Colección de rutas guardadas
      const routes = new Map();
      // Contador de rutas para generar ids
      let routeCounter = 0;
      // Instancia del mapa
      let map;
      let grayscaleMap = false;
      const ROUTE_LAYER_Z_INDEX = 1000;

      // ================================================================
      // 2. INICIALIZACION DEL MAPA
      // ================================================================
      function initMap() {
        map = window.mapjs || IDEE.map({
          container: 'mapjs',
          center: [-412305.13, 4926696.67], // Madrid en EPSG:3857
          zoom: 6,
        });
      }

      // ================================================================
      // 3. FILTRO VISUAL DE LAS CAPAS BASE
      // ================================================================
      // Filtra solo las capas de fondo; las rutas se dibujan después con sus colores.
      function configureLayerFilter(layer) {
        if (layer.getZIndex() >= ROUTE_LAYER_Z_INDEX || layer.__mapFilterConfigured) return;

        layer.on('prerender', event => {
          if (grayscaleMap && layer.getZIndex() < ROUTE_LAYER_Z_INDEX && event.context) {
            event.context.filter = 'grayscale(1)';
          }
        });
        layer.on('postrender', event => {
          if (event.context) event.context.filter = 'none';
        });
        layer.__mapFilterConfigured = true;
      }

      function configureMapFilter() {
        const mapImpl = map.impl_ && map.impl_.map_;
        const layerCollection = mapImpl && mapImpl.getLayers ? mapImpl.getLayers() : null;
        if (!layerCollection) return;

        layerCollection.getArray().forEach(configureLayerFilter);
        if (!layerCollection.__mapFilterListenerConfigured) {
          layerCollection.on('add', event => configureLayerFilter(event.element));
          layerCollection.__mapFilterListenerConfigured = true;
        }
      }

      // ================================================================
      // 4. LECTURA Y PARSEO DE ARCHIVOS GPX
      // ================================================================
      // Parseo del archivo GPX para extraer tramos y puntos
      function parseGPX(text, fallbackName) {
        const xml = new DOMParser().parseFromString(text, 'application/xml');
        const segments = [];

        xml.querySelectorAll('trk').forEach(trk => {
          trk.querySelectorAll('trkseg').forEach(seg => {
            const pts = Array.from(seg.querySelectorAll('trkpt')).map(readPt).filter(Boolean);
            if (pts.length > 1) segments.push(pts);
          });
        });

        if (!segments.length) {
          xml.querySelectorAll('rte').forEach(rte => {
            const pts = Array.from(rte.querySelectorAll('rtept')).map(readPt).filter(Boolean);
            if (pts.length > 1) segments.push(pts);
          });
        }

        if (!segments.length) return null;

        const nameEl = xml.querySelector('trk > name') || xml.querySelector('metadata > name');
        const name = (nameEl && nameEl.textContent.trim()) || fallbackName;

        return { name, segments };
      }

      // Lectura de un punto GPX con latitud y longitud
      function readPt(pt) {
        const lat = parseFloat(pt.getAttribute('lat'));
        const lon = parseFloat(pt.getAttribute('lon'));
        if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
        return { lat, lon };
      }

      // ================================================================
      // 5. CALCULOS GEOGRAFICOS Y ESTADISTICAS
      // ================================================================
      // Distancia entre dos puntos para calcular kilometraje
      function haversine(a, b) {
        const R = 6371000;
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(b.lat - a.lat);
        const dLon = toRad(b.lon - a.lon);
        const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(s));
      }

      // Estadísticas de cada ruta: distancia y bounding box
      function computeStats(segments) {
        let distM = 0;
        let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

        segments.forEach(seg => {
          for (let i = 0; i < seg.length; i++) {
            const p = seg[i];
            minLon = Math.min(minLon, p.lon);
            maxLon = Math.max(maxLon, p.lon);
            minLat = Math.min(minLat, p.lat);
            maxLat = Math.max(maxLat, p.lat);

            if (i > 0) distM += haversine(seg[i - 1], p);
          }
        });

        return { distanceKm: distM / 1000, bbox: [minLon, minLat, maxLon, maxLat] };
      }

      // ================================================================
      // 6. CONVERSION A GEOJSON Y CREACION DE CAPAS
      // ================================================================
      // Conversión de los puntos GPX a GeoJSON para la capa de rutas
      function segmentsToGeoJSON(segments) {
        const geometry = segments.length > 1
          ? { type: 'MultiLineString', coordinates: segments.map(seg => seg.map(p => [p.lon, p.lat])) }
          : { type: 'LineString', coordinates: segments[0].map(p => [p.lon, p.lat]) };

        return {
          type: 'FeatureCollection',
          crs: { type: 'name', properties: { name: 'EPSG:4326' } },
          features: [{ type: 'Feature', properties: {}, geometry }]
        };
      }

      // Añade la capa de ruta al mapa basado en GeoJSON
      function addRouteLayer(route) {
        const geojson = segmentsToGeoJSON(route.segments);
        const style = new IDEE.style.Line({ stroke: { color: route.color, width: 4 } });
        const layer = new IDEE.layer.GeoJSON({ name: route.id, legend: route.name, source: geojson }, { style: style, displayInLayerSwitcher: false });
        map.addLayers(layer);
        if (layer.impl_ && layer.impl_.olLayer && typeof layer.impl_.olLayer.setZIndex === 'function') {
          layer.impl_.olLayer.setZIndex(1000);
        }
        route.layer = layer;
      }

      // ================================================================
      // 7. NAVEGACION Y AJUSTE DE LA VISTA
      // ================================================================
      // Ajusta el mapa al recuadro del bbox de una ruta
      function zoomToBbox(bbox, pad) {
        let [minLon, minLat, maxLon, maxLat] = bbox;
        const w = Math.max(maxLon - minLon, 0.0008);
        const h = Math.max(maxLat - minLat, 0.0008);
        const p = pad != null ? pad : 0.15;

        minLon -= w * p;
        maxLon += w * p;
        minLat -= h * p;
        maxLat += h * p;

        const geographicBbox = [minLon, minLat, maxLon, maxLat];
        const mapProjection = typeof map.getProjection === 'function' ? map.getProjection() : null;
        const projectionCode = typeof mapProjection === 'string'
          ? mapProjection
          : mapProjection && typeof mapProjection.getCode === 'function'
            ? mapProjection.getCode()
            : mapProjection && mapProjection.code;
        const targetProjection = projectionCode || 'EPSG:3857';
        const mapBbox = window.ol && ol.proj && targetProjection !== 'EPSG:4326'
          ? ol.proj.transformExtent(geographicBbox, 'EPSG:4326', targetProjection)
          : geographicBbox;

        if (typeof map.updateSize === 'function') map.updateSize();

        const mapImpl = map.impl_ && map.impl_.map_
          ? map.impl_.map_
          : typeof map.getMapImpl === 'function' ? map.getMapImpl() : null;
        const view = mapImpl && typeof mapImpl.getView === 'function' ? mapImpl.getView() : null;

        if (view && typeof view.fit === 'function') {
          view.fit(mapBbox, { padding: [40, 40, 40, 40], duration: 400 });
        } else if (typeof map.setBbox === 'function') {
          map.setBbox(geographicBbox);
        }
      }

      // ================================================================
      // 8. REFERENCIAS HTML Y SELECTOR DEL FILTRO
      // ================================================================
      // Elemento DOM donde se dibuja la lista de rutas
      const routeList = document.getElementById('routeList');
      const mapFilter = document.getElementById('mapFilter');

      // Cambia el filtro de las capas de fondo sin afectar a las rutas.
      mapFilter.addEventListener('change', event => {
        grayscaleMap = event.target.value === 'grayscale';
        configureMapFilter();
        const mapImpl = map.impl_ && map.impl_.map_;
        if (mapImpl && typeof mapImpl.render === 'function') mapImpl.render();
      });

      // ================================================================
      // 9. RENDERIZADO Y CONTROLES DE LA LISTA DE RUTAS
      // ================================================================
      // Dibuja en el panel lateral el listado de rutas cargadas
      function renderList() {
        routeList.innerHTML = '';

        if (!routes.size) {
          const empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = 'No hay rutas cargadas.';
          routeList.appendChild(empty);
          return;
        }

        routes.forEach(route => {
          const div = document.createElement('div');
          div.className = 'route-item';
          div.innerHTML = `
            <div class="route-head">
              <input type="checkbox" ${route.visible ? 'checked' : ''}>
              <span style="color:${route.color};">●</span>
              <span>${route.name}</span>
            </div>
            <div class="route-dist">${route.stats.distanceKm.toFixed(2)} km</div>
            <div class="route-actions">
              <button class="zoom-btn">Ir a</button>
              <button class="del-btn">Eliminar</button>
            </div>
          `;

          div.querySelector('input').addEventListener('change', e => {
            route.visible = e.target.checked;
            route.layer.setVisible(route.visible);
          });

          div.querySelector('.zoom-btn').addEventListener('click', () => zoomToBbox(route.stats.bbox, 0.25));
          div.querySelector('.del-btn').addEventListener('click', () => {
            map.removeLayers(route.layer);
            routes.delete(route.id);
            renderList();
          });

          routeList.appendChild(div);
        });
      }

      // ================================================================
      // 10. BOTON PARA MOSTRAR TODAS LAS RUTAS
      // ================================================================
      // Botón para ajustar mapa a todas las rutas visibles
      document.getElementById('fitAllBtn').addEventListener('click', () => {
        if (!routes.size) return;

        let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
        routes.forEach(r => {
          const [a, b, c, d] = r.stats.bbox;
          minLon = Math.min(minLon, a);
          minLat = Math.min(minLat, b);
          maxLon = Math.max(maxLon, c);
          maxLat = Math.max(maxLat, d);
        });

        zoomToBbox([minLon, minLat, maxLon, maxLat], 0.12);
      });

      // ================================================================
      // 11. COMPORTAMIENTO DEL MENU MOVIL
      // ================================================================
      // Botón hamburguesa para abrir/cerrar el sidebar en móvil
      const sidebarToggle = document.getElementById('sidebarToggle');
      const sidebar = document.getElementById('sidebar');

      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });

      // ================================================================
      // 12. CARGA AUTOMATICA DE RUTAS DESDE ARCHIVOS
      // ================================================================
      // Carga automática de archivos GPX desde el JSON estático de la carpeta gpx/
      function loadRoutesFromFolder(folderUrl) {
        fetch('gpx/routes.json')
          .then(response => {
            if (!response.ok) {
              throw new Error('No se puede acceder al archivo routes.json.');
            }
            return response.json();
          })
          .then(gpxFiles => {
            if (!Array.isArray(gpxFiles) || !gpxFiles.length) {
              routeList.innerHTML = '<div class="empty">No hay rutas GPX en la carpeta gpx/.</div>';
              return;
            }

            const requests = gpxFiles.map(file => {
              const fileUrl = folderUrl + file;
              return fetch(fileUrl).then(res => {
                if (!res.ok) {
                  throw new Error('No se pudo cargar ' + fileUrl);
                }
                return res.text();
              });
            });

            Promise.all(requests)
              .then(texts => {
                texts.forEach((text, index) => {
                  const filename = gpxFiles[index] || 'ruta.gpx';
                  const parsed = parseGPX(text, filename.replace(/\.gpx$/i, ''));
                  if (!parsed) return;

                  const id = 'route-' + (++routeCounter);
                  const route = {
                    id,
                    name: parsed.name,
                    color: PALETTE[(routeCounter - 1) % PALETTE.length],
                    segments: parsed.segments,
                    stats: computeStats(parsed.segments),
                    visible: true,
                    layer: null,
                  };

                  routes.set(id, route);
                  addRouteLayer(route);
                });

                renderList();
              })
              .catch(error => {
                console.error(error);
                routeList.innerHTML = '<div class="empty">No se pudieron cargar las rutas GPX.</div>';
              });
          })
          .catch(error => {
            console.error(error);
            routeList.innerHTML = '<div class="empty">No se encontró el archivo routes.json.</div>';
          });
      }

      // ================================================================
      // 13. ARRANQUE DE LA APLICACION
      // ================================================================
      // Inicio de la aplicación: mapa + carga de rutas desde el JSON estático
      window.addEventListener('load', function () {
        initMap();
        configureMapFilter();
        loadRoutesFromFolder('gpx/');
      });
    })();