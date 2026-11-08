"use client";

import {
  Calculator,
  EarSlash,
  PencilSimple,
  Question,
  UserPlus,
  Warning,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import type { Flag } from "@/lib/khata/types";
import { FLAG_TEXT, sortFlags } from "@/lib/khata/client/flags";

const ICONS: Record<Flag, Icon> = {
  numbers_differ: Warning,
  raw_empty: EarSlash,
  amount_not_heard: Question,
  sum_mismatch: Calculator,
  new_customer: UserPlus,
  no_total: PencilSimple,
  denoise_unavailable: WarningCircle,
};

export default function FlagList({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="space-y-3" aria-label="जाँच के नतीजे · Checks">
      {sortFlags(flags).map((f) => {
        const IconEl = ICONS[f];
        const warn = f !== "new_customer";
        return (
          <li key={f} className={`flex gap-3 ${warn ? "text-accent" : "text-ink"}`}>
            <IconEl aria-hidden size={26} weight={warn ? "fill" : "regular"} className="mt-0.5 shrink-0" />
            <span>
              <span lang="hi" className="block font-medium leading-snug">
                {FLAG_TEXT[f].hi}
              </span>
              <span className="block text-sm text-ink-soft">{FLAG_TEXT[f].en}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
