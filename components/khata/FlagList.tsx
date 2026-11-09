"use client";

import {
  Calculator,
  EarSlash,
  PencilSimple,
  Robot,
  Question,
  UserPlus,
  Warning,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import type { Flag } from "@/lib/khata/types";
import { sortFlags } from "@/lib/khata/client/flags";
import { useLang } from "@/lib/i18n/useLang";

const ICONS: Record<Flag, Icon> = {
  numbers_differ: Warning,
  raw_empty: EarSlash,
  amount_not_heard: Question,
  sum_mismatch: Calculator,
  new_customer: UserPlus,
  no_total: PencilSimple,
  denoise_unavailable: WarningCircle,
  ai_unavailable: Robot,
};

export default function FlagList({ flags }: { flags: Flag[] }) {
  const { lang, t } = useLang();
  if (flags.length === 0) return null;
  return (
    <ul className="space-y-3" aria-label={t.flagsAria}>
      {sortFlags(flags).map((f) => {
        const IconEl = ICONS[f];
        const warn = f !== "new_customer";
        return (
          <li key={f} className={`flex gap-3 ${warn ? "text-accent" : "text-ink"}`}>
            <IconEl aria-hidden size={26} weight={warn ? "fill" : "regular"} className="mt-0.5 shrink-0" />
            <span lang={lang} className="font-medium leading-snug">
              {t.flags[f]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
