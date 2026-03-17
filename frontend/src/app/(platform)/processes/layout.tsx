import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Processes — Pulse",
};

export default function ProcessesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
