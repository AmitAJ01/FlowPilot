import type { Metadata } from "next";
import "./globals.css";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const metadata: Metadata = {
  title: "FlowPilot — Agentic Browser Workflow Automation",
  description: "Natural-language browser workflow automation platform with deterministic evaluation benchmarks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090a0f] text-slate-100 antialiased min-h-screen">
        <DashboardShell>
          {children}
        </DashboardShell>
      </body>
    </html>
  );
}
