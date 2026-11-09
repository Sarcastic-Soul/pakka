"use client";

import { useState } from "react";
import { CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import type { Customer } from "@/lib/khata/types";
import { formatRupees, relativeDate } from "@/lib/khata/client/format";
import { nameKey } from "@/lib/khata/client/search";
import { useLang } from "@/lib/i18n/useLang";

export default function CustomerList({
  customers,
  onOpen,
}: {
  customers: Customer[];
  onOpen: (c: Customer) => void;
}) {
  const { lang, t } = useLang();
  const [query, setQuery] = useState("");
  if (customers.length === 0) {
    return (
      <div lang={lang} className="border-y border-rule py-8 text-center">
        <p className="font-display text-2xl">{t.noCustomers}</p>
        <p className="mt-2 text-base text-ink-soft">{t.noCustomersHelp}</p>
      </div>
    );
  }
  const owed = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const key = nameKey(query);
  const shown = key ? customers.filter((c) => nameKey(c.name).includes(key)) : customers;
  return (
    <>
      <p lang={lang} className="mb-2 flex items-baseline justify-between gap-3 text-base text-ink-soft">
        <span>{t.totalOwed}</span>
        <span className="num text-xl text-ink">{formatRupees(owed)}</span>
      </p>
      {customers.length > 6 && (
        <div className="relative mb-3">
          <MagnifyingGlass aria-hidden size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            type="search"
            lang="hi"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t.searchCustomers}
            placeholder={t.searchCustomers}
            className="min-h-12 w-full rounded-sm border border-ink/60 bg-paper pl-10 pr-3 text-lg focus:border-ink"
          />
        </div>
      )}
      {shown.length === 0 && <p className="border-y border-rule py-6 text-center text-ink-soft">{t.noMatch}</p>}
      <ul className="divide-y divide-rule border-y border-ink empty:hidden">
        {shown.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onOpen(c)}
              className="flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-paper-deep/60"
            >
              <span className="min-w-0 flex-1">
                <span lang="hi" className="block truncate text-xl font-medium">
                  {c.name}
                </span>
                <span lang={lang} className="block text-sm text-ink-soft">
                  {relativeDate(c.lastEntryAt, lang)}
                </span>
              </span>
              <span className="text-right">
                <span className={`num block text-2xl ${c.balance > 0 ? "" : "text-ink-soft"}`}>
                  {formatRupees(c.balance)}
                </span>
                <span lang={lang} className="block text-xs text-ink-soft">
                  {c.balance > 0 ? t.due : c.balance < 0 ? t.advance : t.settled}
                </span>
              </span>
              <CaretRight aria-hidden size={20} className="shrink-0 text-ink-soft" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
