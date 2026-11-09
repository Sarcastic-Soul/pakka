"use client";

import { useState } from "react";
import { Check, Copy, WhatsappLogo } from "@phosphor-icons/react";
import type { Customer, Entry } from "@/lib/khata/types";
import { customerMessage, whatsappLink } from "@/lib/khata/client/message";
import { useLang } from "@/lib/i18n/useLang";

/**
 * Shows the message the customer should get for a saved entry. Sending it right
 * away is the fraud check: the customer sees every rupee that goes on the tab.
 * Delivery is a WhatsApp share link, not a real integration.
 */
export default function NotifyCustomer({
  shopName,
  entry,
  customer,
}: {
  shopName: string;
  entry: Entry;
  customer: Customer;
}) {
  const { lang, t } = useLang();
  const [copied, setCopied] = useState(false);
  const text = customerMessage(shopName, entry, customer, lang);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; the text is still on screen to copy by hand
    }
  };

  return (
    <div className="mt-6 border-t border-rule pt-5">
      <h3 className="text-lg font-medium">{t.notifyTitle}</h3>
      <p className="mt-1 text-sm text-ink-soft">{t.notifyHelp}</p>
      <p lang={lang} className="mt-3 whitespace-pre-line rounded-sm bg-paper-deep/60 px-4 py-3 text-base">
        {text}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <a
          href={whatsappLink(text)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border-2 border-ink px-4 font-medium"
        >
          <WhatsappLogo aria-hidden size={22} weight="fill" />
          {t.notifyWhatsApp}
        </a>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm px-4 underline underline-offset-4"
        >
          {copied ? <Check aria-hidden size={20} /> : <Copy aria-hidden size={20} />}
          <span aria-live="polite">{copied ? t.notifyCopied : t.notifyCopy}</span>
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{t.notifyDemoNote}</p>
    </div>
  );
}
