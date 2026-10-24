/**
 * Setup global de los tests unitarios.
 *
 * Los tests corren en jsdom, que no implementa `ResizeObserver`. ApexCharts lo
 * usa para redimensionar las gráficas, así que cualquier spec que monte una
 * pantalla con gráfico (work-orders, dashboard) revienta sin este stub. No es
 * un problema de la app: es una API de navegador ausente en el entorno.
 */
class ResizeObserverStub {
  observe(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  disconnect(): void { /* noop */ }
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}
