import { Suspense } from "react";
import EventsTable from "@/components/tables/EventsTable";



function EventsLoading() {
  return (
    <div className="rounded border p-6 text-sm text-muted-foreground">
      Loading events…
    </div>
  );
}

export default function EventsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Server-side pagination, filtering, and sorting. Table state persists in the URL.
        </p>
      </div>

      <Suspense fallback={<EventsLoading />}>
        <EventsTable />
      </Suspense>
    </main>
  );
}
