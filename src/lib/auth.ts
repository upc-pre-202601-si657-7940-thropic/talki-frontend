import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/config";
import { userFromToken, type TalkiUser } from "@/lib/jwt";

/** Lee el JWT crudo de la cookie httpOnly (solo servidor). */
export async function getToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Usuario actual derivado del JWT, o null si no hay sesión válida. */
export async function getCurrentUser(): Promise<TalkiUser | null> {
  const token = await getToken();
  if (!token) return null;
  return userFromToken(token);
}
