/** Análisis local alineado con filler-detection + scoring-service (MVP). */

const SPANISH_FILLERS = [
  "este",
  "o sea",
  "eh",
  "básicamente",
  "o sea que",
  "bueno",
  "pues",
  "entonces",
  "verdad",
  "digamos",
  "como que",
  "osea",
  "um",
  "mmm",
];

export interface VoiceScores {
  fluency: number;
  clarity: number;
  volume: number;
  vocabulary: number;
  confidence: number;
  overall: number;
}

export interface AiFeedbackItem {
  feedbackType: string;
  label: string;
  content: string;
  score?: number;
}

export interface PracticeAnalysis {
  wordCount: number;
  wordsPerMinute: number;
  durationSeconds: number;
  totalFillers: number;
  fillersByType: Record<string, number>;
  scores: VoiceScores;
  items: AiFeedbackItem[];
}

function detectFillers(text: string): Record<string, number> {
  const normalized = text.toLowerCase();
  const counts: Record<string, number> = {};
  for (const filler of SPANISH_FILLERS) {
    const re = new RegExp(`\\b${filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const matches = normalized.match(re);
    if (matches?.length) counts[filler] = matches.length;
  }
  return counts;
}

function totalFillers(map: Record<string, number>): number {
  return Object.values(map).reduce((a, b) => a + b, 0);
}

function fluencyScore(wpm: number, fillerCount: number): number {
  const base = wpm >= 120 && wpm <= 160 ? 100 : wpm >= 100 ? 80 : 60;
  return Math.max(0, base - fillerCount * 2);
}

function clarityScore(wpm: number): number {
  if (wpm >= 100 && wpm <= 150) return 85;
  if (wpm >= 80) return 65;
  return 50;
}

function vocabularyScore(fillerCount: number): number {
  return Math.max(0, 100 - fillerCount * 3);
}

function confidenceScore(): number {
  return 75;
}

function volumeScore(): number {
  return 70;
}

function buildMessages(
  transcript: string,
  wpm: number,
  durationSeconds: number,
  fillers: Record<string, number>,
  scores: VoiceScores,
): AiFeedbackItem[] {
  const total = totalFillers(fillers);
  const topFillers = Object.entries(fillers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w, n]) => `«${w}» (${n})`)
    .join(", ");

  const items: AiFeedbackItem[] = [
    {
      feedbackType: "ai_resumen",
      label: "Resumen",
      score: scores.overall,
      content:
        scores.overall >= 80
          ? `¡Muy bien! Tu desempeño general es sólido (${scores.overall}/100). Mantené un ritmo constante y cerrá cada idea con una frase clara.`
          : scores.overall >= 60
            ? `Buen intento (${scores.overall}/100). Hay margen de mejora en fluidez y muletillas; repetí el ejercicio enfocándote en pausas breves.`
            : `Sesión de práctica útil (${scores.overall}/100). Priorizá hablar más despacio y reducir muletillas antes de la próxima exposición.`,
    },
  ];

  if (total === 0) {
    items.push({
      feedbackType: "ai_muletillas",
      label: "Muletillas",
      score: scores.vocabulary,
      content:
        "No detecté muletillas frecuentes. Excelente control del lenguaje oral en esta toma.",
    });
  } else {
    items.push({
      feedbackType: "ai_muletillas",
      label: "Muletillas",
      score: scores.vocabulary,
      content: `Detecté ${total} muletilla${total === 1 ? "" : "s"}${topFillers ? `: ${topFillers}` : ""}. Reemplazalas con una pausa de 1 segundo: el silencio transmite más seguridad que un «este».`,
    });
  }

  if (wpm > 160) {
    items.push({
      feedbackType: "ai_velocidad",
      label: "Ritmo",
      score: scores.clarity,
      content: `Hablaste rápido (${wpm} PPM). Bajá el ritmo a 120–150 PPM para que el auditorio procese tus ideas.`,
    });
  } else if (wpm < 90 && durationSeconds > 5) {
    items.push({
      feedbackType: "ai_velocidad",
      label: "Ritmo",
      score: scores.clarity,
      content: `Tu ritmo es lento (${wpm} PPM). Aumentá un poco la energía vocal para mantener la atención.`,
    });
  } else {
    items.push({
      feedbackType: "ai_velocidad",
      label: "Ritmo",
      score: scores.clarity,
      content: `Ritmo adecuado (${wpm} PPM). Estás en el rango recomendado para exposiciones académicas.`,
    });
  }

  items.push({
    feedbackType: "ai_fluidez",
    label: "Fluidez",
    score: scores.fluency,
    content:
      scores.fluency >= 80
        ? "Tu discurso fluye con naturalidad. Seguí practicando con escenarios de mayor presión (entrevista o defensa)."
        : "Trabajá frases más cortas y conectores simples («primero», «en resumen») para ganar fluidez.",
  });

  if (!transcript.trim()) {
    return [
      {
        feedbackType: "ai_resumen",
        label: "Sin datos",
        content:
          "No hubo transcripción para analizar. Grabá de nuevo hablando 5–10 segundos en Chrome o Edge.",
      },
    ];
  }

  return items;
}

export function analyzePractice(
  transcript: string,
  durationSeconds: number,
): PracticeAnalysis {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const wpm =
    durationSeconds > 0 ? Math.round((wordCount / durationSeconds) * 60) : 0;
  const fillersByType = detectFillers(transcript);
  const total = totalFillers(fillersByType);

  const fluency = fluencyScore(wpm, total);
  const clarity = clarityScore(wpm);
  const volume = volumeScore();
  const vocabulary = vocabularyScore(total);
  const confidence = confidenceScore();
  const overall = Math.round((fluency + clarity + volume + vocabulary + confidence) / 5);

  const scores: VoiceScores = {
    fluency,
    clarity,
    volume,
    vocabulary,
    confidence,
    overall,
  };

  return {
    wordCount,
    wordsPerMinute: wpm,
    durationSeconds,
    totalFillers: total,
    fillersByType,
    scores,
    items: buildMessages(transcript, wpm, durationSeconds, fillersByType, scores),
  };
}

export function isAiFeedbackType(type: string): boolean {
  return type.startsWith("ai_");
}

export const AI_FEEDBACK_LABELS: Record<string, string> = {
  ai_resumen: "Resumen",
  ai_muletillas: "Muletillas",
  ai_velocidad: "Ritmo",
  ai_fluidez: "Fluidez",
  ai_volumen: "Volumen",
};
