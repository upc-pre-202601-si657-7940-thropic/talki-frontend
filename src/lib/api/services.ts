import { authApi, gateway } from "@/lib/api/client";
import type { ServiceName } from "@/lib/config";
import type {
  AuthUser,
  CoachModes,
  CreateFeedbackInput,
  CreateSessionInput,
  Feedback,
  FinalizeLiveInput,
  LeaderboardEntry,
  LiveTokenResponse,
  LoginInput,
  ProgressDashboard,
  RegisterInput,
  ServiceHealth,
  Session,
  Streaks,
} from "@/lib/api/types";

// ---------------- Auth (BFF) ----------------
export const auth = {
  login: (input: LoginInput) =>
    authApi<{ user: AuthUser }>("login", input).then((r) => r.user),

  register: (input: RegisterInput) =>
    authApi<{ registered: boolean; autoLogin: boolean; user?: AuthUser }>(
      "register",
      input,
    ),

  logout: () => authApi<{ ok: boolean }>("logout"),

  me: () => authApi<{ user: AuthUser | null }>("me", undefined, "GET").then((r) => r.user),
};

// ---------------- Sessions (8082) ----------------
export const sessions = {
  list: (userId: number | string) =>
    gateway<Session[]>("session", "GET", "v1/sessions", { query: { userId } }),

  get: (id: number | string) =>
    gateway<Session>("session", "GET", `v1/sessions/${id}`),

  create: (input: CreateSessionInput) =>
    gateway<Session>("session", "POST", "v1/sessions", { body: input }),

  finalize: (id: number | string) =>
    gateway<Session>("session", "POST", `v1/sessions/${id}/finalize`),

  listFeedbacks: (id: number | string) =>
    gateway<Feedback[]>("session", "GET", `v1/sessions/${id}/feedbacks`),

  addFeedback: (id: number | string, input: CreateFeedbackInput) =>
    gateway<Feedback>("session", "POST", `v1/sessions/${id}/feedbacks`, {
      body: input,
    }),
};

// ---------------- Live coach (8083) ----------------
export const coach = {
  modes: () => gateway<CoachModes>("coach", "GET", "v1/coach/modes"),

  liveToken: (mode: string, scenarioId?: string) =>
    gateway<LiveTokenResponse>("coach", "POST", "v1/coach/live-token", {
      query: { mode, scenarioId },
    }),

  finalize: (sessionId: string, input: FinalizeLiveInput) =>
    gateway("coach", "POST", `v1/coach/${sessionId}/finalize`, {
      query: { ...input },
    }),
};

// ---------------- Progress (8089) ----------------
export const progress = {
  dashboard: (userId: number | string) =>
    gateway<ProgressDashboard>("progress", "GET", "v1/progress/dashboard", {
      query: { userId },
    }),
};

// ---------------- Gamification (8090) ----------------
export const gamification = {
  streaks: (userId: number | string) =>
    gateway<Streaks>("gamification", "GET", `v1/gamification/streaks/${userId}`),

  leaderboard: () =>
    gateway<LeaderboardEntry[]>("gamification", "GET", "v1/gamification/leaderboard"),
};

// ---------------- Health (actuator estándar en los 8 microservicios) ----------------
// Los servicios de análisis son event-driven (no exponen REST de dominio): su
// estado se consulta por el endpoint estándar `/actuator/health` —habilitado en
// los 8 microservicios desde el Sprint 2—, que devuelve `{ "status": "UP" }`. La
// etiqueta del servicio se sintetiza en el cliente porque actuator no la incluye.
async function actuatorHealth(
  service: ServiceName,
  label: string,
): Promise<ServiceHealth> {
  const res = await gateway<{ status?: string }>(service, "GET", "actuator/health");
  return { service: label, status: res.status ?? "UNKNOWN" };
}

export const health = {
  filler: () => actuatorHealth("filler", "filler-detection-service"),
  scoring: () => actuatorHealth("scoring", "scoring-service"),
};
