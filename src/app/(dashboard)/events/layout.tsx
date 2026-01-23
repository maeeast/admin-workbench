import Link from "next/link";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Admin Workbench
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <nav aria-label="Dashboard navigation" className="flex items-center gap-2">
              <Button asChild variant="ghost" className="h-8 px-2">
                <Link href="/events">Events</Link>
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Local dashboard</span>
          </div>
        </div>
      </header>

      <div>{children}</div>
    </div>
  );
}
