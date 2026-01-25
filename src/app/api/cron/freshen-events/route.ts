import { NextResponse } from "next/server";
import { faker } from "@faker-js/faker";
import { Environment, EventStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma"; // adjust if your export differs

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPES = [
  "report.generated",
  "user.login",
  "user.invited",
  "export.created",
  "sync.completed",
  "sync.failed",
] as const;

const SOURCES = ["web", "api", "worker", "cron", "importer"] as const;

function pick<T>(arr: readonly T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function requireCronAuth(req: Request) {
  // Vercel can automatically send CRON_SECRET as an Authorization header :contentReference[oaicite:3]{index=3}
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow local/manual runs if you haven't set it
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!requireCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Idempotency key per hour (cron invocations can repeat; this prevents double-inserts) :contentReference[oaicite:4]{index=4}
  const now = new Date();
  const hourKey = `freshen-events:${now.toISOString().slice(0, 13)}`; // YYYY-MM-DDTHH

  try {
    await prisma.cronRun.create({ data: { key: hourKey } });
  } catch {
    return NextResponse.json({ ok: true, skipped: true, key: hourKey });
  }

  const batch = Number(process.env.CRON_EVENT_BATCH ?? "120");
  const envs: Environment[] = [Environment.dev, Environment.staging, Environment.prod];

  // Keep DB small: delete anything older than 90 days
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  await prisma.event.deleteMany({ where: { occurredAt: { lt: cutoff } } });

  // Add “fresh” events from the last ~2 hours
  const from = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const data = Array.from({ length: batch }).map(() => {
    const occurredAt = faker.date.between({ from, to: now });
    const status = faker.datatype.boolean(0.82) ? EventStatus.ok : EventStatus.error;

    return {
      occurredAt,
      environment: pick(envs),
      type: pick(EVENT_TYPES),
      status,
      source: pick(SOURCES),
      durationMs: faker.number.int({ min: 10, max: 3500 }),
      payload: {
        requestId: faker.string.uuid(),
        userAgent: faker.internet.userAgent(),
        tags: faker.helpers.arrayElements(["billing", "reports", "auth", "sync", "ui"], { min: 1, max: 3 }),
        errorCode: status === EventStatus.error ? pick(["E_TIMEOUT", "E_BAD_INPUT", "E_DOWNSTREAM"] as const) : null,
      },
    };
  });

  await prisma.event.createMany({ data });

  return NextResponse.json({
    ok: true,
    inserted: batch,
    deletedOlderThan: cutoff.toISOString(),
    key: hourKey,
  });
}
