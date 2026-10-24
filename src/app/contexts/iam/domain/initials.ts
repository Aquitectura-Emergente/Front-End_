/**
 * Iniciales mostradas en el avatar de un usuario.
 *
 * Estaba copiada en cinco sitios (modal de orden, ficha de cliente, perfil,
 * alta de admin y alta de técnico) y, como pasaba en el backend, con dos
 * algoritmos distintos (`split(/\s+/)` frente a `split(' ')`).
 *
 * Replica `com.emsafe.iam.domain.model.Initials`: primera + última palabra
 * ("Juan Carlos Perez" → JP), y las dos primeras letras cuando el nombre es de
 * una sola palabra ("Madonna" → MA). Antes el front tomaba la inicial de cada
 * palabra ("Juan Carlos Perez" → JC), y como el alta del portal **envía** estas
 * iniciales al backend, el valor del front ganaba sobre el del agregado: la
 * misma persona quedaba como JC desde el portal y JP desde el móvil.
 *
 * OJO — la regla vive duplicada en dos stacks a propósito (decisión tomada el
 * 2026-10-23). Si cambias una, cambia la otra:
 *   - Back-End/src/main/java/com/emsafe/iam/domain/model/Initials.java
 *   - este archivo
 *
 * Única diferencia deliberada: ante un nombre vacío el backend persiste "??"
 * y aquí se devuelve "?" porque es un hueco de interfaz (avatar sin dato),
 * no un valor que se guarde.
 */
export const UNKNOWN_INITIALS = '?';

export function initialsFrom(name: string | undefined | null): string {
  if (!name || !name.trim()) return UNKNOWN_INITIALS;

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
