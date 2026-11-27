/**
 * Mensaje para el usuario a partir del error que devolvió el backend.
 *
 * Los mensajes del backend están en inglés y pensados para desarrolladores; los
 * casos frecuentes se traducen y el resto se muestra tal cual tras el título,
 * para que nunca quede un «no se pudo guardar» sin motivo.
 */
const KNOWN: ReadonlyArray<[RegExp, string]> = [
  [/email already in use/i, 'err_emailInUse'],
  [/SSO access to this organization is required|Exposure is outside the authorized scope/i, 'err_noDosimetryAccess'],
  [/Administrator access is required/i, 'err_adminOnly'],
  [/belongs to another organization|outside the authorized scope/i, 'err_otherOrganization'],
  [/already has a conflicting assignment/i, 'err_deviceBusy'],
  [/No effective limit exists/i, 'err_noLimit'],
  [/effective from|effective limit for this organization/i, 'err_limitStart'],
  [/Dosimeter must (be active|belong)/i, 'err_dosimeterNotUsable'],
  [/Password must be at least 8/i, 'err_passwordShort'],
  [/Invalid state transition|Only a PROPOSED action/i, 'err_actionAlreadyDecided'],
  [/Target zone is classified as RISK/i, 'err_targetZoneRisk'],
  [/Target zone is classified as CAUTION/i, 'err_targetZoneCaution'],
  [/has no margin left/i, 'err_noMarginLeft'],
  [/has no active shift/i, 'err_noActiveShift'],
  [/No rotation candidate/i, 'err_noRotationCandidate'],
  [/has no current classification/i, 'err_zoneUnclassified'],
];

/** Solo el detalle, traducido si es un caso conocido (para mostrarlo bajo un título propio). */
export function translateDetail(t: (key: string) => string, raw: string | null | undefined): string {
  const detail = (raw ?? '').trim();
  const known = KNOWN.find(([pattern]) => pattern.test(detail));
  return known ? capitalize(t(known[1])) : detail;
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function describeError(t: (key: string) => string, title: string, raw: string | null | undefined): string {
  const detail = (raw ?? '').trim();
  if (!detail || detail === 'Request failed') return title;
  const known = KNOWN.find(([pattern]) => pattern.test(detail));
  return `${title}: ${known ? t(known[1]) : detail}`;
}
