import { Connectivity } from './device-status.model';

/** Nodo Edge visto por Device Management (planta o hogar). */
export interface EdgeNodeView {
  edgeNodeId: string;
  organizationId: number | null;
  segment: 'PLANT' | 'HOME';
  connectivity: Connectivity | null;
  connectivityChangedAt: string | null;
  lastSeenAt: string | null;
}
