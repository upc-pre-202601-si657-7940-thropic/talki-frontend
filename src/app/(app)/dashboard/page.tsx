"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Clock,
  Flame,
  Star,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { gamification, health, progress } from "@/lib/api/services";
import type { ProgressDashboard, ServiceHealth, Streaks } from "@/lib/api/types";
import { useUser } from "@/components/user-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <span className="text-2xl font-semibold">{value}</span>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const user = useUser();
  const [dash, setDash] = useState<ProgressDashboard | null>(null);
  const [streaks, setStreaks] = useState<Streaks | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      progress.dashboard(user.userId),
      gamification.streaks(user.userId),
      health.filler(),
      health.scoring(),
    ]).then(([d, s, f, sc]) => {
      if (!alive) return;
      if (d.status === "fulfilled") setDash(d.value);
      if (s.status === "fulfilled") setStreaks(s.value);
      const up: ServiceHealth[] = [];
      if (f.status === "fulfilled") up.push(f.value);
      if (sc.status === "fulfilled") up.push(sc.value);
      setServices(up);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [user.userId]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Hola 👋</h1>
        <p className="text-muted-foreground">{user.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Sesiones"
          value={dash?.totalSessions ?? 0}
          icon={Activity}
          loading={loading}
        />
        <StatCard
          label="Minutos practicados"
          value={dash?.totalMinutes ?? 0}
          icon={Clock}
          loading={loading}
        />
        <StatCard
          label="Puntaje promedio"
          value={dash ? dash.averageScore.toFixed(1) : "0.0"}
          icon={TrendingUp}
          loading={loading}
        />
        <StatCard
          label="Mejor puntaje"
          value={dash?.bestScore ?? 0}
          icon={Star}
          loading={loading}
        />
        <StatCard
          label="Racha actual"
          value={streaks?.currentStreak ?? dash?.currentStreak ?? 0}
          icon={Flame}
          loading={loading}
        />
        <StatCard
          label="XP total"
          value={streaks?.totalXp ?? 0}
          icon={Trophy}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado de los servicios</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {loading ? (
            <Skeleton className="h-6 w-40" />
          ) : services.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No se pudo contactar los servicios de análisis.
            </span>
          ) : (
            services.map((s) => (
              <Badge key={s.service} variant="secondary" className="gap-1.5">
                <span className="size-2 rounded-full bg-green-500" />
                {s.service}: {s.status}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
