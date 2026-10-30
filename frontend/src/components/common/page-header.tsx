"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronsDownUp, ChevronsUpDown, HelpCircle, Lightbulb, X } from "lucide-react";
import { usePrefs } from "@/components/layout/prefs-provider";
import { COLLAPSE_ALL_EVENT } from "@/components/ui/collapse";
import { PAGE_INTROS, type PageKey } from "@/config/page-intros";

interface PageHeaderProps {
  title: string;
  /** Detailed-mode description (technical). */
  description?: ReactNode;
  /** Page key for the Simple-mode "What is this page?" intro. */
  page?: PageKey;
  actions?: ReactNode;
  /** Replaces the static Simple-mode intro (and sits under the description in Detailed mode), e.g. the dashboard brief. */
  brief?: ReactNode;
}

const hiddenKey = (page: string) => `fittrack.intro.hidden.${page}`;

/** "Collapse all / Expand all" for every collapsible card and section on the page; hidden when there are none. */
function CollapseAllButton() {
  const [has, setHas] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);

  useEffect(() => {
    // cards appear after their data loads, so watch the page until the first one shows up
    const check = () => !!document.querySelector("[data-collapsible]");
    if (check()) return setHas(true);
    const obs = new MutationObserver(() => {
      if (check()) {
        setHas(true);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  if (!has) return null;
  const next = !allCollapsed;
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(COLLAPSE_ALL_EVENT, { detail: { collapsed: next } }));
        setAllCollapsed(next);
      }}
      className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-slate-500 transition-colors hover:text-slate-900"
      title={next ? "Collapse all cards" : "Expand all cards"}
      aria-label={next ? "Collapse all cards on this page" : "Expand all cards on this page"}
    >
      {next ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
    </button>
  );
}

export function PageHeader({ title, description, page, actions, brief }: PageHeaderProps) {
  const { simple } = usePrefs();
  const [introHidden, setIntroHidden] = useState(false);

  useEffect(() => {
    if (!page) return;
    try {
      setIntroHidden(localStorage.getItem(hiddenKey(page)) === "1");
    } catch {
      /* storage unavailable */
    }
  }, [page]);

  const toggleIntro = (hidden: boolean) => {
    setIntroHidden(hidden);
    try {
      if (page) localStorage.setItem(hiddenKey(page), hidden ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  };

  const intro = page ? PAGE_INTROS[page] : null;

  return (
    // side by side only when there is room for the title and all actions on one line; otherwise actions sit below
    <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between xl:gap-6">
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 text-[28px] font-bold tracking-tight text-slate-900 sm:text-[34px]">
          <span>
            {title}
            <span className="ml-1 text-hero">.</span>
          </span>
          {simple && intro && introHidden && !brief && (
            <button type="button" onClick={() => toggleIntro(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="What is this page?" title="What is this page?">
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
          <CollapseAllButton />
        </h1>
        {brief ? (
          <>
            {!simple && description && <div className="mt-1.5 max-w-3xl text-[15px] text-slate-500">{description}</div>}
            {brief}
          </>
        ) : simple && intro ? (
          !introHidden && (
            <div className="glass mt-3 flex max-w-3xl items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm text-slate-600">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-hero text-white">
                <Lightbulb className="h-3.5 w-3.5" />
              </span>
              <p className="flex-1 leading-relaxed">{intro}</p>
              <button type="button" onClick={() => toggleIntro(true)} className="-my-1 -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Hide this explanation">
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        ) : (
          description && <div className="mt-1.5 max-w-3xl text-[15px] text-slate-500">{description}</div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap xl:justify-end">{actions}</div>}
    </div>
  );
}
