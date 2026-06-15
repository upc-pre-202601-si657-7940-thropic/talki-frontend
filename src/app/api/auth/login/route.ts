import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, serviceBaseUrl } from "@/lib/config";
import { userFromToken } from "@/lib/jwt";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let payload: { email?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const res = await fetch(`${serviceBaseUrl("identity")}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: payload.email, password: payload.password }),
    cache: "no-store",
  }).catch(() => null);

  if (!res) {
    return NextResponse.json(
      { error: "No se pudo contactar identity-service (¿levantado en :8081?)" },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Credenciales inválidas" },
      { status: res.status === 401 || res.status === 403 ? 401 : res.status },
    );
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    return NextResponse.json({ error: "Respuesta sin token" }, { status: 502 });
  }

  const user = userFromToken(data.token);
  if (!user) {
    return NextResponse.json({ error: "Token inválido" }, { status: 502 });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });

  return NextResponse.json({ user });
}
