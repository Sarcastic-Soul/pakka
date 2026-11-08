"use client";

import { CaretRight } from "@phosphor-icons/react";
import type { Customer } from "@/lib/khata/types";
import { formatRupees, relativeHindi } from "@/lib/khata/client/format";

export default function CustomerList({
  customers,
  onOpen,
}: {
  customers: Customer[];
  onOpen: (c: Customer) => void;
}) {
  if (customers.length === 0) {
    return (
      <div className="border-y border-rule py-8 text-center">
        <p lang="hi" className="font-display text-2xl">
          अभी कोई ग्राहक नहीं
        </p>
        <p className="mt-2 text-base text-ink-soft">
          No customers yet. Speak your first entry above, and the customer is added when you save it.
        </p>
      </div>
    );
  }
  const owed = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
  return (
    <>
      <p className="mb-2 flex items-baseline justify-between gap-3 text-base text-ink-soft">
        <span>
          <span lang="hi">कुल बाकी</span> · Total owed to you
        </span>
        <span className="num text-xl text-ink">{formatRupees(owed)}</span>
      </p>
      <ul className="divide-y divide-rule border-y border-ink">
        {customers.map((c) => (
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
                <span lang="hi" className="block text-sm text-ink-soft">
                  {relativeHindi(c.lastEntryAt)}
                </span>
              </span>
              <span className="text-right">
                <span className={`num block text-2xl ${c.balance > 0 ? "" : "text-ink-soft"}`}>
                  {formatRupees(c.balance)}
                </span>
                <span lang="hi" className="block text-xs text-ink-soft">
                  {c.balance > 0 ? "बाकी" : c.balance < 0 ? "अग्रिम · advance" : "हिसाब बराबर"}
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
