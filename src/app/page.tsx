import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Admin Workbench</h1>
        <p className="text-sm text-muted-foreground">
          A demo admin dashboard with server-side pagination, filtering, and sorting.
        </p>
      </header>

      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-medium">Events</h2>
            <p className="text-sm text-muted-foreground">
              View event telemetry with URL-backed table state and a details drawer.
            </p>
          </div>

          <Button asChild>
            <Link href="/events" aria-label="Go to Events">
              Open Events
            </Link>
          </Button>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tip: try adding query params like <code className="rounded bg-muted px-1 py-0.5">?status=error</code> on the
        Events page to see server-side filters in action.
      </p>
    </main>
  );
}
