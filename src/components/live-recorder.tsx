"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, CameraOff, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type State = "idle" | "recording" | "stopped";

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function LiveRecorder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");

  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const wpm = elapsed > 10 ? Math.round((wordCount / elapsed) * 60) : 0;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCamera(true);
    } catch {
      // Solo audio si no hay cámara
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        setHasCamera(false);
      } catch {
        setHasCamera(false);
      }
    }

    // Web Speech API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
          if (r.isFinal) {
            finalChunk += r[0].transcript;
          } else {
            interimChunk += r[0].transcript;
          }
        }
        if (finalChunk) {
          transcriptRef.current += finalChunk + " ";
          setTranscript(transcriptRef.current);
        }
        setInterim(interimChunk);
      };

      recognition.onend = () => {
        // Reiniciar automáticamente si aún estamos grabando
        if (streamRef.current) {
          recognition.start();
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    }

    // Timer
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    setState("recording");
  }

  function stopRecording() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterim("");
    stopTimer();
    setState("stopped");
  }

  function reset() {
    transcriptRef.current = "";
    setTranscript("");
    setInterim("");
    setElapsed(0);
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
          <div className="min-h-[72px] max-h-36 overflow-y-auto p-3 text-sm leading-relaxed">
            {transcript || interim ? (
              <>
                <span className="text-foreground">{transcript}</span>
                <span className="text-muted-foreground italic">{interim}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                {state === "idle"
                  ? "Presioná grabar para iniciar la transcripción en vivo…"
                  : "Escuchando…"}
              </span>
            )}
          </div>

          {/* Métricas */}
          {state !== "idle" && (
            <div className="flex items-center gap-3 px-3 pb-2 text-xs text-muted-foreground">
              <span>{wordCount} palabras</span>
              {wpm > 0 && <span>{wpm} PPM</span>}
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
                onClick={startRecording}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Mic className="size-4" />
                {state === "stopped" ? "Grabar de nuevo" : "Grabar"}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                <MicOff className="size-4" />
                Detener
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
