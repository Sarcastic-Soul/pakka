"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleNotch } from "@phosphor-icons/react";
import type { Shop } from "@/lib/khata/types";
import { login, register, startDemo } from "@/lib/khata/client/api";

type Mode = "none" | "login" | "register";

const field =
  "min-h-12 w-full rounded-sm border border-ink/60 bg-paper px-3 text-lg text-ink focus:border-ink";

export default function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("none");
  const [busy, setBusy] = useState<"demo" | "form" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Shop | null>(null);

  const run = async (kind: "demo" | "form", fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "कुछ गड़बड़ हुई · Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const onDemo = () =>
    run("demo", async () => {
      await startDemo();
      router.push("/khata");
    });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pin = String(fd.get("pin") ?? "").trim();
    if (!/^\d{4,6}$/.test(pin)) {
      setError("PIN 4 से 6 अंकों का होना चाहिए · PIN must be 4 to 6 digits.");
      return;
    }
    if (mode === "login") {
      const code = String(fd.get("code") ?? "").trim();
      void run("form", async () => {
        await login(code, pin);
        router.push("/khata");
      });
    } else {
      const name = String(fd.get("name") ?? "").trim();
      void run("form", async () => {
        const r = await register(name, pin);
        setCreated(r.shop);
      });
    }
  };

  const tab = (m: Exclude<Mode, "none">, hi: string, en: string) => (
    <button
      type="button"
      aria-expanded={mode === m}
      aria-controls="auth-form"
      onClick={() => {
        setMode(mode === m ? "none" : m);
        setError(null);
      }}
      className={`min-h-14 flex-1 rounded-sm border px-4 py-1 ${mode === m ? "border-ink bg-ink text-paper" : "border-ink"}`}
    >
      <span lang="hi" className="block leading-tight">
        {hi}
      </span>
      <span className={`block text-sm leading-tight ${mode === m ? "text-paper/80" : "text-ink-soft"}`}>{en}</span>
    </button>
  );

  if (created) {
    return (
      <div className="border-2 border-ink p-5" role="status" aria-live="polite">
        <p lang="hi" className="text-lg font-medium">
          दुकान बन गई: {created.name}
        </p>
        <p className="mt-3 text-base text-ink-soft">
          <span lang="hi">आपका दुकान कोड</span> · Your shop code
        </p>
        <p className="num mt-1 select-all text-5xl tracking-wider">{created.code}</p>
        <p className="mt-3 border-l-4 border-accent pl-3 text-base">
          <span lang="hi" className="font-medium">
            यह कोड लिख लीजिए।
          </span>{" "}
          Note this code down. You need it and your PIN to log in again.
        </p>
        <button
          type="button"
          onClick={() => router.push("/khata")}
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-sm bg-ink px-5 text-lg text-paper"
        >
          <span lang="hi">खाता खोलिए</span> · Open the khata
          <ArrowRight aria-hidden size={22} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onDemo}
        disabled={busy !== null}
        aria-busy={busy === "demo"}
        className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-sm bg-accent px-6 text-xl font-medium text-paper shadow-[0_4px_0_0_var(--ink)] active:translate-y-0.5 active:shadow-[0_2px_0_0_var(--ink)] disabled:opacity-70"
      >
        {busy === "demo" ? <CircleNotch aria-hidden size={24} className="animate-spin" /> : null}
        <span lang="hi">Demo खोलिए</span>
        <span className="text-base font-normal opacity-90">· Try the demo</span>
        <ArrowRight aria-hidden size={22} />
      </button>
      <p className="mt-2 text-sm text-ink-soft">
        A throwaway shop with sample customers. No signup. Deleted after 24 hours.
      </p>

      <div className="mt-6 flex gap-2">
        {tab("login", "लॉगिन", "Login")}
        {tab("register", "नई दुकान", "New shop")}
      </div>

      {mode !== "none" && (
        <form id="auth-form" onSubmit={onSubmit} className="settle mt-4 space-y-4 border-l-2 border-ink pl-4">
          {mode === "login" ? (
            <div>
              <label htmlFor="auth-code" className="block">
                <span lang="hi">दुकान कोड</span> <span className="text-sm text-ink-soft">· Shop code</span>
              </label>
              <input id="auth-code" name="code" required autoComplete="username" autoCapitalize="characters" className={`${field} num mt-1 uppercase`} />
            </div>
          ) : (
            <div>
              <label htmlFor="auth-name" className="block">
                <span lang="hi">दुकान का नाम</span> <span className="text-sm text-ink-soft">· Shop name</span>
              </label>
              <input id="auth-name" name="name" lang="hi" required maxLength={60} autoComplete="organization" className={`${field} mt-1`} />
            </div>
          )}
          <div>
            <label htmlFor="auth-pin" className="block">
              PIN <span className="text-sm text-ink-soft">· 4–6 <span lang="hi">अंक</span> / digits</span>
            </label>
            <input
              id="auth-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              minLength={4}
              maxLength={6}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={`${field} num mt-1 max-w-[12rem] tracking-[0.3em]`}
            />
          </div>
          <button
            type="submit"
            disabled={busy !== null}
            aria-busy={busy === "form"}
            className="inline-flex min-h-14 items-center gap-2 rounded-sm bg-ink px-6 text-lg text-paper disabled:opacity-70"
          >
            {busy === "form" && <CircleNotch aria-hidden size={22} className="animate-spin" />}
            {mode === "login" ? (
              <>
                <span lang="hi">खोलिए</span> · Log in
              </>
            ) : (
              <>
                <span lang="hi">दुकान बनाइए</span> · Create shop
              </>
            )}
          </button>
        </form>
      )}

      <p role="alert" className="mt-4 font-medium text-accent empty:hidden">
        {error ?? ""}
      </p>
    </div>
  );
}
