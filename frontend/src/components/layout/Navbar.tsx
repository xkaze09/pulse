"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/types/org";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":  "Dashboard",
  "/org":        "Org Chart",
  "/processes":  "Business Processes",
  "/workflows":  "Workflows",
  "/admin":      "Admin Panel",
};

const ROLE_BADGE: Record<Role, { label: string; className: string }> = {
  admin:   { label: "Admin",   className: "bg-purple-100 text-purple-700" },
  manager: { label: "Manager", className: "bg-blue-100 text-blue-700" },
  viewer:  { label: "Viewer",  className: "bg-gray-100 text-gray-600" },
};

export function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const title =
    Object.entries(PAGE_TITLES).find(([path]) =>
      pathname === path || pathname.startsWith(`${path}/`)
    )?.[1] ?? "Pulse";

  const badge = user ? ROLE_BADGE[user.role] : null;

  return (
    <header className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {badge && (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      )}
    </header>
  );
}
