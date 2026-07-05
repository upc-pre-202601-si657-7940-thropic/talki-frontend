"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mic, Send } from "lucide-react";
import { coach } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import type { CoachModes } from "@/lib/api/types";
import { LiveRecorder } from "@/components/live-recorder";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [sending, setSending] = useState(false);

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

  async function onFinalize(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}`;
    setSending(true);
    try {
      await coach.finalize(sessionId, {
        userId: user.userId,
        mode: selected,
        transcriptGemini: String(form.get("transcript") || ""),
        wordsPerMinute: Number(form.get("wpm") || 0),
        durationSeconds: Number(form.get("duration") || 300),
        silenceRatio: 0,
        volumeRmsAvg: 0,
        academicSegment: "ciclos_6_10",
      });
      toast.success("Sesión enviada a análisis (fillers → scoring → progreso)");
      (e.currentTarget as HTMLFormElement).reset();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo finalizar la sesión";
      toast.error(msg);
    } finally {
      setSending(false);
    }
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
            Usá el grabador flotante (abajo a la derecha) para conversar por voz con el
            coach de IA en modo <strong>{MODE_LABEL[selected] ?? selected}</strong>. Al
            detener, tu intervención se transcribe y se envía sola a análisis.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Requiere permitir cámara y micrófono. Si el coach de IA no está disponible, se
          usa la transcripción local del navegador.
        </CardContent>
      </Card>

      {/* Grabador flotante con conversación de IA + análisis automático. */}
      <LiveRecorder mode={selected} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envío manual (alternativa)</CardTitle>
          <CardDescription>
            Si preferís, escribí la transcripción y métricas a mano para disparar el
            análisis de muletillas y puntaje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onFinalize} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transcript">Transcripción</Label>
              <Input
                id="transcript"
                name="transcript"
                placeholder="Eh… bueno, este… mi proyecto trata sobre…"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wpm">Palabras por minuto</Label>
                <Input id="wpm" name="wpm" type="number" min={0} defaultValue={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duración (segundos)</Label>
                <Input id="duration" name="duration" type="number" min={1} defaultValue={300} />
              </div>
            </div>
            <Button type="submit" disabled={sending}>
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Enviar a análisis ({MODE_LABEL[selected] ?? selected})
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
