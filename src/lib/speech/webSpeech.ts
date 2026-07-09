/** Web Speech API (Chrome/Edge). Safari no la soporta de forma fiable. */

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export function getSpeechRecognition(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isWebSpeechAvailable(): boolean {
  return getSpeechRecognition() !== null;
}

/** Al detener, Chrome suele dejar texto solo en resultados interim (sin isFinal). */
export function mergeInterimTranscript(accumulated: string, interim: string): string {
  const pending = interim.trim();
  if (!pending) return accumulated;
  const base = accumulated.trimEnd();
  return base ? `${base} ${pending} ` : `${pending} `;
}

export function speechErrorMessage(error: string): string {
  switch (error) {
    case "not-allowed":
      return "Permiso de micrófono denegado. Habilítalo en el navegador.";
    case "no-speech":
      return "No se detectó voz. Hablá más cerca del micrófono.";
    case "network":
      return "La transcripción requiere conexión (Web Speech de Google).";
    case "aborted":
      return "Transcripción interrumpida.";
    default:
      return `Error de transcripción (${error}). Usá Chrome o Edge.`;
  }
}
