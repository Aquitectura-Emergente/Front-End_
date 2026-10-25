/**
 * Identidad de la sesión en el portal web.
 *
 * Solo admin y técnico: el rol CLIENT entra por la app móvil, y el login web
 * rechaza cualquier rol distinto de estos dos.
 */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  initials: string;
  role: 'admin' | 'technician';
  technicianId?: number;
}

/** Respuesta de `/auth/login` tal y como la envía el backend. */
export interface LoginResponse {
  token: string;
  email: string;
  name: string;
  initials: string;
  role: string;
  userId: number;
  technicianId: number | null;
}

export type WebRole = AuthUser['role'];

/** Roles que el portal web admite; el resto se rechaza en el login. */
export function isWebRole(role: string): role is WebRole {
  return role === 'admin' || role === 'technician';
}
