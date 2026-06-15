/** Tipos compartidos con los DTOs de los microservicios Talki. */

// ---- Auth / Identity (8081) ----
export interface AuthUser {
  userId: string;
  email: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
  academicSegment?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ---- Session service (8082) ----
export type SessionStatus =
  | "DRAFT"
  | "RECORDING"
  | "PROCESSING"
  | "COMPLETED"
  | "ANALYSIS_PENDING";

export interface Session {
  id: number;
  title: string;
  sessionType: string;
  status: SessionStatus;
  createdAt: string;
  finalizedAt: string | null;
}

export interface CreateSessionInput {
  title: string;
  sessionType: string;
  userId: number;
}

export interface Feedback {
  id: number;
  feedbackType: string;
  content: string;
  createdAt: string;
}

export interface CreateFeedbackInput {
  feedbackType?: string;
  content?: string;
}

// ---- Live coach (8083) ----
export interface CoachModes {
  modes: string[];
  description: string;
}

export interface FinalizeLiveInput {
  userId: string;
  mode: string;
  scenarioId?: string;
  transcriptGemini?: string;
  wordsPerMinute?: number;
  silenceRatio?: number;
  volumeRmsAvg?: number;
  durationSeconds?: number;
  academicSegment?: string;
}

// ---- Progress (8089) ----
export interface ProgressDashboard {
  userId: string;
  totalSessions: number;
  totalMinutes: number;
  averageScore: number;
  bestScore: number;
  currentStreak: number;
}

// ---- Gamification (8090) ----
export interface Streaks {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
}

export interface LeaderboardEntry {
  userId: string;
  totalXp: number;
  currentStreak: number;
}

// ---- Health (filler 8087 / scoring 8088) ----
export interface ServiceHealth {
  service: string;
  status: string;
  description?: string;
}
