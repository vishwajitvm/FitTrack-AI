"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarSearch, LayoutGrid, Rows3 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useHistory } from "@/hooks/use-history";
import type { HistoryFilters } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DayDetailModal } from "./day-detail";
import { HistorySummaryStrip } from "./history-summary";
import { DEFAULT_FILTERS, HistoryFiltersBar, activeFilterCount } from "./history-filters";
import { HistoryCards, HistoryTable } from "./history-list";

type Layout = "table" | "cards";
const LAYOUT_KEY = "fittrack.history.layout";

export function HistoryView() {
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [layout, setLayout] = useState<Layout>("table");
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, isLoading, isValidating, mutate } = useHistory(filters);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved === "cards" || saved === "table") setLayout(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const chooseLayout = (l: Layout) => {
    setLayout(l);
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* storage unavailable */
    }
  };

  // Any change other than the page itself starts again at page 1.
  const update = useCallback((patch: Partial<HistoryFilters>) => setFilters((f) => ({ ...f, page: 1, ...patch })), []);
  const rows = data?.items ?? [];
  const filtered = !!filters.q || activeFilterCount(filters) > 0;

  return (
    <>
      <PageHeader
        title="History"
        page="history"
        description="Every logged day, newest first. Search foods or exercises, filter by training, calories or status, and open a day for the full picture."
        actions={
          <div className="glass flex rounded-xl border p-1" role="group" aria-label="Layout">
            {(
              [
                ["table", Rows3, "Table"],
                ["cards", LayoutGrid, "Cards"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => chooseLayout(value)}
                aria-pressed={layout === value}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  layout === value ? "btn-3d text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-4">
        <HistoryFiltersBar value={filters} onChange={update} />

        {error ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : isLoading && !data ? (
          <ListSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<CalendarSearch className="h-5 w-5" />}
            title={filtered ? "No days match" : "Nothing logged yet"}
            description={filtered ? "Try fewer words or clear a filter." : "Log a meal, a workout or a morning weigh-in and it will show up here."}
            action={
              filtered ? (
                <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Clear search & filters
                </Button>
              ) : (
                <Link href="/food">
                  <Button>Log food</Button>
                </Link>
              )
            }
          />
        ) : (
          <div className={cn("space-y-4 transition-opacity", isValidating && "opacity-70")}>
            {data && <HistorySummaryStrip summary={data.summary} />}
            {layout === "table" ? (
              <>
                <Card className="hidden overflow-hidden md:block">
                  <HistoryTable rows={rows} onOpen={setOpen} />
                </Card>
                <div className="md:hidden">
                  <HistoryCards rows={rows} onOpen={setOpen} />
                </div>
              </>
            ) : (
              <HistoryCards rows={rows} onOpen={setOpen} />
            )}
            {data && (
              <Card>
                <CardBody className="py-3">
                  <Pagination
                    page={data.page}
                    pages={data.pages}
                    total={data.total}
                    pageSize={data.page_size}
                    noun={data.total === 1 ? "day" : "days"}
                    onPage={(page) => setFilters((f) => ({ ...f, page }))}
                    onPageSize={(page_size) => update({ page_size })}
                  />
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>

      <DayDetailModal date={open} onClose={() => setOpen(null)} dates={rows.map((r) => r.date)} onNavigate={setOpen} />
    </>
  );
}
