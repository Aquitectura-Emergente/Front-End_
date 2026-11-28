import { Pipe, PipeTransform } from '@angular/core';

/**
 * Unidad como se lee, a partir de como la guarda el backend: `uT` → `µT`,
 * `uT*s` → `µT·s`. El backend escribe ASCII por compatibilidad; la pantalla no
 * tiene por qué.
 */
export function displayUnit(unit: string | null | undefined): string {
  if (!unit) return '';
  return unit.replace(/\buT\b|uT(?=\*|\/|·|$)/g, 'µT').replace(/\*/g, '·');
}

@Pipe({ name: 'unit' })
export class UnitPipe implements PipeTransform {
  transform(unit: string | null | undefined): string {
    return displayUnit(unit);
  }
}
