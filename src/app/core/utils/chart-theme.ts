/**
 * Colores y tipografía de gráficos leídos de los tokens CSS del tema activo.
 * ApexCharts necesita valores literales (no acepta var() en atributos SVG),
 * así que se resuelven en tiempo de ejecución; en SSR se usan los del tema claro.
 */
export interface ChartTokens {
  text: string;
  textMuted: string;
  grid: string;
  border: string;
  surface: string;
  series: string[];
  safe: string;
  warning: string;
  danger: string;
  live: string;
  fontBody: string;
  fontMono: string;
  dark: boolean;
}

const LIGHT_FALLBACK: ChartTokens = {
  text: '#12151A',
  textMuted: '#6B7381',
  grid: '#E4E7EB',
  border: '#DDE0E5',
  surface: '#FFFFFF',
  series: ['#3D35C4', '#12A3B8', '#A3541F', '#6B7381', '#2F7BC2'],
  safe: '#22A05F',
  warning: '#E0A800',
  danger: '#DC3B2F',
  live: '#12A3B8',
  fontBody: "'IBM Plex Sans', sans-serif",
  fontMono: "'IBM Plex Mono', monospace",
  dark: false,
};

export function chartTokens(): ChartTokens {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return LIGHT_FALLBACK;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
  return {
    text: v('--ems-text', LIGHT_FALLBACK.text),
    textMuted: v('--ems-text-tertiary', LIGHT_FALLBACK.textMuted),
    grid: v('--ems-grid', LIGHT_FALLBACK.grid),
    border: v('--ems-border', LIGHT_FALLBACK.border),
    surface: v('--ems-surface', LIGHT_FALLBACK.surface),
    series: [1, 2, 3, 4, 5].map((i) => v(`--ems-chart-${i}`, LIGHT_FALLBACK.series[i - 1])),
    safe: v('--ems-safe-signal', LIGHT_FALLBACK.safe),
    warning: v('--ems-warning-signal', LIGHT_FALLBACK.warning),
    danger: v('--ems-danger-signal', LIGHT_FALLBACK.danger),
    live: v('--ems-live-signal', LIGHT_FALLBACK.live),
    fontBody: v('--ems-font-body', LIGHT_FALLBACK.fontBody),
    fontMono: v('--ems-font-mono', LIGHT_FALLBACK.fontMono),
    dark: document.documentElement.classList.contains('theme-dark'),
  };
}

/** Ejes con estilo del sistema: etiquetas mono, sin bordes de eje. */
export function axisLabels(t: ChartTokens) {
  return { style: { colors: t.textMuted, fontSize: '11px', fontFamily: t.fontMono } };
}

export function gridOptions(t: ChartTokens) {
  return {
    borderColor: t.grid,
    strokeDashArray: 3,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { left: 4, right: 8 },
  };
}
