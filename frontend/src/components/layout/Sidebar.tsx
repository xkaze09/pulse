"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Network,
  GitBranch,
  Workflow,
  ShieldCheck,
  LogOut,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/types/org";

const ROLE_BADGE: Record<Role, { label: string; className: string }> = {
  admin:   { label: "Admin",   className: "bg-purple-100 text-purple-700" },
  manager: { label: "Manager", className: "bg-blue-100 text-blue-700" },
  viewer:  { label: "Viewer",  className: "bg-gray-100 text-gray-600" },
};

const NAV_LINKS = [
  { href: "/dashboard",  label: "Dashboard",          Icon: LayoutDashboard },
  { href: "/org",        label: "Org Chart",           Icon: Network },
  { href: "/processes",  label: "Business Processes",  Icon: GitBranch },
  { href: "/workflows",  label: "Workflows",            Icon: Workflow },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const badge = user ? ROLE_BADGE[user.role] : null;

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gray-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-bold text-gray-900">Pulse</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAV_LINKS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}

          {user?.role === "admin" && (
            <li>
              <Link
                href="/admin"
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === "/admin"
                    ? "bg-purple-50 text-purple-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                Admin
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-gray-100 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
            {user?.name?.[0] ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-gray-900">
              {user?.name}
            </p>
            {badge && (
              <span
                className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}
              >
                {badge.label}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
