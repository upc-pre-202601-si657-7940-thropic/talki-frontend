import type { ServiceName } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ||
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ||
      text ||
      `Error ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

/** Llama a un microservicio a través del proxy BFF (/api/gateway). */
export async function gateway<T>(
  service: ServiceName,
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const clean = path.replace(/^\//, "");
  const url = `/api/gateway/${service}/${clean}${buildQuery(opts.query)}`;
  const res = await fetch(url, {
    method,
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  return parse<T>(res);
}

/** Llama a los endpoints de auth del propio BFF (/api/auth). */
export async function authApi<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const res = await fetch(`/api/auth/${path.replace(/^\//, "")}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parse<T>(res);
}
