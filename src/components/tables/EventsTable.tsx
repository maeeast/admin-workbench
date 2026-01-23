"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Environment = "dev" | "staging" | "prod";
type EventStatus = "ok" | "error";

type EventRow = {
  id: string;
  occurredAt: string;
  environment: Environment;
  type: string;
  status: EventStatus;
  source: string;
  durationMs: number;
  createdAt: string;
};

type ListResponse<T> = {
  data: T[];
  page: number; // 1-based
  pageSize: number;
  total: number;
  totalPages: number;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function safeInt(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildQueryString(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

function getSortParam(sorting: SortingState): string | undefined {
  const s = sorting[0];
  if (!s) return undefined;
  return `${s.id}:${s.desc ? "desc" : "asc"}`;
}

function parseSortParam(sort?: string | null): SortingState {
  if (!sort) return [];
  const [id, dir] = sort.split(":");
  if (!id) return [];
  return [{ id, desc: dir === "desc" }];
}

export default function EventsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ---- URL state (single source of truth) ----
  const page = Math.max(1, safeInt(searchParams.get("page"), 1));
  const pageSize = Math.min(100, Math.max(1, safeInt(searchParams.get("pageSize"), 25)));

  const status = (searchParams.get("status") as EventStatus | null) ?? undefined;
  const environment = (searchParams.get("environment") as Environment | null) ?? undefined;
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "";
  const source = searchParams.get("source") ?? "";

  const [sorting, setSorting] = React.useState<SortingState>(
    parseSortParam(searchParams.get("sort"))
  );

  // Keep sorting in sync if user edits URL manually / back-forward nav
  React.useEffect(() => {
    setSorting(parseSortParam(searchParams.get("sort")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("sort")]);

  function updateUrl(next: Record<string, string | undefined>) {
    const merged: Record<string, string | undefined> = {
      page: String(page),
      pageSize: String(pageSize),
      status,
      environment,
      q: q || undefined,
      type: type || undefined,
      source: source || undefined,
      sort: getSortParam(sorting),
      ...next,
    };

    // Always drop to page 1 when changing filters/sort/pageSize
    if (next.status !== undefined || next.environment !== undefined || next.q !== undefined || next.type !== undefined || next.source !== undefined || next.sort !== undefined || next.pageSize !== undefined) {
      merged.page = "1";
    }

    router.replace(`${pathname}${buildQueryString(merged)}`);
  }

  // ---- Data fetch ----
  const [rows, setRows] = React.useState<EventRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const queryString = React.useMemo(() => {
    return buildQueryString({
      page: String(page),
      pageSize: String(pageSize),
      status,
      environment,
      q: q || undefined,
      type: type || undefined,
      source: source || undefined,
      sort: getSortParam(sorting),
    });
  }, [page, pageSize, status, environment, q, type, source, sorting]);

  React.useEffect(() => {
    const ac = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/events${queryString}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: ac.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed (${res.status})`);
        }

        const json = (await res.json()) as ListResponse<EventRow>;
        setRows(json.data ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Failed to load events.");
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => ac.abort();
  }, [queryString]);

  // ---- Drawer / details ----
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<EventRow | null>(null);

  function openDetails(row: EventRow) {
    setSelected(row);
    setOpen(true);
  }

  async function copyJson(obj: unknown) {
    await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
  }

  // ---- Table ----
  const columns = React.useMemo<ColumnDef<EventRow>[]>(
    () => [
      {
        accessorKey: "occurredAt",
        header: "Occurred",
        cell: ({ getValue }) => <span className="tabular-nums">{formatDate(String(getValue()))}</span>,
      },
      {
        accessorKey: "environment",
        header: "Env",
        cell: ({ getValue }) => <span className="uppercase">{String(getValue())}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const v = String(getValue());
          return (
            <span className={`rounded px-2 py-1 text-xs font-medium ${v === "error" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
              {v}
            </span>
          );
        },
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span>,
      },
      {
        accessorKey: "source",
        header: "Source",
      },
      {
        accessorKey: "durationMs",
        header: "Duration",
        cell: ({ getValue }) => <span className="tabular-nums">{Number(getValue())} ms</span>,
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: totalPages,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
      updateUrl({ sort: getSortParam(next) });
    },
  });

  // ---- UI helpers ----
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <Card className="p-4">
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:w-72">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
            <Input
              value={q}
              placeholder="type/source or event id"
              onChange={(e) => updateUrl({ q: e.target.value })}
              aria-label="Search events"
            />
          </div>

          <div className="w-full md:w-40">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={status ?? "all"}
              onValueChange={(v) => updateUrl({ status: v === "all" ? undefined : v })}
            >
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ok">ok</SelectItem>
                <SelectItem value="error">error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-40">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Environment</label>
            <Select
              value={environment ?? "all"}
              onValueChange={(v) => updateUrl({ environment: v === "all" ? undefined : v })}
            >
              <SelectTrigger aria-label="Filter by environment">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="dev">dev</SelectItem>
                <SelectItem value="staging">staging</SelectItem>
                <SelectItem value="prod">prod</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-44">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Page size</label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => updateUrl({ pageSize: v })}
            >
              <SelectTrigger aria-label="Select page size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          <div className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${total.toLocaleString()} total`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => updateUrl({ page: String(page - 1) })}
              disabled={!canPrev || loading}
              aria-label="Previous page"
            >
              Prev
            </Button>
            <div className="min-w-[6rem] text-center text-sm tabular-nums">
              Page {page} / {totalPages}
            </div>
            <Button
              variant="outline"
              onClick={() => updateUrl({ page: String(page + 1) })}
              disabled={!canNext || loading}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Optional “type/source” filters (kept simple, but URL-driven) */}
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Type contains</label>
          <Input
            value={type}
            placeholder="e.g. report.generated"
            onChange={(e) => updateUrl({ type: e.target.value })}
            aria-label="Filter by type"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Source contains</label>
          <Input
            value={source}
            placeholder="e.g. worker"
            onChange={(e) => updateUrl({ source: e.target.value })}
            aria-label="Filter by source"
          />
        </div>
      </div>

      {/* States */}
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-medium">Couldn’t load events</div>
          <div className="mt-1 break-words">{error}</div>
          <div className="mt-3">
            <Button variant="outline" onClick={() => router.refresh()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const isSorted = h.column.getIsSorted();
                  return (
                    <TableHead key={h.id}>
                      <button
                        type="button"
                        className={`flex items-center gap-2 ${canSort ? "cursor-pointer select-none" : ""}`}
                        onClick={() => {
                          if (!canSort) return;
                          const id = h.column.id;
                          const current = sorting[0];
                          // tri-state: none -> asc -> desc -> none
                          let next: SortingState = [];
                          if (!current || current.id !== id) next = [{ id, desc: false }];
                          else if (current.desc === false) next = [{ id, desc: true }];
                          else next = [];
                          setSorting(next);
                          updateUrl({ sort: getSortParam(next) });
                        }}
                        aria-label={canSort ? `Sort by ${h.column.id}` : undefined}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {isSorted === "asc" ? <span aria-hidden>▲</span> : null}
                        {isSorted === "desc" ? <span aria-hidden>▼</span> : null}
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                  Loading events…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                  No events match your filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => openDetails(r.original)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openDetails(r.original);
                  }}
                  aria-label={`Open details for event ${r.original.id}`}
                >
                  {r.getVisibleCells().map((c) => (
                    <TableCell key={c.id}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Details dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Event details</DialogTitle>
            <DialogDescription className="break-all">
              {selected?.id ?? ""}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border p-3">
                  <div className="text-xs font-medium text-muted-foreground">Occurred</div>
                  <div className="mt-1 text-sm tabular-nums">{formatDate(selected.occurredAt)}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs font-medium text-muted-foreground">Created</div>
                  <div className="mt-1 text-sm tabular-nums">{formatDate(selected.createdAt)}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs font-medium text-muted-foreground">Environment</div>
                  <div className="mt-1 text-sm uppercase">{selected.environment}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs font-medium text-muted-foreground">Status</div>
                  <div className="mt-1 text-sm">{selected.status}</div>
                </div>
                <div className="rounded border p-3 md:col-span-2">
                  <div className="text-xs font-medium text-muted-foreground">Type</div>
                  <div className="mt-1 font-mono text-xs">{selected.type}</div>
                </div>
                <div className="rounded border p-3 md:col-span-2">
                  <div className="text-xs font-medium text-muted-foreground">Source</div>
                  <div className="mt-1 text-sm">{selected.source}</div>
                </div>
                <div className="rounded border p-3 md:col-span-2">
                  <div className="text-xs font-medium text-muted-foreground">Duration</div>
                  <div className="mt-1 text-sm tabular-nums">{selected.durationMs} ms</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => copyJson(selected)}
                >
                  Copy JSON
                </Button>
                <Button onClick={() => setOpen(false)}>Close</Button>
              </div>

              <pre className="max-h-72 overflow-auto rounded border bg-muted p-3 text-xs">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
