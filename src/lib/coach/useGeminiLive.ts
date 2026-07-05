"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { coach } from "@/lib/api/services";
import { PcmPlayer, base64ToInt16, startMicCapture, type MicCapture } from "@/lib/coach/audio";

export type LiveStatus = "idle" | "connecting" | "live" | "closing" | "error";

export interface LiveSummary {
  transcript: string;
  durationSeconds: number;
  wordsPerMinute: number;
}

interface StartOptions {
  scenarioId?: string;
  /** Stream ya abierto (cámara/mic) a reutilizar para no pedir el micro dos veces. */
  stream?: MediaStream;
}

interface UseGeminiLive {
  status: LiveStatus;
  error: string | null;
  /** Transcripción acumulada de lo que dijo el usuario (según Gemini). */
  userTranscript: string;
  /** Transcripción acumulada de lo que respondió el coach. */
  modelTranscript: string;
  /** Conecta con Gemini Live. Devuelve `true` si conectó, `false` si falló. */
  start: (mode: string, opts?: StartOptions) => Promise<boolean>;
  /** Cierra la sesión y devuelve el resumen para enviar a análisis. */
  stop: () => Promise<LiveSummary | null>;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function useGeminiLive(): UseGeminiLive {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState("");
  const [modelTranscript, setModelTranscript] = useState("");

  const sessionRef = useRef<Session | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const startedAtRef = useRef<number>(0);
  const userTextRef = useRef("");

  const teardown = useCallback(async () => {
    try {
      await micRef.current?.stop();
    } catch {
      /* noop */
    }
    micRef.current = null;
    try {
      sessionRef.current?.close();
    } catch {
      /* noop */
    }
    sessionRef.current = null;
    try {
      await playerRef.current?.close();
    } catch {
      /* noop */
    }
    playerRef.current = null;
  }, []);

  const handleMessage = useCallback((message: LiveServerMessage) => {
    // Audio del modelo -> cola de reproducción.
    const audio = message.data;
    if (audio) playerRef.current?.enqueue(base64ToInt16(audio));

    const server = message.serverContent;
    if (!server) return;

    // El usuario empezó a hablar mientras el modelo respondía: cortamos su voz.
    if (server.interrupted) playerRef.current?.interrupt();

    const inputText = server.inputTranscription?.text;
    if (inputText) {
      userTextRef.current += inputText;
      setUserTranscript(userTextRef.current);
    }

    const outputText = server.outputTranscription?.text;
    if (outputText) setModelTranscript((prev) => prev + outputText);
  }, []);

  const start = useCallback(
    async (mode: string, opts?: StartOptions): Promise<boolean> => {
      setError(null);
      setStatus("connecting");
      setUserTranscript("");
      setModelTranscript("");
      userTextRef.current = "";

      try {
        const creds = await coach.liveToken(mode, opts?.scenarioId);

        const player = new PcmPlayer();
        await player.resume();
        playerRef.current = player;

        const ai = new GoogleGenAI({
          apiKey: creds.token,
          httpOptions: { apiVersion: "v1alpha" },
        });

        const session = await ai.live.connect({
          model: creds.model,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onmessage: handleMessage,
            onerror: () => {
              setError("Error en la conexión con Gemini Live");
              setStatus("error");
              void teardown();
            },
            onclose: () => {
              if (sessionRef.current) {
                sessionRef.current = null;
                setStatus("idle");
                void teardown();
              }
            },
          },
        });
        sessionRef.current = session;

        micRef.current = await startMicCapture((chunk) => {
          sessionRef.current?.sendRealtimeInput({
            audio: { data: chunk, mimeType: "audio/pcm;rate=16000" },
          });
        }, opts?.stream);

        startedAtRef.current = Date.now();
        setStatus("live");
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo iniciar la sesión en vivo";
        setError(msg);
        setStatus("error");
        await teardown();
        return false;
      }
    },
    [handleMessage, teardown],
  );

  const stop = useCallback(async (): Promise<LiveSummary | null> => {
    if (startedAtRef.current === 0) return null;
    setStatus("closing");
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const transcript = userTextRef.current.trim();
    const wordsPerMinute = Math.round((countWords(transcript) / durationSeconds) * 60);

    await teardown();
    startedAtRef.current = 0;
    setStatus("idle");

    return { transcript, durationSeconds, wordsPerMinute };
  }, [teardown]);

  // Cierra todo si el componente se desmonta con la sesión abierta.
  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  return { status, error, userTranscript, modelTranscript, start, stop };
}
