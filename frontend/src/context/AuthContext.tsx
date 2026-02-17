"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "@/types/org";
import { clearStoredAuth, getStoredAuth, setStoredAuth } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (u: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initializer — runs synchronously on client mount, reads localStorage once
  const [user, setUser] = useState<AuthUser | null>(() =>
    typeof window !== "undefined" ? getStoredAuth() : null
  );
  // With sync initialization there is no async loading phase
  const loading = false;

  function login(u: AuthUser) {
    setStoredAuth(u);
    setUser(u);
  }

  function logout() {
    clearStoredAuth();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
