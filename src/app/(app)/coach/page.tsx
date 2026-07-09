"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mic } from "lucide-react";
import { coach } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import type { CoachModes } from "@/lib/api/types";
import { analyzePractice, type AiFeedbackItem } from "@/lib/coach/aiFeedback";
import { LiveRecorder, type PracticeCompletePayload } from "@/components/live-recorder";
import { AiFeedbackPanel } from "@/components/ai-feedback-panel";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MODE_LABEL: Record<string, string> = {
  quick_practice: "Práctica rápida",
  interview: "Entrevista",
  thesis_defense: "Defensa de tesis",
  scenario: "Escenario",
};

export default function CoachPage() {
  const user = useUser();
  const [modes, setModes] = useState<CoachModes | null>(null);
  const [selected, setSelected] = useState<string>("quick_practice");
  const [aiItems, setAiItems] = useState<AiFeedbackItem[]>([]);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);

  useEffect(() => {
    coach
      .modes()
      .then((m) => {
        setModes(m);
        if (m.modes.length) setSelected(m.modes[0]);
      })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : "No se pudo cargar el coach";
        toast.error(msg);
      });
  }, []);

  async function handlePracticeComplete({
    transcript,
    durationSeconds,
    wordsPerMinute,
  }: PracticeCompletePayload) {
    const analysis = analyzePractice(transcript, durationSeconds);
    setAiItems(analysis.items);
    setOverallScore(analysis.scores.overall);
    setLastAnalyzedAt(
      new Date().toLocaleString("es-PE", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    );

    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}`;

    await coach.finalize(sessionId, {
      userId: user.userId,
      mode: selected,
      transcriptGemini: transcript,
      wordsPerMinute: wordsPerMinute || analysis.wordsPerMinute,
      durationSeconds: durationSeconds || analysis.durationSeconds,
      silenceRatio: 0,
      volumeRmsAvg: 0,
      academicSegment: "ciclos_6_10",
    });

    toast.success("Feedback del coach IA listo");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Mic className="size-6 text-primary" /> Live Coach
        </h1>
        <p className="text-muted-foreground">
          {modes?.description ?? "Modos de práctica con Gemini Live"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {modes === null
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))
          : modes.modes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelected(m)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  selected === m
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-muted/50",
                )}
              >
                <span className="font-medium">{MODE_LABEL[m] ?? m}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{m}</span>
              </button>
            ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversación en vivo</CardTitle>
          <CardDescription>
            Usá el grabador flotante (abajo a la derecha) para practicar en modo{" "}
            <strong>{MODE_LABEL[selected] ?? selected}</strong>. Al detener, el coach IA
            analiza tu intervención y el feedback aparece abajo.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Requiere cámara y micrófono (Chrome o Edge recomendado). Si Gemini Live no está
          disponible, se usa transcripción local y el mismo análisis de muletillas y ritmo.
        </CardContent>
      </Card>

      <LiveRecorder mode={selected} onPracticeComplete={handlePracticeComplete} />

      <AiFeedbackPanel
        items={aiItems.map((item) => ({
          ...item,
          createdAt:
            item.feedbackType === "ai_resumen" ? (lastAnalyzedAt ?? undefined) : undefined,
        }))}
        overallScore={overallScore}
        emptyMessage="Usá el grabador flotante para practicar. Al detener, el coach IA te dará consejos personalizados acá."
      />
    </div>
  );
}
