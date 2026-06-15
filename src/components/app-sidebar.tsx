"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Mic,
  Trophy,
  ListVideo,
  LogOut,
  Settings,
  Plus,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { auth, sessions as sessionsApi } from "@/lib/api/services";
import type { Session } from "@/lib/api/types";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sessions", label: "Sesiones", icon: ListVideo },
  { href: "/coach", label: "Coach", icon: Mic },
  { href: "/leaderboard", label: "Ranking", icon: Trophy },
];

export function AppSidebar() {
  const user = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [recent, setRecent] = useState<Session[] | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    sessionsApi
      .list(user.userId)
      .then((list) => {
        if (!alive) return;
        const sorted = [...list].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setRecent(sorted.slice(0, 12));
      })
      .catch(() => alive && setRecent([]));
    return () => {
      alive = false;
    };
    // refetch al navegar (p. ej. tras crear una sesión)
  }, [user.userId, pathname]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await auth.logout();
      toast.success("Sesión cerrada");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("No se pudo cerrar sesión");
      setLoggingOut(false);
    }
  }

  const initial = user.email.charAt(0).toUpperCase();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-muted/30">
      {/* Marca */}
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          T
        </span>
        <span className="font-semibold">Talki</span>
      </div>

      {/* Acción principal */}
      <div className="px-3">
        <Link
          href="/sessions"
          className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Plus className="size-4" /> Nueva sesión
        </Link>
      </div>

      {/* Navegación */}
      <nav className="mt-3 space-y-1 px-3">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/sessions" && pathname.startsWith(`${href}/`)) ||
            (href === "/sessions" && pathname === "/sessions");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sesiones recientes */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col px-3">
        <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
          Sesiones recientes
        </p>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {recent === null ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : recent.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Aún no hay sesiones.</p>
          ) : (
            recent.map((s) => {
              const active = pathname === `/sessions/${s.id}`;
              return (
                <Link
                  key={s.id}
                  href={`/sessions/${s.id}`}
                  title={s.title}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <MessageSquare className="size-3.5 shrink-0" />
                  <span className="truncate">{s.title}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Cuenta */}
      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
              />
            }
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.email}</span>
              <span className="block text-xs text-muted-foreground">Mi cuenta</span>
            </span>
            <Settings className="size-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
