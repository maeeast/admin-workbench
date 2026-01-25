import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const QuerySchema = z.object({
  range: z.enum(["7d", "30d"]).default("30d"),
  env: z.enum(["dev", "staging", "prod"]).optional(),
});

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function addDaysUtc(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const parsed = QuerySchema.safeParse({
    range: url.searchParams.get("range") ?? undefined,
    env: url.searchParams.get("env") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { range, env } = parsed.data;

  const days = range === "7d" ? 7 : 30;
  const now = new Date();
  const to = now;
  const from = addDaysUtc(startOfUtcDay(now), -(days - 1)); // inclusive start (7d includes today)

  const envFilter =
    env ? Prisma.sql`AND "environment" = ${env}` : Prisma.empty;

  // KPI query (total, errors, p95 duration)
  const kpiRows = await prisma.$queryRaw<
    Array<{ total: number; errors: number; p95_duration_ms: number | null }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN "status"::text = 'error' THEN 1 ELSE 0 END)::int AS errors,
      CASE
        WHEN COUNT(*) = 0 THEN NULL
        ELSE percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::float8
      END AS p95_duration_ms
    FROM "Event"
    WHERE "occurredAt" >= ${from} AND "occurredAt" <= ${to}
    ${envFilter};
  `);

  const total = kpiRows[0]?.total ?? 0;
  const errors = kpiRows[0]?.errors ?? 0;
  const p95DurationMs = kpiRows[0]?.p95_duration_ms ?? null;

  // byDay: ok/error counts per UTC day
  const dayRows = await prisma.$queryRaw<
    Array<{ day: string; status: string; count: number }>
  >(Prisma.sql`
    SELECT
      date_trunc('day', timezone('UTC', "occurredAt"))::date::text AS day,
      "status"::text AS status,
      COUNT(*)::int AS count
    FROM "Event"
    WHERE "occurredAt" >= ${from} AND "occurredAt" <= ${to}
    ${envFilter}
    GROUP BY day, status
    ORDER BY day ASC;
  `);

  // Fill missing days with 0s
  const map = new Map<string, { ok: number; error: number }>();
  for (const r of dayRows) {
    const key = r.day; // YYYY-MM-DD
    const cur = map.get(key) ?? { ok: 0, error: 0 };
    if (r.status === "ok") cur.ok = r.count;
    if (r.status === "error") cur.error = r.count;
    map.set(key, cur);
  }

  const byDay: Array<{ date: string; ok: number; error: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = addDaysUtc(from, i);
    const key = toIsoDate(d);
    const counts = map.get(key) ?? { ok: 0, error: 0 };
    byDay.push({ date: key, ok: counts.ok, error: counts.error });
  }

  // errorsByType: top 8 error types
  const errorsByType = await prisma.$queryRaw<Array<{ type: string; count: number }>>(
    Prisma.sql`
      SELECT "type"::text AS type, COUNT(*)::int AS count
      FROM "Event"
      WHERE "occurredAt" >= ${from} AND "occurredAt" <= ${to}
      ${envFilter}
      AND "status"::text = 'error'
      GROUP BY "type"
      ORDER BY count DESC
      LIMIT 8;
    `,
  );

  const errorRate = total > 0 ? errors / total : 0;

  return NextResponse.json({
    range: { from: toIsoDate(from), to: toIsoDate(startOfUtcDay(now)) },
    kpis: { total, errors, errorRate, p95DurationMs },
    series: { byDay, errorsByType },
  });
}
