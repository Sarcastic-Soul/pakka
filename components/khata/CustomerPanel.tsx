"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CircleNotch, Warning } from "@phosphor-icons/react";
import type { Customer, Entry } from "@/lib/khata/types";
import { ApiError, getCustomer } from "@/lib/khata/client/api";
import { formatEntryDate, formatRupees } from "@/lib/khata/client/format";
import { sortFlags } from "@/lib/khata/client/flags";
import { localize } from "@/lib/i18n/localize";
import { useLang } from "@/lib/i18n/useLang";
import SpeakButton from "./SpeakButton";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; customer: Customer; entries: Entry[] }
  | { kind: "error"; message: string };

function EntryRow({ e }: { e: Entry }) {
  const { lang, t } = useLang();
  const warn = sortFlags(e.flags).filter((f) => f !== "new_customer");
  return (
    <li className="py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span lang={lang}>
          <span
            className={`mr-2 inline-block border px-2 text-sm font-medium ${
              e.kind === "jama" ? "border-ink-soft text-ink-soft" : "border-ink"
            }`}
          >
            {e.kind === "jama" ? t.kindJamaShort : t.kindUdhaarShort}
          </span>
          <span className="text-sm text-ink-soft">{formatEntryDate(e.createdAt, lang)}</span>
        </span>
        <span className="num text-2xl">
          {e.kind === "jama" ? "−" : "+"}
          {formatRupees(e.total)}
        </span>
      </div>
      {e.items.length > 0 && (
        <p lang="hi" className="mt-1 text-base text-ink-soft">
          {e.items
            .map((it) => [it.qty, it.name, it.amount !== null ? formatRupees(it.amount) : null].filter(Boolean).join(" "))
            .join(" · ")}
        </p>
      )}
      {warn.length > 0 && (
        <p lang={lang} className="mt-1 flex items-start gap-2 text-sm text-accent">
          <Warning aria-hidden size={18} weight="fill" className="mt-0.5 shrink-0" />
          <span>{t.savedAfterChecks(warn.map((f) => t.flags[f]).join("; "))}</span>
        </p>
      )}
    </li>
  );
}

export default function CustomerPanel({
  customer,
  onClose,
  onUnauthorized,
}: {
  customer: Customer;
  onClose: () => void;
  onUnauthorized: () => void;
}) {
  const { lang, t } = useLang();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let alive = true;
    getCustomer(customer.id)
      .then((r) => alive && setLoad({ kind: "ready", customer: r.customer, entries: r.entries }))
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) onUnauthorized();
        setLoad({ kind: "error", message: err instanceof Error ? err.message : "" });
      });
    return () => {
      alive = false;
    };
  }, [customer.id, onUnauthorized]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, [onClose]);

  const c = load.kind === "ready" ? load.customer : customer;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div aria-hidden className="absolute inset-0 bg-ink/40 max-md:hidden" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-panel-title"
        lang={lang}
        className="settle relative flex h-full w-full flex-col overflow-y-auto bg-paper md:max-w-lg md:border-l md:border-ink"
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-ink bg-paper px-2 py-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-12 items-center gap-2 rounded-sm px-3"
          >
            <ArrowLeft aria-hidden size={22} />
            {t.back}
          </button>
        </div>

        <div className="px-5 pb-10 pt-5">
          <h2 id="customer-panel-title" lang="hi" className="font-display text-4xl leading-tight">
            {c.name}
          </h2>
          <p className="mt-4 text-base text-ink-soft">{t.panelBalance}</p>
          <p className={`num text-5xl ${c.balance > 0 ? "" : "text-ink-soft"}`}>{formatRupees(c.balance)}</p>

          <div className="mt-5">
            <SpeakButton target={{ customerId: customer.id }} label={t.readBalance} onUnauthorized={onUnauthorized} />
          </div>

          <h3 className="mt-8 border-b border-ink pb-2 text-lg font-medium">{t.history}</h3>

          <div aria-live="polite">
            {load.kind === "loading" && (
              <p className="flex items-center gap-3 py-6 text-ink-soft">
                <CircleNotch aria-hidden size={22} className="animate-spin" />
                {t.loading}
              </p>
            )}
            {load.kind === "error" && <p className="py-6 text-accent">{load.message ? localize(load.message, lang) : t.somethingWrong}</p>}
            {load.kind === "ready" &&
              (load.entries.length === 0 ? (
                <p className="py-6 text-ink-soft">{t.noEntries}</p>
              ) : (
                <ul className="divide-y divide-rule">
                  {load.entries.map((e) => (
                    <EntryRow key={e.id} e={e} />
                  ))}
                </ul>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
