/**
 * Usuario gestionado desde el portal.
 *
 * El rol llega en formato de presentación (`Role.displayName()` del backend:
 * «Admin», «Technician», «Client», «Worker», «SsoResponsible»), **no** como el
 * nombre del enum. No confundirlo con el `role` de `AuthUser`, que llega en
 * minúsculas desde `/auth/login`.
 */
export interface User {
  id: number;
  name: string;
  initials: string;
  joinDate: string;
  role: 'Admin' | 'Technician' | 'Client' | 'Worker' | 'SsoResponsible';
  email: string;
  /** Empresa a la que pertenece una cuenta industrial (Worker / SsoResponsible). */
  organizationId?: number | null;
  status: 'active' | 'inactive' | 'pending';
  phone?: string;
  location?: string;
  address?: string;
  specialty?: string;
  department?: string;
  notes?: string;
  clientType?: string;
  taxId?: string;
  industry?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface CreateUserPayload {
  name: string;
  initials?: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT';
  phone?: string;
  location?: string;
  specialty?: string;
  department?: string;
  status?: string;
  notes?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  specialty?: string;
  department?: string;
  status?: string;
  notes?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  clientType?: string;
  taxId?: string;
  industry?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/** Perfil del usuario autenticado (`/users/profile`). */
export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  initials: string;
  phone: string;
  location: string;
  joinDate: string;
  status: string;
}

/**
 * "active" no significa lo mismo en cada contexto: aquí es *cuenta habilitada*,
 * mientras que en iottelemetry es *sensor instalado y reportando*. Por eso los
 * estados de usuario y de dispositivo son tipos separados y no se unifican.
 */
export type UserStatus = User['status'];

export type UserRole = User['role'];
