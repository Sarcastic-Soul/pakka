import { describe, expect, it } from "vitest";
import type { Customer, Entry } from "@/lib/khata/types";
import { customerMessage, whatsappLink } from "./message";

const entry: Entry = {
  id: 1,
  customerId: 7,
  customerName: "रमेश वर्मा",
  kind: "udhaar",
  items: [
    { name: "Maggi", qty: "2", amount: 30 },
    { name: "दूध", qty: null, amount: 28 },
  ],
  total: 58,
  flags: [],
  transcriptRaw: "",
  transcriptClean: null,
  createdAt: "2026-11-09T10:00:00.000Z",
};
const customer: Customer = { id: 7, name: "रमेश वर्मा", balance: 1258, lastEntryAt: null };

describe("customerMessage", () => {
  it("says what was added and what is left, in Hindi", () => {
    const m = customerMessage("Sharma Kirana", entry, customer, "hi");
    expect(m).toContain("₹58 का उधार");
    expect(m).toContain("Maggi 2 ₹30, दूध ₹28");
    expect(m).toContain("अब कुल बाकी ₹1,258 है।");
  });
  it("covers payments, advances and settled accounts in English", () => {
    const paid = { ...entry, kind: "jama" as const, items: [], total: 300 };
    expect(customerMessage("S", paid, { ...customer, balance: -50 }, "en")).toBe(
      "Hello रमेश वर्मा, S received your payment of ₹300. You have ₹50 paid in advance. If this is wrong, please tell the shop. — Pakka",
    );
    expect(customerMessage("S", paid, { ...customer, balance: 0 }, "en")).toContain("fully settled");
  });
  it("encodes the WhatsApp link", () => {
    expect(whatsappLink("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });
});
