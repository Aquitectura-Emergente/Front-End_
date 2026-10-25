import { RadiationLevel } from './radiation-level';

/** Última lectura de un sensor concreto, dentro de la agrupación por cliente. */
export interface ClientDeviceReading {
  deviceId: number;
  deviceName: string;
  deviceType: string;
  serialNumber: string;
  deviceLocation: string;
  deviceStatus: string;
  latestValue: number;
  level: RadiationLevel;
  readingDate: string;
}

/**
 * Cliente como punto del mapa, con el peor nivel de sus sensores.
 *
 * Es la vista que consume el mapa del panel: un marcador por cliente que
 * despliega sus dispositivos.
 */
export interface ClientRadiationPoint {
  clientId: number;
  clientName: string;
  latitude: number;
  longitude: number;
  location: string;
  maxValue: number;
  level: RadiationLevel;
  devices: ClientDeviceReading[];
}
