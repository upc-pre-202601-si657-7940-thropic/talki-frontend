"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { sessions } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import type { Session } from "@/lib/api/types";
import { useUser } from "@/components/user-context";
import { formatDateTime, STATUS_LABEL, STATUS_VARIANT } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SESSION_TYPES = [
  { value: "quick_practice", label: "Práctica rápida" },
  { value: "interview", label: "Entrevista" },
  { value: "thesis_defense", label: "Defensa de tesis" },
  { value: "scenario", label: "Escenario" },
];

export default function SessionsPage() {
  const user = useUser();
  const [items, setItems] = useState<Session[] | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState("quick_practice");

  async function load() {
    try {
      setItems(await sessions.list(user.userId));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error al cargar sesiones";
      toast.error(msg);
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.userId]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setCreating(true);
    try {
      await sessions.create({
        title: String(form.get("title")),
        sessionType: type,
        userId: Number(user.userId),
      });
      toast.success("Sesión creada");
      setOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error al crear sesión";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mis sesiones</h1>
          <p className="text-muted-foreground">
            Tus prácticas de oratoria y sus análisis
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="size-4" /> Nueva sesión
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={onCreate}>
              <DialogHeader>
                <DialogTitle>Nueva sesión</DialogTitle>
                <DialogDescription>
                  Crea una sesión de práctica para empezar.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" name="title" required placeholder="Pitch del proyecto" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={(v) => setType(v ?? "quick_practice")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  Crear
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items === null ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Aún no tienes sesiones. Crea la primera.
                </TableCell>
              </TableRow>
            ) : (
              items.map((s) => (
                <TableRow key={s.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/sessions/${s.id}`} className="hover:underline">
                      {s.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.sessionType}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(s.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
