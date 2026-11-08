"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, CircleNotch, Keyboard, SignOut, WarningCircle } from "@phosphor-icons/react";
import type { Customer, Entry, Shop } from "@/lib/khata/types";
import { ApiError, getMe, listCustomers, logout, parseEntry, saveEntry } from "@/lib/khata/client/api";
import { decodeToMono16k, RATE, toWav } from "@/lib/khata/client/audio";
import { draftFromParse, emptyDraft, finalizeDraft, type Draft } from "@/lib/khata/client/draft";
import { formatRupees } from "@/lib/khata/client/format";
import ConfirmCard from "./ConfirmCard";
import CustomerList from "./CustomerList";
import CustomerPanel from "./CustomerPanel";
import Recorder, { type RecorderError } from "./Recorder";
import SpeakButton from "./SpeakButton";

type Phase =
  | { kind: "idle" }
  | { kind: "processing"; step: number }
  | { kind: "confirm"; draft: Draft; saving: boolean; error: string | null }
  | { kind: "saved"; entry: Entry; customer: Customer };

type Notice = { hi: string; en: string } | null;

const STEPS = [
  { hi: "आवाज़ साफ़ की जा रही है…", en: "Cleaning the audio" },
  { hi: "Prisma सुन रहा है…", en: "Prisma is listening, twice" },
  { hi: "खाता बन रहा है…", en: "Writing the entry" },
];
// When each step label appears (ms after upload starts). Timed, not measured.
const STEP_AT = [0, 2500, 6000];

const RECORDER_ERRORS: Record<RecorderError, { hi: string; en: string }> = {
  denied: {
    hi: "माइक की इजाज़त नहीं मिली",
    en: "Microphone access was blocked. Allow it in the browser settings, or type the entry instead.",
  },
  unsupported: {
    hi: "इस ब्राउज़र में रिकॉर्डिंग नहीं चलती",
    en: "This browser cannot record. Try Chrome or Safari, or type the entry instead.",
  },
  failed: {
    hi: "माइक शुरू नहीं हो पाया",
    en: "The microphone could not start. Check that no other app is using it.",
  },
};

function messageFor(err: unknown): Notice {
  if (err instanceof ApiError) {
    if (err.status === 429) return { hi: "अभी बहुत भीड़ है, थोड़ी देर बाद बोलिए", en: err.message };
    if (err.status === 403) return { hi: "आवाज़ से एंट्री अभी बंद है — लिखकर डालिए", en: err.message };
    return { hi: "कुछ गड़बड़ हुई", en: err.message };
  }
  return { hi: "कुछ गड़बड़ हुई", en: err instanceof Error ? err.message : "Something went wrong." };
}

export default function KhataApp() {
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [notice, setNotice] = useState<Notice>(null);
  const [open, setOpen] = useState<Customer | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const workArea = useRef<HTMLDivElement | null>(null);

  const toHome = useCallback(() => router.replace("/"), [router]);
  const closePanel = useCallback(() => setOpen(null), []);

  const refreshCustomers = useCallback(async () => {
    try {
      const r = await listCustomers();
      setCustomers(r.customers);
      setCustomersError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return toHome();
      setCustomersError(err instanceof Error ? err.message : "ग्राहक लोड नहीं हुए");
    }
  }, [toHome]);

  useEffect(() => {
    let alive = true;
    getMe()
      .then((r) => {
        if (!alive) return;
        setShop(r.shop);
        void refreshCustomers();
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) toHome();
        else setAuthError(err instanceof Error ? err.message : "Could not load your shop.");
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
      setPhase({ kind: "processing", step: 0 });
      clearTimers();
      try {
        const samples = await decodeToMono16k(await blob.arrayBuffer());
        if (samples.length < RATE * 0.5) {
          setPhase({ kind: "idle" });
          setNotice({ hi: "रिकॉर्डिंग बहुत छोटी थी", en: "That was too short. Tap, speak the entry, then tap again." });
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
            ? messageFor(err)
            : { hi: "आवाज़ पढ़ी नहीं जा सकी", en: "Could not read the recording. Please try again." },
        );
      }
    },
    [toHome],
  );

  const onRecorderError = useCallback((e: RecorderError) => setNotice(RECORDER_ERRORS[e]), []);

  const onSave = async () => {
    if (phase.kind !== "confirm") return;
    const r = finalizeDraft(phase.draft, customerNames);
    if (!r.ok) {
      setPhase({ ...phase, error: r.error });
      return;
    }
    setPhase({ ...phase, saving: true, error: null });
    try {
      const saved = await saveEntry(r.entry);
      setPhase({ kind: "saved", entry: saved.entry, customer: saved.customer });
      void refreshCustomers();
      scrollToWork();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return toHome();
      setPhase({ ...phase, saving: false, error: err instanceof Error ? err.message : "सेव नहीं हुआ" });
    }
  };

  const onLogout = async () => {
    try {
      await logout();
    } catch {
      // cookie may already be gone; go home either way
    }
    toHome();
  };

  if (!shop) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-5">
        {authError ? (
          <div role="alert" className="text-center">
            <WarningCircle aria-hidden size={40} className="mx-auto text-accent" />
            <p className="mt-3 text-lg">{authError}</p>
            <button
              type="button"
              onClick={() => location.reload()}
              className="mt-4 min-h-12 rounded-sm border-2 border-ink px-5"
            >
              <span lang="hi">फिर कोशिश कीजिए</span> · Try again
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-3 text-ink-soft" role="status">
            <CircleNotch aria-hidden size={24} className="animate-spin" />
            <span lang="hi">खाता खुल रहा है…</span>
          </p>
        )}
      </main>
    );
  }

  const busy = phase.kind === "processing" || phase.kind === "confirm";

  return (
    <div className="khata-app min-h-screen">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm text-ink-soft">
              Pakka · <span lang="hi">पक्का</span>
            </p>
            <h1 className="truncate font-display text-2xl leading-tight">{shop.name}</h1>
            <p className="text-sm text-ink-soft">
              <span lang="hi">दुकान कोड</span> · Shop code <span className="num text-ink">{shop.code}</span>
              {shop.isDemo && (
                <span className="ml-2 inline-block border border-accent px-1.5 text-xs font-medium uppercase tracking-wide text-accent">
                  Demo
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-sm border border-ink px-3"
          >
            <SignOut aria-hidden size={20} />
            <span className="max-sm:sr-only">
              <span lang="hi">बाहर</span> · Log out
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-4 pb-24 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <section aria-labelledby="new-entry" ref={workArea} className="scroll-mt-4">
          <h2 id="new-entry" className="sr-only">
            नई एंट्री · New entry
          </h2>

          {(phase.kind === "idle" || phase.kind === "processing") && (
            <div className="py-4">
              {phase.kind === "processing" ? (
                <div className="flex flex-col items-center py-8" role="status" aria-live="polite">
                  <ol className="w-full max-w-sm space-y-4">
                    {STEPS.map((s, i) => (
                      <li
                        key={s.en}
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
                        <span>
                          <span lang="hi" className="block text-lg">
                            {s.hi}
                          </span>
                          <span className="block text-sm text-ink-soft">{s.en}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-6 text-sm text-ink-soft">
                    <span lang="hi">इसमें 5–15 सेकंड लगते हैं</span> · Usually 5–15 seconds
                  </p>
                </div>
              ) : (
                <Recorder disabled={busy} onRecorded={onRecorded} onError={onRecorderError} />
              )}

              <div aria-live="polite">
                {notice && (
                  <div role="alert" className="mt-4 flex gap-3 border-l-4 border-accent bg-paper-deep/60 px-4 py-3">
                    <WarningCircle aria-hidden size={26} weight="fill" className="mt-0.5 shrink-0 text-accent" />
                    <p>
                      <span lang="hi" className="block font-medium">
                        {notice.hi}
                      </span>
                      <span className="block text-base text-ink-soft">{notice.en}</span>
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
                      setPhase({ kind: "confirm", draft: emptyDraft(), saving: false, error: null });
                    }}
                    className="inline-flex min-h-12 items-center gap-2 rounded-sm px-3 underline underline-offset-4"
                  >
                    <Keyboard aria-hidden size={22} />
                    <span lang="hi">बिना आवाज़ के लिखिए</span>
                    <span className="text-sm text-ink-soft">· Type instead</span>
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
              onCancel={() => setPhase({ kind: "idle" })}
            />
          )}

          {phase.kind === "saved" && (
            <div className="settle border border-ink px-5 py-6" role="status" aria-live="polite">
              <p className="flex items-center gap-3">
                <CheckCircle aria-hidden size={32} weight="fill" />
                <span>
                  <span lang="hi" className="block text-xl font-medium">
                    खाते में लिख दिया
                  </span>
                  <span className="block text-sm text-ink-soft">Saved to the khata</span>
                </span>
              </p>
              <p className="mt-5 text-base">
                <span lang="hi" className="font-medium">
                  {phase.customer.name}
                </span>{" "}
                · <span lang="hi">{phase.entry.kind === "jama" ? "जमा" : "उधार"}</span>{" "}
                <span className="num">{formatRupees(phase.entry.total)}</span>
              </p>
              <p className="mt-4 text-sm text-ink-soft">
                <span lang="hi">नया बाकी</span> · New balance
              </p>
              <p className="num text-5xl">{formatRupees(phase.customer.balance)}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
                <SpeakButton
                  target={{ entryId: phase.entry.id }}
                  hi="ग्राहक को सुनाइए"
                  en="Read out to customer"
                  onUnauthorized={toHome}
                />
                <button
                  type="button"
                  onClick={() => setPhase({ kind: "idle" })}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-sm bg-ink px-5 text-paper"
                >
                  <span lang="hi">अगली एंट्री</span>
                  <span className="text-sm opacity-80">· Next entry</span>
                </button>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="customers-title">
          <h2 id="customers-title" className="mb-3 flex items-baseline gap-2 font-display text-3xl">
            <span lang="hi">ग्राहक</span>
            <span className="font-sans text-base text-ink-soft">· Customers</span>
          </h2>
          {customersError ? (
            <p role="alert" className="text-accent">
              {customersError}{" "}
              <button type="button" onClick={refreshCustomers} className="min-h-12 underline underline-offset-4">
                <span lang="hi">फिर कोशिश</span> · Retry
              </button>
            </p>
          ) : customers === null ? (
            <p className="flex items-center gap-3 text-ink-soft" role="status">
              <CircleNotch aria-hidden size={22} className="animate-spin" />
              <span lang="hi">लोड हो रहा है…</span>
            </p>
          ) : (
            <CustomerList customers={customers} onOpen={setOpen} />
          )}
        </section>
      </main>

      {open && <CustomerPanel customer={open} onClose={closePanel} onUnauthorized={toHome} />}
    </div>
  );
}
