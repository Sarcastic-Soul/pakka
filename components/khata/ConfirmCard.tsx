"use client";

import { useId } from "react";
import { ArrowCounterClockwise, Check, CircleNotch, Plus, Trash, X } from "@phosphor-icons/react";
import type { EntryKind, Flag } from "@/lib/khata/types";
import { formatRupees, parseRupees } from "@/lib/khata/client/format";
import {
  isNewCustomer,
  itemsSum,
  liveFlags,
  MAX_ITEMS,
  MAX_TEXT,
  newItem,
  warningFlags,
  type Draft,
  type DraftItem,
} from "@/lib/khata/client/draft";
import { localize } from "@/lib/i18n/localize";
import { useLang } from "@/lib/i18n/useLang";
import FlagList from "./FlagList";
import Transcripts from "./Transcripts";

const field =
  "min-h-12 w-full rounded-sm border border-ink/60 bg-paper px-3 text-lg text-ink placeholder:text-ink-soft/80 focus:border-ink";

export default function ConfirmCard({
  draft,
  onChange,
  customerNames,
  saving,
  error,
  onSave,
  onRecordAgain,
  onCancel,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  customerNames: string[];
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onRecordAgain: (() => void) | null;
  onCancel: () => void;
}) {
  const id = useId();
  const { lang, t } = useLang();
  const warnings = warningFlags(liveFlags(draft));
  const flags: Flag[] = isNewCustomer(draft.customer, customerNames)
    ? [...warnings, "new_customer"]
    : warnings;
  const red = warnings.length > 0;
  const sum = itemsSum(draft.items);
  const total = parseRupees(draft.total);
  const sumDiffers = sum !== null && total !== null && sum !== total;

  const setItem = (key: string, patch: Partial<DraftItem>) =>
    onChange({ ...draft, items: draft.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) });
  const removeItem = (key: string) => {
    const items = draft.items.filter((it) => it.key !== key);
    onChange({ ...draft, items: items.length ? items : [newItem()] });
  };
  const setKind = (kind: EntryKind) => onChange({ ...draft, kind });

  return (
    <form
      lang={lang}
      aria-labelledby={`${id}-title`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className={`settle relative bg-paper px-4 py-5 sm:px-6 ${
        red ? "border-2 border-accent" : "border border-ink"
      }`}
    >
      {red && <div aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-accent" />}

      <div className="flex items-start justify-between gap-3 border-b border-rule pb-3">
        <h2 id={`${id}-title`} className="font-display text-2xl leading-tight">
          {draft.fromVoice ? t.cardCheck : t.cardNew}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="-mr-2 inline-flex size-12 shrink-0 items-center justify-center rounded-sm"
          aria-label={t.cancel}
        >
          <X aria-hidden size={24} />
        </button>
      </div>

      {(flags.length > 0 || (draft.snrDb !== null && draft.snrDb < 8)) && (
        <div className="mt-4 space-y-3 border-b border-rule pb-4">
          <FlagList flags={flags} />
          {draft.snrDb !== null && draft.snrDb < 8 && (
            <p className="text-base font-medium">{t.noisy(Math.round(draft.snrDb))}</p>
          )}
        </div>
      )}

      <div className="mt-4">
        <label htmlFor={`${id}-customer`} className="block font-medium">
          {t.customer}
        </label>
        <input
          id={`${id}-customer`}
          lang="hi"
          list={`${id}-customers`}
          value={draft.customer}
          onChange={(e) => onChange({ ...draft, customer: e.target.value })}
          autoComplete="off"
          maxLength={MAX_TEXT}
          className={`${field} mt-1 font-display text-2xl`}
          placeholder={t.customerPlaceholder}
          required
        />
        <datalist id={`${id}-customers`}>
          {customerNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>

      <fieldset className="mt-4">
        <legend className="sr-only">{t.kindLegend}</legend>
        <div className="grid grid-cols-2 border border-ink">
          {(
            [
              ["udhaar", t.kindUdhaar],
              ["jama", t.kindJama],
            ] as const
          ).map(([k, label], i) => (
            <label
              key={k}
              className={`flex min-h-14 cursor-pointer items-center justify-center px-2 text-center text-lg font-medium focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${
                i > 0 ? "border-l border-ink" : ""
              } ${draft.kind === k ? "bg-ink text-paper" : ""}`}
            >
              <input
                type="radio"
                name={`${id}-kind`}
                value={k}
                checked={draft.kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="mb-2 font-medium">{t.itemsLegend}</legend>
        <ul className="divide-y divide-rule border-y border-rule">
          {draft.items.map((it, i) => (
            <li key={it.key} className="grid grid-cols-[1fr_8rem_3rem] gap-2 py-3 sm:grid-cols-[1fr_7rem_8rem_3rem]">
              <input
                aria-label={t.itemNameAria(i + 1)}
                lang="hi"
                value={it.name}
                maxLength={MAX_TEXT}
                onChange={(e) => setItem(it.key, { name: e.target.value })}
                placeholder={t.itemPlaceholder}
                className={`${field} col-span-3 sm:col-span-1`}
              />
              <input
                aria-label={t.itemQtyAria(i + 1)}
                value={it.qty}
                maxLength={MAX_TEXT}
                onChange={(e) => setItem(it.key, { qty: e.target.value })}
                placeholder={t.qtyPlaceholder}
                className={field}
              />
              <div className="relative">
                <span aria-hidden className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
                  ₹
                </span>
                <input
                  aria-label={t.itemAmountAria(i + 1)}
                  inputMode="numeric"
                  maxLength={12}
                  value={it.amount}
                  onChange={(e) => setItem(it.key, { amount: e.target.value })}
                  placeholder="0"
                  className={`${field} num pl-7 text-right`}
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(it.key)}
                aria-label={t.itemRemoveAria(i + 1)}
                className="inline-flex size-12 items-center justify-center rounded-sm text-ink-soft hover:text-accent"
              >
                <Trash aria-hidden size={22} />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onChange({ ...draft, items: [...draft.items, newItem()] })}
          disabled={draft.items.length >= MAX_ITEMS}
          className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-sm px-1 underline underline-offset-4 disabled:opacity-50 disabled:no-underline"
        >
          <Plus aria-hidden size={20} />
          {t.addItem}
        </button>
      </fieldset>

      <div className="mt-5 border-t-2 border-ink pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label htmlFor={`${id}-total`} className="pb-2">
            <span className="block text-xl font-medium">{t.total}</span>
            <span className="block text-sm text-ink-soft">{t.totalRupees}</span>
          </label>
          <div className="relative w-full max-w-[14rem]">
            <span aria-hidden className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-3xl text-ink-soft">
              ₹
            </span>
            <input
              id={`${id}-total`}
              inputMode="numeric"
              maxLength={12}
              value={draft.total}
              onChange={(e) => onChange({ ...draft, total: e.target.value })}
              placeholder="0"
              required
              aria-describedby={`${id}-sum`}
              className={`${field} num min-h-16 pl-9 text-right text-4xl ${
                draft.total.trim() === "" && draft.flags.includes("no_total") ? "border-2 border-accent" : ""
              }`}
            />
          </div>
        </div>
        <p id={`${id}-sum`} className={`mt-2 text-right text-base ${sumDiffers ? "text-accent" : "text-ink-soft"}`}>
          {sum !== null && (
            <>
              {t.itemsAddUp} <span className="num font-medium">{formatRupees(sum)}</span>
              {sumDiffers && t.differsFromTotal}
            </>
          )}
        </p>
      </div>

      {draft.fromVoice && (
        <div className="mt-5 border-t border-rule pt-4">
          <Transcripts raw={draft.transcriptRaw} clean={draft.transcriptClean} />
        </div>
      )}

      <p role="alert" className="mt-4 text-base font-medium text-accent empty:hidden">
        {error ? localize(error, lang) : ""}
      </p>

      <div className="mt-5 flex flex-col gap-3 whitespace-nowrap">
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className={`inline-flex min-h-14 items-center justify-center gap-3 rounded-sm px-6 text-lg font-medium text-paper disabled:opacity-70 ${
            red ? "bg-accent" : "bg-ink"
          }`}
        >
          {saving ? (
            <CircleNotch aria-hidden size={24} className="animate-spin" />
          ) : (
            <Check aria-hidden size={24} weight="bold" />
          )}
          {saving ? t.saving : red ? t.saveChecked : t.save}
        </button>
        {onRecordAgain && (
          <button
            type="button"
            onClick={onRecordAgain}
            disabled={saving}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-sm border-2 border-ink px-5 disabled:opacity-60"
          >
            <ArrowCounterClockwise aria-hidden size={22} />
            {t.recordAgain}
          </button>
        )}
      </div>
    </form>
  );
}
