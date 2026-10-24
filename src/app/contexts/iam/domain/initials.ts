/**
 * Iniciales mostradas en el avatar de un usuario.
 *
 * Estaba copiada en cinco sitios (modal de orden, ficha de cliente, perfil,
 * alta de admin y alta de técnico) y, como en el backend, con dos algoritmos
 * distintos: unos usaban `split(/\s+/)` y otros `split(' ')`, que difieren en
 * cuanto hay espacios dobles.
 *
 * OJO — divergencia conocida con el backend: `com.emsafe.iam.domain.model.Initials`
 * unificó en primera + última ("Juan Carlos Perez" → JP). Aquí se conserva el
 * algoritmo histórico del front (inicial de cada palabra, cortado a dos → JC)
 * para no cambiar comportamiento en este refactor. Alinear ambos es una
 * decisión pendiente del usuario, no un descuido.
 */
export const UNKNOWN_INITIALS = '?';

export function initialsFrom(name: string | undefined | null): string {
  if (!name) return UNKNOWN_INITIALS;
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
