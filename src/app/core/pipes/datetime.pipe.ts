import { Pipe, PipeTransform } from '@angular/core';

export type DateTimeFormat = 'datetime' | 'date';

const DATE_TIME: Intl.DateTimeFormatOptions = {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
};

const DATE_ONLY: Intl.DateTimeFormatOptions = {
  month: 'short', day: 'numeric', year: 'numeric',
};

/**
 * Fecha legible a partir de lo que manda el backend.
 *
 * ## Por qué existe
 *
 * Los contextos industriales serializan `LocalDateTime`/`Instant` con
 * `toString()`, así que llegan cadenas como `2026-11-12T08:00:00Z` o
 * `2026-11-13T19:35:00.123456`. Varias pantallas las pintaban **en crudo**, con
 * los microsegundos incluidos, y otras tantas tenían su propio `formatDate`
 * copiado. Esto unifica el caso de las que mostraban el ISO tal cual.
 *
 * Tres comportamientos que importan:
 *
 * - **Ausente → `—`.** El backend usa `default-property-inclusion=non_null`, así
 *   que un campo opcional no llega como `null`: **no llega**. Por eso se
 *   comprueba por verdad y no contra `null`.
 * - **Ilegible → el valor crudo.** Es más útil ver el dato original que un
 *   «Invalid Date» que esconde de dónde vino.
 * - **Locale fijo `en-US`**, igual que los `formatDate` que ya existían en el
 *   repo. La interfaz se traduce por `LanguageService`, pero el formato de
 *   fecha no estaba internacionalizado y cambiarlo aquí alteraría pantallas ya
 *   verificadas.
 */
@Pipe({
  name: 'dt',
  standalone: true,
})
export class DateTimePipe implements PipeTransform {

  transform(value: string | Date | null | undefined,
            format: DateTimeFormat = 'datetime'): string {
    if (!value) return '—';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('en-US', format === 'date' ? DATE_ONLY : DATE_TIME);
  }
}
