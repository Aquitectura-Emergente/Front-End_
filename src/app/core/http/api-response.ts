import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * Sobre con la que el backend envuelve toda respuesta (`ApiResponse` de Spring).
 * El edge y los clientes desempaquetan `data`; `success` viaja en algunas rutas
 * (p. ej. /auth/login) y se deja opcional para no obligar a declararlo.
 */
export interface ApiResponse<T> {
  success?: boolean;
  data: T;
}

/** Página de Spring Data tal y como la serializa el backend. */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/**
 * Desempaqueta `data` y degrada a `fallback` si la llamada falla.
 *
 * Tragarse el error es deliberado y viene del DataService original: las
 * pantallas se pintan vacías en vez de romperse. El interceptor es quien avisa
 * al usuario de los fallos de red.
 */
export function unwrap<T>(obs: Observable<ApiResponse<T>>, fallback: T): Observable<T> {
  return obs.pipe(
    map(r => r.data),
    catchError(() => of(fallback))
  );
}

/** Variante de `unwrap` para respuestas de un solo recurso, que degradan a null. */
export function unwrapOrNull<T>(obs: Observable<ApiResponse<T>>): Observable<T | null> {
  return obs.pipe(
    map(r => r.data),
    catchError(() => of(null))
  );
}

/** Página vacía usada como fallback de los endpoints paginados. */
export function emptyPage<T>(size = 10): PageResponse<T> {
  return { content: [], page: 0, size, totalElements: 0, totalPages: 0, last: true };
}

/** Serializa los filtros de una query descartando los vacíos. */
export function queryString(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? '?' + parts.join('&') : '';
}
