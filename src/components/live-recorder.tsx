"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  CameraOff,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Loader2,
  Sparkles,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { coach } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import { useUser } from "@/components/user-context";
import { useGeminiLive } from "@/lib/coach/useGeminiLive";
import {
  getSpeechRecognition,
  isWebSpeechAvailable,
  mergeInterimTranscript,
  speechErrorMessage,
} from "@/lib/speech/webSpeech";

type State = "idle" | "recording" | "stopped";

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function LiveRecorder({ mode = "quick_practice" }: { mode?: string }) {
  const user = useUser();
  const live = useGeminiLive();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");
  const interimRef = useRef("");

  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  // true = conversación con Gemini; false = transcripción local (Web Speech).
  const [aiActive, setAiActive] = useState(false);
  const [sending, setSending] = useState(false);

  // Texto del usuario según la fuente activa (Gemini o Web Speech).
  const userText = aiActive ? live.userTranscript : transcript;
  const wordCount = userText.trim().split(/\s+/).filter(Boolean).length;
  const wpm = elapsed > 10 ? Math.round((wordCount / elapsed) * 60) : 0;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Fallback local: transcripción del usuario con la Web Speech API del navegador.
  const startWebSpeech = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      toast.error("La transcripción local requiere Chrome o Edge.");
      return;
    }
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
        transcriptRef.current += finalChunk + " ";
        setTranscript(transcriptRef.current);
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
  }, []);

  async function startRecording() {
    transcriptRef.current = "";
    setTranscript("");
    setInterim("");
    setElapsed(0);

    // Cámara + micrófono
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setHasCamera(true);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        setHasCamera(false);
      } catch {
        setHasCamera(false);
      }
    }

    // Intentar conversación real con Gemini; si no hay API key, caer a Web Speech.
    const connected = await live.start(mode, { stream: streamRef.current ?? undefined });
    setAiActive(connected);
    if (!connected) {
      if (!isWebSpeechAvailable()) {
        toast.error("Coach IA no disponible y este navegador no soporta transcripción local.");
      } else {
        startWebSpeech();
      }
    }

    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    setState("recording");
  }

  async function stopRecording() {
    stopTimer();

    // Cierra la fuente de transcripción y obtiene el texto final.
    let finalTranscript = transcriptRef.current.trim();
    let finalWpm = wpm;
    let finalDuration = elapsed;

    if (aiActive) {
      const summary = await live.stop();
      if (summary) {
        finalTranscript = summary.transcript || finalTranscript;
        finalWpm = summary.wordsPerMinute || finalWpm;
        finalDuration = summary.durationSeconds || finalDuration;
      }
    } else {
      const merged = mergeInterimTranscript(transcriptRef.current, interimRef.current);
      if (merged !== transcriptRef.current) {
        transcriptRef.current = merged;
        setTranscript(merged);
        finalTranscript = merged.trim();
      }
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      interimRef.current = "";
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setInterim("");
    setState("stopped");

    if (!finalTranscript) {
      toast.warning("No se detectó voz. Intenta de nuevo hablando al micrófono.");
      return;
    }

    // Dispara el pipeline de análisis (muletillas → scoring → progreso).
    setSending(true);
    try {
      const sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `sess-${Date.now()}`;
      await coach.finalize(sessionId, {
        userId: user.userId,
        mode,
        transcriptGemini: finalTranscript,
        wordsPerMinute: finalWpm,
        durationSeconds: finalDuration,
        silenceRatio: 0,
        volumeRmsAvg: 0,
        academicSegment: "ciclos_6_10",
      });
      toast.success("Sesión enviada a análisis (muletillas → scoring → progreso)");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo enviar la sesión a análisis";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    transcriptRef.current = "";
    interimRef.current = "";
    setTranscript("");
    setInterim("");
    setElapsed(0);
    setAiActive(false);
    setState("idle");
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.stop();
      stopTimer();
    };
  }, [stopTimer]);

  return (
    <div className="fixed right-4 bottom-4 z-50 w-72 rounded-xl border bg-card shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          {state === "recording" && (
            <span className="size-2 rounded-full bg-destructive animate-pulse shrink-0" />
          )}
          <span className="text-sm font-semibold">
            {state === "idle"
              ? "Live Coach"
              : state === "recording"
                ? `REC · ${formatTime(elapsed)}`
                : `Grabado · ${formatTime(elapsed)}`}
          </span>
          {state === "recording" && aiActive && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <Sparkles className="size-2.5" /> IA
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMinimized((m) => !m)}
          className="grid size-6 place-items-center rounded hover:bg-muted transition-colors text-muted-foreground"
        >
          {minimized ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>

      {!minimized && (
        <>
          {/* Cámara */}
          <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cn(
                "w-full h-full object-cover",
                (!hasCamera || state === "idle") && "opacity-0 pointer-events-none",
              )}
            />
            {(!hasCamera || state === "idle") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <CameraOff className="size-7 text-white/25" />
                <span className="text-xs text-white/25">
                  {state === "idle" ? "Sin cámara activa" : "Cámara no disponible"}
                </span>
              </div>
            )}
          </div>

          {/* Transcripción */}
          <div className="min-h-[72px] max-h-40 overflow-y-auto p-3 text-sm leading-relaxed space-y-2">
            {userText || interim ? (
              <p>
                <span className="text-foreground">{userText}</span>
                <span className="text-muted-foreground italic">{interim}</span>
              </p>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                {state === "idle"
                  ? "Presioná grabar para conversar con el coach…"
                  : "Escuchando…"}
              </span>
            )}
            {aiActive && live.modelTranscript && (
              <p className="rounded-md bg-primary/5 p-2 text-[13px]">
                <span className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-primary">
                  <Sparkles className="size-2.5" /> Coach IA
                </span>
                <span className="text-foreground">{live.modelTranscript}</span>
              </p>
            )}
          </div>

          {/* Métricas */}
          {state !== "idle" && (
            <div className="flex items-center gap-3 px-3 pb-2 text-xs text-muted-foreground">
              <span>{wordCount} palabras</span>
              {wpm > 0 && <span>{wpm} PPM</span>}
              {sending && (
                <span className="ml-auto flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> enviando…
                </span>
              )}
            </div>
          )}

          {/* Controles */}
          <div className="flex items-center gap-2 p-3 border-t">
            {state === "stopped" && (
              <button
                type="button"
                onClick={reset}
                className="grid size-9 place-items-center rounded-lg border text-muted-foreground hover:bg-muted transition-colors"
              >
                <RotateCcw className="size-4" />
              </button>
            )}

            {state !== "recording" ? (
              <button
                type="button"
                disabled={live.status === "connecting"}
                onClick={startRecording}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {live.status === "connecting" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mic className="size-4" />
                )}
                {live.status === "connecting"
                  ? "Conectando…"
                  : state === "stopped"
                    ? "Grabar de nuevo"
                    : "Grabar"}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                {sending ? <Send className="size-4" /> : <MicOff className="size-4" />}
                Detener
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
