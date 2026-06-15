"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, MessageSquarePlus } from "lucide-react";
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
      const msg = err instanceof ApiError ? err.message : "No se pudo finalizar";
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
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No se encontró la sesión.</p>
        <Button render={<Link href="/sessions" />} variant="outline">
          <ArrowLeft className="size-4" /> Volver
        </Button>
      </div>
    );
  }

  const canFinalize = session.status === "RECORDING" || session.status === "DRAFT";

  return (
    <div className="space-y-6">
      <Button render={<Link href="/sessions" />} variant="ghost" size="sm" className="-ml-2">
        <ArrowLeft className="size-4" /> Sesiones
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{session.title}</CardTitle>
            <CardDescription>
              {session.sessionType} · creada {formatDateTime(session.createdAt)}
            </CardDescription>
          </div>
          <Badge variant={STATUS_VARIANT[session.status] ?? "outline"}>
            {STATUS_LABEL[session.status] ?? session.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-medium">#{session.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Finalizada</dt>
              <dd className="font-medium">{formatDateTime(session.finalizedAt)}</dd>
            </div>
          </dl>
          {canFinalize && (
            <Button onClick={onFinalize} disabled={finalizing}>
              {finalizing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Finalizar y analizar
            </Button>
          )}
        </CardContent>
      </Card>

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
              {savingFb ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="size-4" />
              )}
              Agregar feedback
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
