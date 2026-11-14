/**
 * Identidad de la sesión en el portal web.
 *
 * Tres roles: admin, técnico y responsable de SSO. El rol CLIENT entra por la
 * app móvil y WORKER también (el operario consulta su exposición desde el
 * teléfono), así que el login web los rechaza.
 *
 * `sso_responsible` llega así, en minúsculas con guion bajo, porque el backend
 * serializa el enum con `getRole().name().toLowerCase()`. No es un formato
 * elegido aquí: cambiarlo rompería el login.
 */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  initials: string;
  role: 'admin' | 'technician' | 'sso_responsible';
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
  return role === 'admin' || role === 'technician' || role === 'sso_responsible';
}

/**
 * Ruta de inicio de cada rol.
 *
 * Centralizado aquí porque antes estaba duplicado en dos sitios del login (el
 * submit y la redirección de la sesión ya guardada), y añadir un tercer rol en
 * uno solo de los dos habría dejado al SSO atrapado en la pantalla de acceso.
 */
export function homeRouteFor(role: WebRole): string {
  switch (role) {
    case 'admin': return '/admin';
    case 'technician': return '/tech';
    case 'sso_responsible': return '/sso';
  }
}
