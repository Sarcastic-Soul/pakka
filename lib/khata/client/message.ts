import type { Lang } from "@/lib/i18n/dict";
import type { Customer, Entry } from "@/lib/khata/types";
import { formatRupees } from "./format";

function itemsLine(e: Entry): string {
  return e.items
    .map((it) => [it.name, it.qty, it.amount !== null ? formatRupees(it.amount) : null].filter(Boolean).join(" "))
    .join(", ");
}

function balanceLine(balance: number, lang: Lang): string {
  if (lang === "hi") {
    if (balance > 0) return `अब कुल बाकी ${formatRupees(balance)} है।`;
    if (balance < 0) return `आपके ${formatRupees(-balance)} एडवांस जमा हैं।`;
    return "अब आपका पूरा हिसाब बराबर है।";
  }
  if (balance > 0) return `Total left to pay: ${formatRupees(balance)}.`;
  if (balance < 0) return `You have ${formatRupees(-balance)} paid in advance.`;
  return "Your account is fully settled.";
}

/**
 * The message the customer gets after an entry is saved: what was just added
 * and what is left to pay. Built only from the saved entry, so it matches the khata.
 */
export function customerMessage(shopName: string, entry: Entry, customer: Customer, lang: Lang): string {
  const items = itemsLine(entry);
  const amount = formatRupees(entry.total);
  if (lang === "hi") {
    const what =
      entry.kind === "jama"
        ? `${shopName} में आपके ${amount} जमा हुए।`
        : `${shopName} में आपके खाते में ${amount} का उधार लिखा गया${items ? ` (${items})` : ""}।`;
    return `नमस्ते ${customer.name} जी, ${what} ${balanceLine(customer.balance, lang)} गलत हो तो दुकान पर बताइए। — पक्का`;
  }
  const what =
    entry.kind === "jama"
      ? `${shopName} received your payment of ${amount}.`
      : `${shopName} added ${amount} to your tab${items ? ` (${items})` : ""}.`;
  return `Hello ${customer.name}, ${what} ${balanceLine(customer.balance, lang)} If this is wrong, please tell the shop. — Pakka`;
}

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
