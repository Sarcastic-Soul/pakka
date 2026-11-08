"use client";

import { useId } from "react";
import { ArrowCounterClockwise, Check, CircleNotch, Plus, Trash, X } from "@phosphor-icons/react";
import type { EntryKind, Flag } from "@/lib/khata/types";
import { formatRupees, parseRupees } from "@/lib/khata/client/format";
import { isNewCustomer, itemsSum, newItem, warningFlags, type Draft, type DraftItem } from "@/lib/khata/client/draft";
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
  const warnings = warningFlags(draft.flags);
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
          <span lang="hi">{draft.fromVoice ? "जाँचिए और सेव कीजिए" : "नई एंट्री"}</span>
          <span className="block font-sans text-sm text-ink-soft">
            {draft.fromVoice ? "Check, then save" : "New entry"}
          </span>
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="-mr-2 inline-flex size-12 shrink-0 items-center justify-center rounded-sm"
          aria-label="रद्द कीजिए · Cancel"
        >
          <X aria-hidden size={24} />
        </button>
      </div>

      {(flags.length > 0 || (draft.snrDb !== null && draft.snrDb < 8)) && (
        <div className="mt-4 space-y-3 border-b border-rule pb-4">
          <FlagList flags={flags} />
          {draft.snrDb !== null && draft.snrDb < 8 && (
            <p className="text-base">
              <span lang="hi" className="font-medium">
                दुकान में शोर ज़्यादा है
              </span>{" "}
              <span className="text-sm text-ink-soft">
                · The shop is noisy (about <span className="num">{Math.round(draft.snrDb)}</span> dB). Numbers
                need a closer look.
              </span>
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <label htmlFor={`${id}-customer`} className="block">
          <span lang="hi" className="font-medium">
            ग्राहक
          </span>{" "}
          <span className="text-sm text-ink-soft">· Customer</span>
        </label>
        <input
          id={`${id}-customer`}
          lang="hi"
          list={`${id}-customers`}
          value={draft.customer}
          onChange={(e) => onChange({ ...draft, customer: e.target.value })}
          autoComplete="off"
          className={`${field} mt-1 font-display text-2xl`}
          placeholder="नाम"
          required
        />
        <datalist id={`${id}-customers`}>
          {customerNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>

      <fieldset className="mt-4">
        <legend className="sr-only">उधार या जमा · Credit or payment</legend>
        <div className="grid grid-cols-2 border border-ink">
          {(
            [
              ["udhaar", "उधार", "Credit given"],
              ["jama", "जमा", "Payment received"],
            ] as const
          ).map(([k, hi, en], i) => (
            <label
              key={k}
              className={`flex min-h-14 cursor-pointer flex-col items-center justify-center px-2 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${
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
              <span lang="hi" className="text-lg font-medium">
                {hi}
              </span>
              <span className={`text-xs ${draft.kind === k ? "text-paper/80" : "text-ink-soft"}`}>{en}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="mb-2">
          <span lang="hi" className="font-medium">
            सामान
          </span>{" "}
          <span className="text-sm text-ink-soft">· Items (optional for a payment)</span>
        </legend>
        <ul className="divide-y divide-rule border-y border-rule">
          {draft.items.map((it, i) => (
            <li key={it.key} className="grid grid-cols-[1fr_8rem_3rem] gap-2 py-3 sm:grid-cols-[1fr_7rem_8rem_3rem]">
              <input
                aria-label={`सामान ${i + 1} का नाम · Item ${i + 1} name`}
                lang="hi"
                value={it.name}
                onChange={(e) => setItem(it.key, { name: e.target.value })}
                placeholder="सामान"
                className={`${field} col-span-3 sm:col-span-1`}
              />
              <input
                aria-label={`सामान ${i + 1} की मात्रा · Item ${i + 1} quantity`}
                value={it.qty}
                onChange={(e) => setItem(it.key, { qty: e.target.value })}
                placeholder="मात्रा"
                className={field}
              />
              <div className="relative">
                <span aria-hidden className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
                  ₹
                </span>
                <input
                  aria-label={`सामान ${i + 1} की रकम, रुपये · Item ${i + 1} amount in rupees`}
                  inputMode="numeric"
                  value={it.amount}
                  onChange={(e) => setItem(it.key, { amount: e.target.value })}
                  placeholder="0"
                  className={`${field} num pl-7 text-right`}
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(it.key)}
                aria-label={`सामान ${i + 1} हटाइए · Remove item ${i + 1}`}
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
          className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-sm px-1 underline underline-offset-4"
        >
          <Plus aria-hidden size={20} />
          <span lang="hi">सामान जोड़िए</span>
          <span className="text-sm text-ink-soft">· Add item</span>
        </button>
      </fieldset>

      <div className="mt-5 border-t-2 border-ink pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label htmlFor={`${id}-total`} className="pb-2">
            <span lang="hi" className="block text-xl font-medium">
              कुल
            </span>
            <span className="block text-sm text-ink-soft">Total, rupees</span>
          </label>
          <div className="relative w-full max-w-[14rem]">
            <span aria-hidden className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-3xl text-ink-soft">
              ₹
            </span>
            <input
              id={`${id}-total`}
              inputMode="numeric"
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
              <span lang="hi">सामान का जोड़</span> · Items add up to{" "}
              <span className="num font-medium">{formatRupees(sum)}</span>
              {sumDiffers && <span lang="hi"> — कुल से अलग</span>}
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
        {error ?? ""}
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
          <span lang="hi">{saving ? "सेव हो रहा है…" : red ? "जाँच लिया, सेव करें" : "सेव करें"}</span>
        </button>
        {onRecordAgain && (
          <button
            type="button"
            onClick={onRecordAgain}
            disabled={saving}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-sm border-2 border-ink px-5 disabled:opacity-60"
          >
            <ArrowCounterClockwise aria-hidden size={22} />
            <span lang="hi">दोबारा बोलिए</span>
            <span className="text-sm text-ink-soft">· Record again</span>
          </button>
        )}
      </div>
    </form>
  );
}
