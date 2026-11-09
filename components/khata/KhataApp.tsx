"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowCounterClockwise, CheckCircle, CircleNotch, Keyboard, SignOut, WarningCircle } from "@phosphor-icons/react";
import type { Customer, Entry, Shop } from "@/lib/khata/types";
import { ApiError, deleteEntry, getMe, listCustomers, logout, parseEntry, saveEntry } from "@/lib/khata/client/api";
import { decodeToMono16k, RATE, toWav } from "@/lib/khata/client/audio";
import { draftFromParse, emptyDraft, finalizeDraft, isDirty, type Draft } from "@/lib/khata/client/draft";
import { formatRupees } from "@/lib/khata/client/format";
import { clearHint, saveHint } from "@/lib/khata/client/session-hint";
import { localize } from "@/lib/i18n/localize";
import { useLang } from "@/lib/i18n/useLang";
import LangToggle from "@/components/LangToggle";
import ConfirmCard from "./ConfirmCard";
import CustomerList from "./CustomerList";
import CustomerPanel from "./CustomerPanel";
import NotifyCustomer from "./NotifyCustomer";
import Recorder, { type RecorderError } from "./Recorder";
import SpeakButton from "./SpeakButton";

type Phase =
  | { kind: "idle" }
  | { kind: "processing"; step: number }
  | { kind: "confirm"; draft: Draft; saving: boolean; error: string | null }
  | { kind: "saved"; entry: Entry; customer: Customer; undoing: boolean; error: string | null };

type Notice =
  | { kind: "recorder"; error: RecorderError }
  | { kind: "short" }
  | { kind: "unreadable" }
  | { kind: "api"; status: number; message: string }
  | null;

// When each step label appears (ms after upload starts). Timed, not measured.
const STEP_AT = [0, 2500, 6000];

export default function KhataApp() {
  const router = useRouter();
  const { lang, t } = useLang();
  const [shop, setShop] = useState<Shop | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [notice, setNotice] = useState<Notice>(null);
  const [open, setOpen] = useState<Customer | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const workArea = useRef<HTMLDivElement | null>(null);
  const saveInFlight = useRef(false);

  const toHome = useCallback(() => router.replace("/"), [router]);
  const closePanel = useCallback(() => setOpen(null), []);

  const refreshCustomers = useCallback(async () => {
    try {
      const r = await listCustomers();
      setCustomers(r.customers);
      setCustomersError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return toHome();
      setCustomersError(err instanceof Error ? err.message : "");
    }
  }, [toHome]);

  useEffect(() => {
    let alive = true;
    getMe()
      .then((r) => {
        if (!alive) return;
        setShop(r.shop);
        saveHint(r.shop.name);
        void refreshCustomers();
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) toHome();
        else setAuthError(err instanceof Error ? err.message : "");
      });
    return () => {
      alive = false;
    };
  }, [refreshCustomers, toHome]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const customerNames = useMemo(() => (customers ?? []).map((c) => c.name), [customers]);

  const scrollToWork = () =>
    requestAnimationFrame(() => workArea.current?.scrollIntoView({ block: "start", behavior: "smooth" }));

  const onRecorded = useCallback(
    async (blob: Blob) => {
      setNotice(null);
      setFlash(null);
      setPhase({ kind: "processing", step: 0 });
      clearTimers();
      try {
        const samples = await decodeToMono16k(await blob.arrayBuffer());
        if (samples.length < RATE * 0.5) {
          setPhase({ kind: "idle" });
          setNotice({ kind: "short" });
          return;
        }
        STEP_AT.forEach((at, step) => {
          if (step > 0) timers.current.push(setTimeout(() => setPhase((p) => (p.kind === "processing" ? { kind: "processing", step } : p)), at));
        });
        const result = await parseEntry(toWav(samples));
        clearTimers();
        setPhase({ kind: "confirm", draft: draftFromParse(result), saving: false, error: null });
        scrollToWork();
      } catch (err) {
        clearTimers();
        if (err instanceof ApiError && err.status === 401) return toHome();
        setPhase({ kind: "idle" });
        setNotice(
          err instanceof ApiError
            ? { kind: "api", status: err.status, message: err.message }
            : { kind: "unreadable" },
        );
      }
    },
    [toHome],
  );

  const onRecorderError = useCallback((e: RecorderError) => setNotice({ kind: "recorder", error: e }), []);

  const onSave = async () => {
    if (phase.kind !== "confirm" || saveInFlight.current) return;
    const r = finalizeDraft(phase.draft, customerNames, t.draftErrors);
    if (!r.ok) {
      setPhase({ ...phase, error: r.error });
      return;
    }
    saveInFlight.current = true;
    setPhase({ ...phase, saving: true, error: null });
    try {
      const saved = await saveEntry(r.entry);
      setPhase({ kind: "saved", entry: saved.entry, customer: saved.customer, undoing: false, error: null });
      void refreshCustomers();
      scrollToWork();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return toHome();
      setPhase({ ...phase, saving: false, error: err instanceof Error ? err.message : t.saveFail });
    } finally {
      saveInFlight.current = false;
    }
  };

  const onUndo = async () => {
    if (phase.kind !== "saved" || phase.undoing || !window.confirm(t.undoConfirm)) return;
    setPhase({ ...phase, undoing: true, error: null });
    try {
      await deleteEntry(phase.entry.id);
      setPhase({ kind: "idle" });
      setFlash(t.undone);
      void refreshCustomers();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return toHome();
      setPhase({ ...phase, undoing: false, error: err instanceof Error ? err.message : t.deleteFail });
    }
  };

  const onPayment = useCallback((c: Customer) => {
    setOpen(null);
    setNotice(null);
    setFlash(null);
    setPhase({
      kind: "confirm",
      draft: { ...emptyDraft(), customer: c.name, kind: "jama", total: c.balance > 0 ? String(c.balance) : "" },
      saving: false,
      error: null,
    });
    scrollToWork();
  }, []);

  const onLogout = async () => {
    clearHint();
    try {
      await logout();
    } catch {
      // cookie may already be gone; go home either way
    }
    toHome();
  };

  const noticeText = (n: Exclude<Notice, null>): { title: string; detail: string } => {
    switch (n.kind) {
      case "recorder":
        return t.recErrors[n.error];
      case "short":
        return { title: t.noticeTooShort, detail: t.noticeTooShortHelp };
      case "unreadable":
        return { title: t.noticeUnreadable, detail: t.noticeUnreadableHelp };
      case "api":
        return {
          title: n.status === 429 ? t.noticeBusy : n.status === 403 ? t.noticeVoiceOff : t.noticeGeneric,
          detail: localize(n.message, lang),
        };
    }
  };

  if (!shop) {
    return (
      <main lang={lang} className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-5">
        {authError ? (
          <div role="alert" className="text-center">
            <WarningCircle aria-hidden size={40} className="mx-auto text-accent" />
            <p className="mt-3 text-lg">{authError ? localize(authError, lang) : t.shopLoadFail}</p>
            <button
              type="button"
              onClick={() => location.reload()}
              className="mt-4 min-h-12 rounded-sm border-2 border-ink px-5"
            >
              {t.retry}
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-3 text-ink-soft" role="status">
            <CircleNotch aria-hidden size={24} className="animate-spin" />
            {t.opening}
          </p>
        )}
      </main>
    );
  }

  const busy = phase.kind === "processing" || phase.kind === "confirm";

  return (
    <div lang={lang} className="khata-app min-h-screen">
      <header className="border-b border-ink" inert={!!open}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-8">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <p className="font-display text-sm text-ink-soft">
              Pakka · <span lang="hi">पक्का</span>
            </p>
            <h1 className="truncate font-display text-2xl leading-tight">{shop.name}</h1>
            <p className="text-sm text-ink-soft">
              {t.shopCode} <span className="num text-ink">{shop.code}</span>
              {shop.isDemo && (
                <span className="ml-2 inline-block border border-accent px-1.5 text-xs font-medium uppercase tracking-wide text-accent">
                  {t.demoBadge}
                </span>
              )}
            </p>
          </div>
          <LangToggle className="shrink-0" />
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-sm border border-ink px-3"
          >
            <SignOut aria-hidden size={20} />
            <span className="max-sm:sr-only">{t.logOut}</span>
          </button>
        </div>
      </header>

      <main inert={!!open} className="mx-auto grid max-w-5xl gap-10 px-4 pb-24 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <section aria-labelledby="new-entry" ref={workArea} className="scroll-mt-4">
          <h2 id="new-entry" className="sr-only">
            {t.newEntryHeading}
          </h2>

          {(phase.kind === "idle" || phase.kind === "processing") && (
            <div className="py-4">
              {phase.kind === "processing" ? (
                <div className="flex flex-col items-center py-8" role="status" aria-live="polite">
                  <ol className="w-full max-w-sm space-y-4">
                    {t.steps.map((label, i) => (
                      <li
                        key={i}
                        className={`flex items-center gap-3 ${i > phase.step ? "text-ink-soft/60" : ""}`}
                        aria-current={i === phase.step ? "step" : undefined}
                      >
                        {i < phase.step ? (
                          <CheckCircle aria-hidden size={28} weight="fill" />
                        ) : i === phase.step ? (
                          <CircleNotch aria-hidden size={28} className="animate-spin" />
                        ) : (
                          <span aria-hidden className="inline-block size-7 rounded-full border-2 border-current" />
                        )}
                        <span className="text-lg">{label}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-6 text-sm text-ink-soft">
                    {t.stepsTime}
                  </p>
                </div>
              ) : (
                <Recorder disabled={busy} onRecorded={onRecorded} onError={onRecorderError} />
              )}

              <div aria-live="polite">
                {flash && !notice && (
                  <p className="mt-4 flex items-center gap-3 border-l-4 border-ink bg-paper-deep/60 px-4 py-3">
                    <CheckCircle aria-hidden size={24} weight="fill" className="shrink-0" />
                    {flash}
                  </p>
                )}
                {notice && (
                  <div role="alert" className="mt-4 flex gap-3 border-l-4 border-accent bg-paper-deep/60 px-4 py-3">
                    <WarningCircle aria-hidden size={26} weight="fill" className="mt-0.5 shrink-0 text-accent" />
                    <p>
                      <span className="block font-medium">{noticeText(notice).title}</span>
                      <span className="block text-base text-ink-soft">{noticeText(notice).detail}</span>
                    </p>
                  </div>
                )}
              </div>

              {phase.kind === "idle" && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setFlash(null);
                      setPhase({ kind: "confirm", draft: emptyDraft(), saving: false, error: null });
                    }}
                    className="inline-flex min-h-12 items-center gap-2 rounded-sm px-3 underline underline-offset-4"
                  >
                    <Keyboard aria-hidden size={22} />
                    {t.typeInstead}
                  </button>
                </div>
              )}
            </div>
          )}

          {phase.kind === "confirm" && (
            <ConfirmCard
              draft={phase.draft}
              onChange={(draft) => setPhase({ ...phase, draft, error: null })}
              customerNames={customerNames}
              saving={phase.saving}
              error={phase.error}
              onSave={onSave}
              onRecordAgain={phase.draft.fromVoice ? () => setPhase({ kind: "idle" }) : null}
              onCancel={() => {
                if (!isDirty(phase.draft) || window.confirm(t.discardConfirm)) setPhase({ kind: "idle" });
              }}
            />
          )}

          {phase.kind === "saved" && (
            <div className="settle border border-ink px-5 py-6" role="status" aria-live="polite">
              <p className="flex items-center gap-3">
                <CheckCircle aria-hidden size={32} weight="fill" />
                <span className="text-xl font-medium">{t.saved}</span>
              </p>
              <p className="mt-5 text-base">
                <span lang="hi" className="font-medium">
                  {phase.customer.name}
                </span>{" "}
                · {phase.entry.kind === "jama" ? t.kindJamaShort : t.kindUdhaarShort}{" "}
                <span className="num">{formatRupees(phase.entry.total)}</span>
              </p>
              <p className="mt-4 text-sm text-ink-soft">
                {t.newBalance}
              </p>
              <p className="num text-5xl">{formatRupees(phase.customer.balance)}</p>
              <NotifyCustomer shopName={shop.name} entry={phase.entry} customer={phase.customer} />
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
                <SpeakButton
                  target={{ entryId: phase.entry.id }}
                  label={t.readToCustomer}
                  onUnauthorized={toHome}
                />
                <button
                  type="button"
                  onClick={() => setPhase({ kind: "idle" })}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-sm bg-ink px-5 text-paper"
                >
                  {t.nextEntry}
                </button>
              </div>
              <button
                type="button"
                onClick={onUndo}
                disabled={phase.undoing}
                className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-sm px-1 text-ink-soft underline underline-offset-4 disabled:opacity-60"
              >
                {phase.undoing ? (
                  <CircleNotch aria-hidden size={20} className="animate-spin" />
                ) : (
                  <ArrowCounterClockwise aria-hidden size={20} />
                )}
                {t.undo}
              </button>
              {phase.error && (
                <p role="alert" className="mt-2 text-accent">
                  {localize(phase.error, lang)}
                </p>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="customers-title">
          <h2 id="customers-title" className="mb-3 flex items-baseline gap-2 font-display text-3xl">
            {t.customers}
          </h2>
          {customersError ? (
            <p role="alert" className="text-accent">
              {customersError ? localize(customersError, lang) : t.customersLoadFail}{" "}
              <button type="button" onClick={refreshCustomers} className="min-h-12 underline underline-offset-4">
                {t.retry}
              </button>
            </p>
          ) : customers === null ? (
            <p className="flex items-center gap-3 text-ink-soft" role="status">
              <CircleNotch aria-hidden size={22} className="animate-spin" />
              {t.loading}
            </p>
          ) : (
            <CustomerList customers={customers} onOpen={setOpen} />
          )}
        </section>
      </main>

      {open && (
        <CustomerPanel
          customer={open}
          onClose={closePanel}
          onUnauthorized={toHome}
          onPayment={onPayment}
          onChanged={refreshCustomers}
        />
      )}
    </div>
  );
}
