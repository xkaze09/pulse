"use client";

import { useRouter } from "next/navigation";
import { Network, GitBranch, Workflow, Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/types/org";

const CARDS = [
  {
    href: "/org",
    title: "Org Chart",
    description: "Explore the organizational hierarchy, departments, and teams.",
    Icon: Network,
    color: "bg-blue-50 text-blue-600 border-blue-100",
  },
  {
    href: "/processes",
    title: "Business Processes",
    description: "Understand end-to-end business workflows and process flows.",
    Icon: GitBranch,
    color: "bg-green-50 text-green-600 border-green-100",
  },
  {
    href: "/workflows",
    title: "Workflows",
    description: "View engineering and operational workflow step diagrams.",
    Icon: Workflow,
    color: "bg-purple-50 text-purple-600 border-purple-100",
  },
];

const ROLE_ACCESS: Record<Role, string[]> = {
  admin:   ["Public nodes", "Manager nodes", "Admin nodes", "CRUD operations"],
  manager: ["Public nodes", "Manager nodes"],
  viewer:  ["Public nodes"],
};

export function DashboardView() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">
        Welcome back, {user?.name ?? "User"}
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        Explore org charts, business processes, and workflows.
      </p>

      {/* Canvas cards */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CARDS.map(({ href, title, description, Icon, color }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            className="group rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className={`mb-4 inline-flex rounded-xl border p-3 ${color}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mb-1 text-base font-semibold text-gray-900 group-hover:text-blue-700">
              {title}
            </h2>
            <p className="text-sm text-gray-500">{description}</p>
          </button>
        ))}
      </div>

      {/* Access level */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">
            Your Access Level
          </h3>
        </div>
        {user && (
          <ul className="flex flex-col gap-1.5">
            {ROLE_ACCESS[user.role].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
