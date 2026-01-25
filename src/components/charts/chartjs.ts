"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

let registered = false;

export const chartTheme = {
  ok: {
    border: "rgb(34, 197, 94)",
    fill: "rgba(34, 197, 94, 0.18)",
  },
  error: {
    border: "rgb(239, 68, 68)",
    fill: "rgba(239, 68, 68, 0.18)",
  },
  grid: "rgba(148, 163, 184, 0.9)",
  ticks: "rgba(100, 116, 139, 0.9)",
};

export function ensureChartJsRegistered() {
  if (registered) return;

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend,
    Filler,
  );

  registered = true;
}
