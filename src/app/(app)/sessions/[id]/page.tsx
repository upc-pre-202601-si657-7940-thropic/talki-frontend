"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  MessageSquarePlus,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from "lucide-react";
import { sessions } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import type { Feedback, Session } from "@/lib/api/types";
import { formatDateTime, STATUS_LABEL, STATUS_VARIANT } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getSpeechRecognition,
  isWebSpeechAvailable,
  mergeInterimTranscript,
  speechErrorMessage,
} from "@/lib/speech/webSpeech";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

// ─── CameraPanel ────────────────────────────────────────────────────────────

type RecState = "idle" | "recording" | "stopped";

function CameraPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptAccRef = useRef("");
  const interimRef = useRef("");

  const [recState, setRecState] = useState<RecState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState(false);

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const wpm = elapsed > 10 ? Math.round((wordCount / elapsed) * 60) : 0;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-iniciar cámara al montar
  useEffect(() => {
    let alive = true;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamReady(true);
      })
      .catch(() => alive && setCamError(true));

    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.stop();
      stopTimer();
    };
  }, [stopTimer]);

  async function startRecording() {
    if (!isWebSpeechAvailable()) {
      toast.error("La transcripción en vivo requiere Chrome o Edge (Web Speech API).");
      return;
    }

    transcriptAccRef.current = "";
    interimRef.current = "";
    setTranscript("");
    setInterim("");
    setElapsed(0);

    // Cámara + micrófono juntos (evita conflictos con Web Speech).
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamReady(true);
      setCamError(false);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        setCamReady(false);
        setCamError(false);
      } catch {
        toast.error("No se pudo acceder al micrófono. Revisá los permisos del navegador.");
        return;
      }
    }

    const SR = getSpeechRecognition();
    if (SR) {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "es-ES";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalChunk += r[0].transcript;
          else interimChunk += r[0].transcript;
        }
        if (finalChunk) {
          transcriptAccRef.current += finalChunk + " ";
          setTranscript(transcriptAccRef.current);
          interimRef.current = "";
          setInterim("");
        } else {
          interimRef.current = interimChunk;
          setInterim(interimChunk);
        }
      };
      recognition.onerror = (event) => {
        if (event.error !== "aborted") {
          toast.warning(speechErrorMessage(event.error));
        }
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognition.start();
      };
      recognition.start();
      recognitionRef.current = recognition;
    }

    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    setRecState("recording");
  }

  function stopRecording() {
    const merged = mergeInterimTranscript(transcriptAccRef.current, interimRef.current);
    if (merged !== transcriptAccRef.current) {
      transcriptAccRef.current = merged;
      setTranscript(merged);
    }

    recognitionRef.current?.stop();
    recognitionRef.current = null;
    interimRef.current = "";
    setInterim("");

    // Detener solo audio; el preview de video sigue en idle/stopped.
    streamRef.current?.getAudioTracks().forEach((t) => t.stop());
    stopTimer();
    setRecState("stopped");

    if (!merged.trim()) {
      toast.warning("No se detectó voz. Hablá unos segundos antes de detener.");
    }
  }

  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, interim]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
      {/* ── Cámara ── */}
      <div className="flex flex-col gap-3">
        <div className="relative overflow-hidden rounded-xl bg-zinc-900 shadow-inner" style={{ aspectRatio: "16/9" }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={cn("w-full h-full object-cover", !camReady && "opacity-0")}
          />

          {/* Sin cámara */}
          {(camError || !camReady) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40">
              <VideoOff className="size-10" />
              <span className="text-sm">{camError ? "Cámara no disponible" : "Iniciando cámara…"}</span>
            </div>
          )}

          {/* Indicador REC */}
          {recState === "recording" && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 backdrop-blur-sm">
              <span className="size-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs font-semibold text-white">REC · {formatTime(elapsed)}</span>
            </div>
          )}

          {/* Idle overlay */}
          {recState === "idle" && camReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/30 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 text-white">
                <Video className="size-10 opacity-80" />
                <span className="text-sm font-medium opacity-80">Cámara lista</span>
              </div>
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
              >
                <Mic className="size-4" /> Iniciar grabación
              </button>
            </div>
          )}

          {/* Stopped overlay */}
          {recState === "stopped" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-[2px]">
              <span className="text-white font-medium">Grabación finalizada · {formatTime(elapsed)}</span>
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                <Mic className="size-4" /> Grabar de nuevo
              </button>
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="flex items-center gap-3">
          {recState === "recording" ? (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              <MicOff className="size-4" /> Detener grabación
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Mic className="size-4" />
              {recState === "stopped" ? "Grabar de nuevo" : "Iniciar grabación"}
            </button>
          )}

          {recState !== "idle" && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{wordCount} palabras</span>
              {wpm > 0 && <span>{wpm} PPM</span>}
              <span>{formatTime(elapsed)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Transcripción ── */}
      <div className="flex flex-col rounded-xl border bg-card overflow-hidden" style={{ minHeight: "280px" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <span className="text-sm font-semibold">Transcripción en vivo</span>
          {recState === "recording" && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              Escuchando
            </span>
          )}
        </div>

        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed"
          style={{ maxHeight: "calc(9/16 * (100vw - 680px) - 60px)", minHeight: "220px" }}
        >
          {transcript || interim ? (
            <p>
              <span className="text-foreground">{transcript}</span>
              <span className="text-muted-foreground italic">{interim}</span>
            </p>
          ) : (
            <p className="text-muted-foreground text-xs italic">
              {recState === "idle"
                ? "Iniciá la grabación para ver la transcripción en tiempo real…"
                : recState === "recording"
                  ? "Hablá y verás el texto aparecer acá…"
                  : transcript
                    ? "Grabación detenida."
                    : "No se captó texto. Probá de nuevo en Chrome/Edge, hablando 5–10 s."}
            </p>
          )}
        </div>

        {(transcript || recState === "stopped") && (
          <div className="border-t px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{wordCount} palabras · {formatTime(elapsed)}</span>
            {recState === "stopped" && (
              <button
                type="button"
                onClick={() => { setTranscript(""); transcriptAccRef.current = ""; setElapsed(0); setRecState("idle"); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [savingFb, setSavingFb] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, fb] = await Promise.all([
        sessions.get(id),
        sessions.listFeedbacks(id).catch(() => [] as Feedback[]),
      ]);
      setSession(s);
      setFeedbacks(fb);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error al cargar la sesión";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onFinalize() {
    setFinalizing(true);
    try {
      const updated = await sessions.finalize(id);
      setSession(updated);
      toast.success("Sesión finalizada, análisis en proceso");
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status >= 500
          ? "El backend solo finaliza sesiones en estado RECORDING."
          : err instanceof ApiError
            ? err.message
            : "No se pudo finalizar";
      toast.error(msg);
    } finally {
      setFinalizing(false);
    }
  }

  async function onAddFeedback(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSavingFb(true);
    try {
      const fb = await sessions.addFeedback(id, {
        feedbackType: String(form.get("feedbackType") || "general"),
        content: String(form.get("content") || ""),
      });
      setFeedbacks((prev) => [...prev, fb]);
      formEl.reset();
      toast.success("Feedback agregado");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo guardar el feedback";
      toast.error(msg);
    } finally {
      setSavingFb(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No se encontró la sesión.</p>
        <Button render={<Link href="/sessions" />} nativeButton={false} variant="outline">
          <ArrowLeft className="size-4" /> Volver
        </Button>
      </div>
    );
  }

  const canFinalize = session.status === "RECORDING";
  const isDraft = session.status === "DRAFT";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button render={<Link href="/sessions" />} nativeButton={false} variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{session.title}</h1>
              <Badge variant={STATUS_VARIANT[session.status] ?? "outline"}>
                {STATUS_LABEL[session.status] ?? session.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {session.sessionType} · creada {formatDateTime(session.createdAt)}
            </p>
          </div>
        </div>

        {canFinalize && (
          <Button onClick={onFinalize} disabled={finalizing} size="sm">
            {finalizing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Finalizar y analizar
          </Button>
        )}
      </div>

      {/* Aviso borrador */}
      {isDraft && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          Esta sesión está en <strong className="font-medium text-foreground mx-1">borrador</strong>.
          El flujo de análisis se dispara desde{" "}
          <Link href="/coach" className="font-medium text-foreground underline underline-offset-4">Coach</Link>.
        </p>
      )}

      {/* Cámara + Transcripción */}
      <CameraPanel />

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feedback</CardTitle>
          <CardDescription>Notas y comentarios de la sesión</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedbacks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin feedback todavía.</p>
          ) : (
            <ul className="space-y-3">
              {feedbacks.map((f) => (
                <li key={f.id} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary">{f.feedbackType}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(f.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm">{f.content}</p>
                </li>
              ))}
            </ul>
          )}

          <Separator />

          <form onSubmit={onAddFeedback} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="feedbackType">Tipo</Label>
                <Input id="feedbackType" name="feedbackType" defaultValue="general" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Comentario</Label>
                <Input id="content" name="content" required placeholder="Escribe un comentario…" />
              </div>
            </div>
            <Button type="submit" variant="outline" disabled={savingFb}>
              {savingFb ? <Loader2 className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />}
              Agregar feedback
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
