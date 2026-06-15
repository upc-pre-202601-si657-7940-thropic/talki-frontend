/**
 * Mapa de microservicios Talki -> URL base (solo lado servidor / BFF).
 * El navegador nunca ve estas URLs; el proxy en /api/gateway resuelve aquí.
 */

export type ServiceName =
  | "identity"
  | "session"
  | "coach"
  | "filler"
  | "scoring"
  | "progress"
  | "gamification"
  | "notification";

const SERVICE_ENV: Record<ServiceName, string> = {
  identity: "TALKI_IDENTITY_URL",
  session: "TALKI_SESSION_URL",
  coach: "TALKI_COACH_URL",
  filler: "TALKI_FILLER_URL",
  scoring: "TALKI_SCORING_URL",
  progress: "TALKI_PROGRESS_URL",
  gamification: "TALKI_GAMIFICATION_URL",
  notification: "TALKI_NOTIFICATION_URL",
};

const DEFAULTS: Record<ServiceName, string> = {
  identity: "http://localhost:8081",
  session: "http://localhost:8082",
  coach: "http://localhost:8083",
  filler: "http://localhost:8087",
  scoring: "http://localhost:8088",
  progress: "http://localhost:8089",
  gamification: "http://localhost:8090",
  notification: "http://localhost:8091",
};

export function serviceBaseUrl(service: ServiceName): string {
  return process.env[SERVICE_ENV[service]] ?? DEFAULTS[service];
}

export function isServiceName(value: string): value is ServiceName {
  return value in SERVICE_ENV;
}

export const SESSION_COOKIE = process.env.TALKI_SESSION_COOKIE ?? "talki_session";
