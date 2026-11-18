import { DateTimePipe } from './datetime.pipe';

const pipe = new DateTimePipe();

describe('DateTimePipe', () => {

  it('formatea el ISO del backend con fecha y hora', () => {
    // `Instant.toString()` de los contextos industriales: lleva la Z.
    expect(pipe.transform('2026-11-12T08:00:00Z')).toContain('Nov 12, 2026');
  });

  it('descarta los microsegundos de LocalDateTime', () => {
    // Lo que serializa `LocalDateTime.toString()`; pintarlo en crudo mostraba
    // `2026-11-13T19:35:00.123456` dentro de una celda de tabla.
    const out = pipe.transform('2026-11-13T19:35:00.123456');
    expect(out).toContain('Nov 13, 2026');
    expect(out).not.toContain('123456');
  });

  it('con formato date no incluye la hora', () => {
    expect(pipe.transform('2026-11-12T08:00:00Z', 'date')).toBe('Nov 12, 2026');
  });

  // El backend usa default-property-inclusion=non_null: un campo opcional no
  // llega como null, NO LLEGA. Por eso se comprueba por verdad y hay que cubrir
  // undefined además de null.
  it('devuelve un guion cuando el campo no viene', () => {
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform('')).toBe('—');
  });

  it('devuelve el valor crudo si no se puede interpretar', () => {
    // Preferible a «Invalid Date»: deja ver de dónde salió el dato.
    expect(pipe.transform('no-es-una-fecha')).toBe('no-es-una-fecha');
  });

  it('acepta un Date ya construido', () => {
    expect(pipe.transform(new Date('2026-11-12T08:00:00Z'), 'date')).toBe('Nov 12, 2026');
  });
});
