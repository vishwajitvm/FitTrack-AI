"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  sizes?: number[];
  noun?: string;
}

/** "Showing 1–10 of 42 days" + rows-per-page + prev / page numbers / next. */
export function Pagination({ page, pages, total, pageSize, onPage, onPageSize, sizes = [10, 20, 50], noun = "items" }: PaginationProps) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(total, page * pageSize);
  const around = Array.from(new Set([1, page - 1, page, page + 1, pages])).filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span>
          Showing <b className="text-slate-900">{first}–{last}</b> of <b className="text-slate-900">{total}</b> {noun}
        </span>
        {onPageSize && (
          <label className="flex items-center gap-1.5 text-xs">
            <span className="sr-only sm:not-sr-only">Rows</span>
            <Select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="h-8 w-[88px] text-xs">
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-9 w-9" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {around.map((p, i) => (
          <span key={p} className="flex items-center">
            {i > 0 && p - around[i - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
            <Button variant={p === page ? "primary" : "ghost"} size="sm" className="h-9 min-w-9 px-2" onClick={() => onPage(p)} aria-current={p === page ? "page" : undefined}>
              {p}
            </Button>
          </span>
        ))}
        <Button variant="outline" size="icon" className="h-9 w-9" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
