/**
 * Build para AZURE (producción).
 *
 * El front vive en Azure Static Web Apps y el backend en una Container App:
 * son DOS dominios distintos, así que las URLs son absolutas y CORS interviene
 * (hay que declarar el dominio del front en CORS_ALLOWED_ORIGINS del backend).
 *
 * Diferencias con los otros dos:
 *   - `environment.prod.ts`   → mismo dominio (Caddy), URLs relativas.
 *   - `environment.vercel.ts` → Vercel + túnel ngrok. Montaje abandonado.
 *
 * ⚠️ Dos cosas que rompen esto en silencio:
 *
 *  1. **`wss://`, no `ws://`.** Desde una página https el navegador bloquea un
 *     WebSocket sin TLS y el error que muestra no dice que sea por eso.
 *  2. **Si cambia el dominio del backend hay que editar este archivo y volver a
 *     desplegar el front.** No basta con recrear la Container App: el host queda
 *     compilado dentro del bundle.
 */
export const environment = {
  production: true,

  apiUrl: 'https://emsafe-backend.kindground-c19db19d.eastus2.azurecontainerapps.io/api',
  wsUrl: 'wss://emsafe-backend.kindground-c19db19d.eastus2.azurecontainerapps.io/ws',
};
