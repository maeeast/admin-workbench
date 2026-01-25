import { NextResponse } from "next/server";
import { faker } from "@faker-js/faker";
import { Environment, EventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

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
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow local/manual runs if you haven't set it
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function utcDateKey(d: Date) {
  // Daily idempotency key in UTC: YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!requireCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Daily cron: one key per day prevents double inserts if Vercel retries
  const key = `freshen-events:${utcDateKey(now)}`;

  const minBatch = Number(process.env.CRON_EVENT_BATCH_MIN ?? "50");
const maxBatch = Number(process.env.CRON_EVENT_BATCH_MAX ?? "95");
const batch = faker.number.int({ min: minBatch, max: maxBatch });
  const retentionDays = Number(process.env.CRON_RETENTION_DAYS ?? "90");
  const windowHours = Number(process.env.CRON_WINDOW_HOURS ?? "24");

  const envs: Environment[] = [Environment.dev, Environment.staging, Environment.prod];

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const from = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  // Generate once (so we can insert in the transaction)
  const data: Prisma.EventCreateManyInput[] = Array.from({ length: batch }).map(() => {
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Idempotency guard
      try {
        await tx.cronRun.create({ data: { key } });
      } catch {
        return { skipped: true as const, deleted: 0, inserted: 0 };
      }

      // Retention cleanup
      const del = await tx.event.deleteMany({ where: { occurredAt: { lt: cutoff } } });

      // Insert new “fresh” events
      const ins = await tx.event.createMany({ data });

      return { skipped: false as const, deleted: del.count, inserted: ins.count };
    });

    return NextResponse.json({
      ok: true,
      key,
      skipped: result.skipped,
      inserted: result.inserted,
      deleted: result.deleted,
      retentionDays,
      windowHours,
      range: { from: from.toISOString(), to: now.toISOString() },
    });
  } catch (e) {
    // Keep error body readable in Vercel logs
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message, key }, { status: 500 });
  }
}
