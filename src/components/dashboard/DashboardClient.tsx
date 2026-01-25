"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EventsOverTimeChart from "@/components/charts/EventsOverTimeChart";
import ErrorsByTypeChart from "@/components/charts/ErrorsByTypeChart";

type Env = "all" | "dev" | "staging" | "prod";
type Range = "7d" | "30d";

type SummaryResponse = {
  range: { from: string; to: string };
  kpis: {
    total: number;
    errors: number;
    errorRate: number; // 0..1
    p95DurationMs: number | null;
  };
  series: {
    byDay: Array<{ date: string; ok: number; error: number }>;
    errorsByType: Array<{ type: string; count: number }>;
  };
};

function safeEnv(v: string | null): Env {
  if (v === "dev" || v === "staging" || v === "prod" || v === "all") return v;
  return "all";
}

function safeRange(v: string | null): Range {
  if (v === "7d" || v === "30d") return v;
  return "30d";
}

function formatPct(x: number) {
  return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(x);
}

function formatNumber(x: number) {
  return new Intl.NumberFormat().format(x);
}

export default function DashboardClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const env = safeEnv(searchParams.get("env"));
  const range = safeRange(searchParams.get("range"));

  const [data, setData] = React.useState<SummaryResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const updateUrl = React.useCallback(
    (next: Partial<Record<"env" | "range", string | undefined>>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [k, v] of Object.entries(next)) {
        if (!v || v === "all") params.delete(k);
        else params.set(k, v);
      }

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams();
        qs.set("range", range);
        if (env !== "all") qs.set("env", env);

        const res = await fetch(`/api/events/summary?${qs.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed (${res.status})`);
        }

        const json = (await res.json()) as SummaryResponse;
        setData(json);
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        setError((e as Error).message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    run();
    return () => controller.abort();
  }, [env, range]);

  const kpis = data?.kpis;

  return (
    <Card className="p-4">
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="w-full md:w-44">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Range</label>
            <Select value={range} onValueChange={(v) => updateUrl({ range: v })}>
              <SelectTrigger aria-label="Select date range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-44">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Environment</label>
            <Select value={env} onValueChange={(v) => updateUrl({ env: v === "all" ? undefined : v })}>
              <SelectTrigger aria-label="Filter by environment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="dev">dev</SelectItem>
                <SelectItem value="staging">staging</SelectItem>
                <SelectItem value="prod">prod</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={() => router.replace(pathname)}>
            Reset
          </Button>
        </div>

        <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-end">
          <div className="text-sm text-muted-foreground">
            {loading ? "Loading…" : data ? `Range: ${data.range.from} → ${data.range.to}` : "—"}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-medium">Couldn’t load dashboard</div>
          <div className="mt-1 break-words">{error}</div>
          <div className="mt-3">
            <Button variant="outline" onClick={() => router.refresh()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border p-3">
          <div className="text-xs font-medium text-muted-foreground">Total events</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{kpis ? formatNumber(kpis.total) : "—"}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs font-medium text-muted-foreground">Errors</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{kpis ? formatNumber(kpis.errors) : "—"}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs font-medium text-muted-foreground">Error rate</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{kpis ? formatPct(kpis.errorRate) : "—"}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-xs font-medium text-muted-foreground">P95 duration</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {kpis?.p95DurationMs != null ? `${formatNumber(Math.round(kpis.p95DurationMs))} ms` : "—"}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border p-3">
          <div className="mb-2 text-sm font-medium">Events over time</div>
          <div className="h-[320px]">
            <EventsOverTimeChart loading={loading} data={data?.series.byDay ?? []} />
          </div>
        </div>

        <div className="rounded border p-3">
          <div className="mb-2 text-sm font-medium">Errors by type</div>
          <div className="h-[320px]">
            <ErrorsByTypeChart loading={loading} data={data?.series.errorsByType ?? []} />
          </div>
        </div>
      </div>
    </Card>
  );
}
