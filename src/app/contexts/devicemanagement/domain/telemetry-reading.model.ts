export type ReadingRouting = 'ASSIGNED_TO_SESSION' | 'UNASSIGNED' | 'HOME_RECORDED' | 'REJECTED_BY_TARGET';

export const READING_ROUTINGS: readonly ReadingRouting[] = [
  'ASSIGNED_TO_SESSION', 'UNASSIGNED', 'HOME_RECORDED', 'REJECTED_BY_TARGET',
];

/** Lectura aceptada por la ingesta, con su destino y su origen (en vivo o diferida). */
export interface TelemetryReadingView {
  id: number;
  deviceId: string;
  edgeNodeId: string | null;
  sequence: number;
  capturedAt: string;
  capturedAtSource: 'DEVICE_CLOCK' | 'EDGE_RECEIVED';
  receivedAt: string;
  magneticFluxDensityUT: number;
  origin: 'REALTIME' | 'DEFERRED';
  quality: 'VALID' | 'SATURATED';
  bootId: string | null;
  reportedType: string | null;
  routing: ReadingRouting;
  routingRef: string | null;
  routingDetail: string | null;
}
