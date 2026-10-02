
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

      const mapFilterText = document.getElementById('mapFilterText');
      const mapFilterToggle = document.getElementById('mapFilterToggle');

      const switchOffIcon = `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="7" ry="7" class="text-slate-300 fill-slate-100" /><circle cx="8" cy="12" r="3" class="fill-white stroke-slate-400" /></svg>`;
      const switchOnIcon = `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="7" ry="7" class="text-sky-600 fill-sky-600" /><circle cx="16" cy="12" r="3" class="fill-white stroke-white" /></svg>`;

      function updateMapFilterUI() {
        mapFilter.setAttribute('aria-pressed', String(grayscaleMap));
        if (mapFilterText) {
          mapFilterText.textContent = grayscaleMap ? 'Mapa en blanco y negro' : 'Mapa en color';
        }
        if (mapFilterToggle) {
          mapFilterToggle.innerHTML = grayscaleMap ? switchOnIcon : switchOffIcon;
        }
        if (grayscaleMap) {
          mapFilter.className = 'map-filter w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-lg shadow-sm transition-all mb-3 cursor-pointer';
        } else {
          mapFilter.className = 'map-filter w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-all mb-3 cursor-pointer';
        }
      }

      // Alterna el filtro de las capas de fondo sin afectar a las rutas.
      mapFilter.addEventListener('click', () => {
        grayscaleMap = !grayscaleMap;
        updateMapFilterUI();
        configureMapFilter();
        const mapImpl = map.impl_ && map.impl_.map_;
        if (mapImpl && typeof mapImpl.render === 'function') mapImpl.render();
      });

      // ================================================================
      // 9. RENDERIZADO Y CONTROLES DE LA LISTA DE RUTAS
      // ================================================================
      // Dibuja en el panel lateral el listado de rutas cargadas con estilos Tailwind
      function renderList() {
        routeList.innerHTML = '';

        if (!routes.size) {
          const empty = document.createElement('div');
          empty.className = 'empty p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300 mt-2';
          empty.textContent = 'No hay rutas cargadas.';
          routeList.appendChild(empty);
          return;
        }

        const eyeOpenIcon = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
        const eyeClosedIcon = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;

        routes.forEach(route => {
          const div = document.createElement('div');
          div.className = `route-item group relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 p-3 mb-2.5 ${!route.visible ? 'opacity-50' : ''}`;

          div.innerHTML = `
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-3 h-3 rounded-full shrink-0 shadow-sm" style="background-color: ${route.color};"></span>
              <span class="text-sm font-semibold text-slate-800 truncate" title="${route.name}">${route.name}</span>
            </div>

            <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <div class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded-md">
                <svg class="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>${route.stats.distanceKm.toFixed(2)} km</span>
              </div>

              <div class="flex items-center gap-1">
                <button type="button" class="zoom-btn inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-sky-100 hover:text-sky-800 rounded-md transition-colors" title="Centrar mapa en la ruta">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7"></circle>
                    <line x1="21" y1="21" x2="16" y2="16" stroke-linecap="round"></line>
                  </svg>
                  <span>Ir a</span>
                </button>
                <button type="button" class="vis-btn inline-flex items-center justify-center p-1 ${route.visible ? 'text-sky-700 hover:text-sky-900 hover:bg-sky-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'} rounded-md transition-colors" title="${route.visible ? 'Ocultar ruta en el mapa' : 'Mostrar ruta en el mapa'}">
                  ${route.visible ? eyeOpenIcon : eyeClosedIcon}
                </button>
                <button type="button" class="del-btn inline-flex items-center justify-center p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Eliminar ruta">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          `;

          const visBtn = div.querySelector('.vis-btn');
          visBtn.addEventListener('click', () => {
            route.visible = !route.visible;
            route.layer.setVisible(route.visible);
            visBtn.innerHTML = route.visible ? eyeOpenIcon : eyeClosedIcon;
            visBtn.title = route.visible ? 'Ocultar ruta en el mapa' : 'Mostrar ruta en el mapa';
            visBtn.className = `vis-btn inline-flex items-center justify-center p-1 ${route.visible ? 'text-sky-700 hover:text-sky-900 hover:bg-sky-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'} rounded-md transition-colors`;
            div.classList.toggle('opacity-50', !route.visible);
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
              routeList.innerHTML = '<div class="empty p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300 mt-2">No hay rutas GPX en la carpeta gpx/.</div>';
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
                routeList.innerHTML = '<div class="empty p-4 text-center text-xs text-red-600 bg-red-50 rounded-xl border border-red-200 mt-2">No se pudieron cargar las rutas GPX.</div>';
              });
          })
          .catch(error => {
            console.error(error);
            routeList.innerHTML = '<div class="empty p-4 text-center text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200 mt-2">No se encontró el archivo routes.json.</div>';
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