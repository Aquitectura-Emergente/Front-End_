/** Tiempo transcurrido corto ("5 min", "3 h", "2 d") para "última vez visto". */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} d`;
}

/** Fecha y hora local legible, o un guion si no hay valor. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
