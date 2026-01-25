import { Suspense } from "react";
import DashboardClient from "@/components/dashboard/DashboardClient";

function DashboardLoading() {
  return (
    <div className="rounded border p-6 text-sm text-muted-foreground">
      Loading dashboard…
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          KPI cards and charts powered by aggregated metrics. Filters persist in the URL.
        </p>
      </div>

      <Suspense fallback={<DashboardLoading />}>
        <DashboardClient />
      </Suspense>
    </main>
  );
}
