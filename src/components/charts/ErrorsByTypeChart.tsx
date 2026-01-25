"use client";

import * as React from "react";
import { Bar } from "react-chartjs-2";
import { ensureChartJsRegistered, chartTheme } from "./chartjs";

type Row = { type: string; count: number };

export default function ErrorsByTypeChart({
  loading,
  data,
}: {
  loading: boolean;
  data: Row[];
}) {
  ensureChartJsRegistered();

  if (!loading && data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No errors in this range.
      </div>
    );
  }

  const labels = data.map((r) => r.type);
  const values = data.map((r) => r.count);

  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: "errors",
            data: values,
            backgroundColor: chartTheme.error.fill,
            borderColor: chartTheme.error.border,
            borderWidth: 2,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true },
        },
        scales: {
          x: {
            ticks: { color: chartTheme.ticks, maxRotation: 45, minRotation: 0 },
            grid: { display: false },
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
