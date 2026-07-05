/**
 * Utilidades de audio PCM para Gemini Live.
 *
 * Gemini Live espera audio de entrada en PCM 16-bit mono a 16 kHz y devuelve
 * audio en PCM 16-bit mono a 24 kHz. Este módulo captura el micrófono, lo
 * codifica a base64 y reproduce el audio del modelo respetando el orden.
 */

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

/** Decodifica base64 -> Int16Array (PCM 16-bit little-endian). */
export function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

/** Codifica muestras Float32 [-1,1] -> base64 de PCM 16-bit. */
export function float32ToBase64Pcm16(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Worklet que reenvía cada bloque de muestras del micrófono al hilo principal.
const RECORDER_WORKLET = `
class PcmRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor('talki-pcm-recorder', PcmRecorder);
`;

export interface MicCapture {
  /** RMS [0,1] del último bloque, para el medidor de nivel. */
  getVolume: () => number;
  stop: () => Promise<void>;
}

/**
 * Codifica en base64 (PCM16 @ 16 kHz) cada bloque de audio del micrófono y lo
 * entrega a `onChunk`, listo para `session.sendRealtimeInput`.
 *
 * Si se pasa `existingStream` (p. ej. el que ya abrió el recorder para la
 * cámara) se reutiliza y NO se detiene al parar: lo gestiona quien lo creó.
 */
export async function startMicCapture(
  onChunk: (base64: string) => void,
  existingStream?: MediaStream,
): Promise<MicCapture> {
  const ownStream = !existingStream;
  const stream =
    existingStream ??
    (await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    }));

  const ctx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
  const moduleUrl = URL.createObjectURL(
    new Blob([RECORDER_WORKLET], { type: "application/javascript" }),
  );
  await ctx.audioWorklet.addModule(moduleUrl);

  const source = ctx.createMediaStreamSource(stream);
  const recorder = new AudioWorkletNode(ctx, "talki-pcm-recorder");
  // Sumidero mudo: algunos navegadores no procesan el worklet si no está en el grafo.
  const mute = ctx.createGain();
  mute.gain.value = 0;

  let lastRms = 0;
  recorder.port.onmessage = (e: MessageEvent<Float32Array>) => {
    const frame = e.data;
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    lastRms = Math.sqrt(sum / frame.length);
    onChunk(float32ToBase64Pcm16(frame));
  };

  source.connect(recorder);
  recorder.connect(mute);
  mute.connect(ctx.destination);

  return {
    getVolume: () => lastRms,
    stop: async () => {
      recorder.port.onmessage = null;
      source.disconnect();
      recorder.disconnect();
      mute.disconnect();
      if (ownStream) stream.getTracks().forEach((t) => t.stop());
      await ctx.close();
      URL.revokeObjectURL(moduleUrl);
    },
  };
}

/**
 * Cola de reproducción para el audio del modelo. Encadena cada fragmento a
 * continuación del anterior para que la voz se oiga continua y sin cortes.
 */
export class PcmPlayer {
  private readonly ctx: AudioContext;
  private nextStartTime = 0;
  private active = new Set<AudioBufferSourceNode>();

  constructor() {
    this.ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
  }

  /** Reanuda el contexto (debe llamarse tras un gesto del usuario). */
  async resume(): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  enqueue(int16: Int16Array): void {
    if (int16.length === 0) return;
    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float[i] = int16[i] / 32768;

    const buffer = this.ctx.createBuffer(1, float.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float, 0);

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    if (this.nextStartTime < now) this.nextStartTime = now;
    src.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;

    this.active.add(src);
    src.onended = () => this.active.delete(src);
  }

  /** Corta la reproducción en curso (cuando el usuario interrumpe al modelo). */
  interrupt(): void {
    for (const src of this.active) {
      try {
        src.stop();
      } catch {
        /* ya terminó */
      }
    }
    this.active.clear();
    this.nextStartTime = 0;
  }

  async close(): Promise<void> {
    this.interrupt();
    await this.ctx.close();
  }
}
