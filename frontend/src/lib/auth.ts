import type { AuthUser } from "@/types/org";

const KEY = "pulse_auth";

export function getStoredAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(user: AuthUser): void {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(KEY);
}

export async function loginUser(
  username: string,
  password: string
): Promise<AuthUser> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }
  );
  if (!res.ok) throw new Error("Invalid credentials");
  const data = (await res.json()) as AuthUser;
  setStoredAuth(data);
  return data;
}
