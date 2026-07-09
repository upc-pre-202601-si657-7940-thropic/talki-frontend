import { Sparkles } from "lucide-react";
import type { AiFeedbackItem } from "@/lib/coach/aiFeedback";
import { AI_FEEDBACK_LABELS } from "@/lib/coach/aiFeedback";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AiFeedbackPanelProps {
  items: (AiFeedbackItem & { createdAt?: string })[];
  overallScore?: number | null;
  emptyMessage?: string;
}

export function AiFeedbackPanel({
  items,
  overallScore = null,
  emptyMessage = "Grabá una práctica y el coach IA te dará consejos al detener.",
}: AiFeedbackPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Feedback del coach IA
            </CardTitle>
            <CardDescription>
              Retroalimentación automática sobre tu oratoria (muletillas, ritmo y fluidez).
            </CardDescription>
          </div>
          {overallScore !== null && overallScore !== undefined && (
            <Badge className="px-3 py-1 text-sm">{overallScore}/100</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.feedbackType}
                className="rounded-lg border border-primary/10 bg-primary/5 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary">
                    {AI_FEEDBACK_LABELS[item.feedbackType] ?? item.label}
                  </Badge>
                  {item.createdAt && (
                    <span className="text-xs text-muted-foreground">{item.createdAt}</span>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{item.content}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
