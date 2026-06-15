"use client";

import { createContext, useContext } from "react";
import type { AuthUser } from "@/lib/api/types";

const UserContext = createContext<AuthUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): AuthUser {
  const user = useContext(UserContext);
  if (!user) {
    throw new Error("useUser debe usarse dentro de <UserProvider>");
  }
  return user;
}
