/**
 * Cuenta de la plataforma. `Worker` y `SsoResponsible` son cuentas industriales
 * ligadas a un cliente empresa mediante `organizationId`.
 */
export interface User {
  id: number;
  name: string;
  initials: string;
  joinDate: string;
  role: UserRole;
  email: string;
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
  organizationId?: number | null;
}

export interface CreateUserPayload {
  name: string;
  initials?: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT' | 'SSO_RESPONSIBLE';
  /** Obligatorio para SSO_RESPONSIBLE: id del cliente empresa. */
  organizationId?: number;
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
 * mientras que en devicemanagement es *sensor instalado y reportando*. Por eso los
 * estados de usuario y de dispositivo son tipos separados y no se unifican.
 */
export type UserStatus = User['status'];

export type UserRole = 'Admin' | 'Technician' | 'Client' | 'Worker' | 'SsoResponsible';

/** Los operarios los gestiona el responsable de SSO de su empresa, no este panel. */
export function isManagedByPanel(user: Pick<User, 'role'>): boolean {
  return user.role !== 'Worker';
}

/** Cliente empresa: el que puede tener plantas, responsables SSO y operarios. */
export function isCompanyClient(user: Pick<User, 'role' | 'clientType'>): boolean {
  return user.role === 'Client' && (user.clientType ?? '').toLowerCase() === 'company';
}
