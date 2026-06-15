import { authApi, gateway } from "@/lib/api/client";
import type {
  AuthUser,
  CoachModes,
  CreateFeedbackInput,
  CreateSessionInput,
  Feedback,
  FinalizeLiveInput,
  LeaderboardEntry,
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

// ---------------- Health (8087 / 8088) ----------------
export const health = {
  filler: () => gateway<ServiceHealth>("filler", "GET", "health"),
  scoring: () => gateway<ServiceHealth>("scoring", "GET", "v1/scores/health"),
};
