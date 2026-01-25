"use client";

import * as React from "react";
import { Line } from "react-chartjs-2";
import { ensureChartJsRegistered, chartTheme } from "./chartjs";

type Point = { date: string; ok: number; error: number };

function formatLabel(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", timeZone: "UTC" }).format(d);
}

export default function EventsOverTimeChart({
  loading,
  data,
}: {
  loading: boolean;
  data: Point[];
}) {
  ensureChartJsRegistered();

  if (!loading && data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data for this filter.
      </div>
    );
  }

  const labels = data.map((p) => formatLabel(p.date));
  const ok = data.map((p) => p.ok);
  const err = data.map((p) => p.error);

  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: "ok",
            data: ok,
            tension: 0.25,
            borderColor: chartTheme.ok.border,
            backgroundColor: chartTheme.ok.fill,
            pointBackgroundColor: chartTheme.ok.border,
            pointBorderColor: chartTheme.ok.border,
            borderWidth: 2,
            fill: true,
          },
          {
            label: "error",
            data: err,
            tension: 0.25,
            borderColor: chartTheme.error.border,
            backgroundColor: chartTheme.error.fill,
            pointBackgroundColor: chartTheme.error.border,
            pointBorderColor: chartTheme.error.border,
            borderWidth: 2,
            fill: true,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top" },
          tooltip: { enabled: true },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: chartTheme.ticks },
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: chartTheme.ticks },
            grid: { color: chartTheme.grid },
          },
        },
      }}
    />
  );
}
