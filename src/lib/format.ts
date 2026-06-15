import type { SessionStatus } from "@/lib/api/types";

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABEL: Record<SessionStatus, string> = {
  DRAFT: "Borrador",
  RECORDING: "Grabando",
  PROCESSING: "Procesando",
  ANALYSIS_PENDING: "Análisis pendiente",
  COMPLETED: "Completada",
};

export const STATUS_VARIANT: Record<
  SessionStatus,
  "default" | "secondary" | "outline"
> = {
  DRAFT: "outline",
  RECORDING: "default",
  PROCESSING: "secondary",
  ANALYSIS_PENDING: "secondary",
  COMPLETED: "default",
};
