export type AuditEntryType =
  | 'REGISTERED'
  | 'CONFIG_CHANGED'
  | 'LINKED'
  | 'CONNECTIVITY_CHANGED'
  | 'LIFECYCLE_CHANGED'
  | 'ZONE_CHANGED'
  | 'PLUG_COMMAND'
  | 'PLUG_STATE'
  | 'DEVICE_TYPE_MISMATCH'
  | 'DEVICE_LENT';

/** Entrada de la auditoría append-only del dispositivo. */
export interface AuditEntryView {
  id: number;
  entryType: AuditEntryType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: string | null;
  details: string | null;
  occurredAt: string;
}
