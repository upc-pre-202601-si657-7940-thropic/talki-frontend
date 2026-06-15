"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Flame, Trophy } from "lucide-react";
import { gamification } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import type { LeaderboardEntry } from "@/lib/api/types";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";
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

export default function LeaderboardPage() {
  const user = useUser();
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    gamification
      .leaderboard()
      .then(setRows)
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : "Error al cargar el ranking";
        toast.error(msg);
        setRows([]);
      });
  }, []);

  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Trophy className="size-6 text-amber-500" /> Ranking
        </h1>
        <p className="text-muted-foreground">Top de usuarios por XP acumulada</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead className="text-right">XP</TableHead>
              <TableHead className="text-right">Racha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Aún no hay datos de ranking.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => {
                const isMe = String(r.userId) === String(user.userId);
                return (
                  <TableRow key={`${r.userId}-${i}`} className={cn(isMe && "bg-muted/50")}>
                    <TableCell className="text-lg">{medal[i] ?? i + 1}</TableCell>
                    <TableCell className="font-medium">
                      Usuario #{r.userId}
                      {isMe && (
                        <Badge variant="secondary" className="ml-2">
                          Tú
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{r.totalXp}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1">
                        <Flame className="size-4 text-orange-500" />
                        {r.currentStreak}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
