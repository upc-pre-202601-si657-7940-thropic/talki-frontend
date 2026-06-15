import { NextRequest, NextResponse } from "next/server";
import { isServiceName, serviceBaseUrl } from "@/lib/config";
import { getToken } from "@/lib/auth";

/**
 * Proxy BFF genérico hacia los microservicios.
 *   /api/gateway/<service>/<path...>?<query>  ->  <serviceBaseUrl>/<path...>?<query>
 *
 * Resuelve el CORS (los backends no lo configuran) y adjunta el JWT desde la
 * cookie httpOnly como `Authorization: Bearer ...`, de modo que el token nunca
 * viaja al JavaScript del navegador.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ service: string; path: string[] }> };

async function handle(req: NextRequest, ctx: RouteContext) {
  const { service, path } = await ctx.params;

  if (!isServiceName(service)) {
    return NextResponse.json(
      { error: `Servicio desconocido: ${service}` },
      { status: 404 },
    );
  }

  const base = serviceBaseUrl(service).replace(/\/$/, "");
  const suffix = (path ?? []).map(encodeURIComponent).join("/");
  const search = req.nextUrl.search;
  const target = `${base}/${suffix}${search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", req.headers.get("accept") ?? "application/json");

  const token = await getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: `No se pudo contactar el servicio '${service}'. ¿Está levantado en ${base}?` },
      { status: 502 },
    );
  }

  const respBody = await upstream.arrayBuffer();
  const respHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) respHeaders.set("content-type", ct);

  return new NextResponse(respBody, {
    status: upstream.status,
    headers: respHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
