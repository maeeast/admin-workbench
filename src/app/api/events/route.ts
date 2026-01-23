import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs"

const SortField = z.enum(["occurredAt", "createdAt", "durationMs", "type", "source", "status"]);
const SortDir = z.enum(["asc", "desc"]);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),

  status: z.enum(["ok", "error"]).optional(),
  environment: z.enum(["dev", "staging", "prod"]).optional(),

  type: z.string().min(1).optional(),
  source: z.string().min(1).optional(),

  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),

  q: z.string().min(1).optional(),
  sort: z.string().optional(), // e.g. "occurredAt:desc"
});

function parseQuery(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return querySchema.parse({
    page: sp.get("page") ?? undefined,
    pageSize: sp.get("pageSize") ?? undefined,
    status: sp.get("status") ?? undefined,
    environment: sp.get("environment") ?? undefined,
    type: sp.get("type") ?? undefined,
    source: sp.get("source") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    q: sp.get("q") ?? undefined,
    sort: sp.get("sort") ?? undefined,
  });
}

function parseSort(sort?: string) {
  if (!sort) return { field: "occurredAt" as const, dir: "desc" as const };

  const [fieldRaw, dirRaw] = sort.split(":");
  const field = SortField.safeParse(fieldRaw);
  const dir = SortDir.safeParse(dirRaw);

  if (!field.success || !dir.success) return { field: "occurredAt" as const, dir: "desc" as const };
  return { field: field.data, dir: dir.data };
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(req: NextRequest) {
  try {
    const q = parseQuery(req);
    const { field, dir } = parseSort(q.sort);

    const where: any = {};

    if (q.status) where.status = q.status;
    if (q.environment) where.environment = q.environment;

    if (q.type) where.type = { contains: q.type, mode: "insensitive" };
    if (q.source) where.source = { contains: q.source, mode: "insensitive" };

    if (q.from || q.to) {
      where.occurredAt = {};
      if (q.from) where.occurredAt.gte = q.from;
      if (q.to) where.occurredAt.lte = q.to;
    }

    if (q.q) {
      const or: any[] = [
        { type: { contains: q.q, mode: "insensitive" } },
        { source: { contains: q.q, mode: "insensitive" } },
      ];
      if (looksLikeUuid(q.q)) or.push({ id: q.q });
      where.OR = or;
    }

    const skip = (q.page - 1) * q.pageSize;

    const [total, data] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        orderBy: { [field]: dir },
        skip,
        take: q.pageSize,
        select: {
          id: true,
          occurredAt: true,
          environment: true,
          type: true,
          status: true,
          source: true,
          durationMs: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      data,
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Bad Request", detail: err?.message ?? "Invalid query" },
      { status: 400 }
    );
  }
}
