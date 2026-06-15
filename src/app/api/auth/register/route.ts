import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, serviceBaseUrl } from "@/lib/config";
import { userFromToken } from "@/lib/jwt";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    password?: string;
    username?: string;
    academicSegment?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const identity = serviceBaseUrl("identity");

  const regRes = await fetch(`${identity}/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      username: body.username,
      academicSegment: body.academicSegment ?? "ciclos_6_10",
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!regRes) {
    return NextResponse.json(
      { error: "No se pudo contactar identity-service (¿levantado en :8081?)" },
      { status: 502 },
    );
  }

  if (!regRes.ok) {
    const msg = await regRes.text().catch(() => "");
    return NextResponse.json(
      { error: msg || "No se pudo registrar el usuario (¿email ya existe?)" },
      { status: regRes.status },
    );
  }

  // Auto-login para obtener el JWT y dejar la sesión iniciada.
  const loginRes = await fetch(`${identity}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  }).catch(() => null);

  if (!loginRes || !loginRes.ok) {
    // Registro OK pero no se pudo iniciar sesión: que el usuario use el login.
    return NextResponse.json({ registered: true, autoLogin: false });
  }

  const data = (await loginRes.json()) as { token?: string };
  const user = data.token ? userFromToken(data.token) : null;
  if (!data.token || !user) {
    return NextResponse.json({ registered: true, autoLogin: false });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return NextResponse.json({ registered: true, autoLogin: true, user });
}
