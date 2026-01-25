import Link from "next/link";
import type { ReactNode } from "react";
import DashboardNav from "@/components/dashboard/DashboardNav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Admin Workbench
          </Link>

          <DashboardNav />
        </div>
      </header>

      {children}
    </div>
  );
}
