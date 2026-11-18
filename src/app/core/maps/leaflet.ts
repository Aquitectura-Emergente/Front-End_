import type * as LeafletNamespace from 'leaflet';

type Leaflet = typeof LeafletNamespace;

let iconPathSet = false;

/**
 * Carga Leaflet bajo demanda y deja sus iconos apuntando a un sitio que existe.
 *
 * ## Las dos cosas que resuelve
 *
 * **1 · El `default` del bundle.** En producción Leaflet llega como
 * `{ default: L }` (es CommonJS) y en desarrollo como el propio namespace. Los
 * cuatro sitios que usan el mapa repetían el mismo `mod.default ?? mod`.
 *
 * **2 · La sombra del marcador daba 404.** `leaflet.css` referencia
 * `marker-icon.png` y `layers.png`, así que el bundler las emite con hash en
 * `/media/`. Leaflet deduce de ahí su `imagePath` y pide **`marker-shadow.png`
 * en esa misma carpeta** — pero esa imagen no aparece en el CSS, nunca se
 * empaqueta, y la petición se iba en `404 /media/marker-shadow.png` (tres veces
 * por carga en el detalle de orden del técnico).
 *
 * Por eso `angular.json` copia `node_modules/leaflet/dist/images` a `leaflet/` y
 * aquí se fija `imagePath` a esa ruta. Solo afecta al **marcador por defecto**
 * (`L.marker(...)` sin icono); `map-radiation` usa `divIcon` y nunca tuvo el
 * problema.
 *
 * `imagePath` es global en Leaflet: se fija una sola vez aunque varias páginas
 * perezosas llamen aquí.
 */
export async function loadLeaflet(): Promise<Leaflet> {
  const mod = await import('leaflet');
  const L = ((mod as unknown as { default?: Leaflet }).default ?? mod) as Leaflet;

  if (!iconPathSet) {
    L.Icon.Default.imagePath = 'leaflet/';
    iconPathSet = true;
  }

  return L;
}
