import { describe, expect, it } from "vitest";
import type { ParseResult } from "@/lib/khata/types";
import {
  draftFromParse,
  emptyDraft,
  finalizeDraft,
  isNewCustomer,
  itemsSum,
  newItem,
  warningFlags,
} from "./draft";

const parse: ParseResult = {
  transcriptRaw: "रमेश के खाते में 2 Maggi 30, दूध 38",
  transcriptClean: "रमेश के खाते में 2 Maggi 30, दूध 28",
  customer: "रमेश",
  customerId: 4,
  kind: "udhaar",
  items: [
    { name: "Maggi", qty: "2", amount: 30 },
    { name: "दूध", qty: null, amount: 28 },
  ],
  total: 58,
  flags: ["numbers_differ"],
  noise: { snrDb: 6.5 },
};

describe("draftFromParse", () => {
  it("copies the parse result into editable text fields", () => {
    const d = draftFromParse(parse);
    expect(d.customer).toBe("रमेश");
    expect(d.total).toBe("58");
    expect(d.items.map((i) => [i.name, i.qty, i.amount])).toEqual([
      ["Maggi", "2", "30"],
      ["दूध", "", "28"],
    ]);
    expect(d.snrDb).toBe(6.5);
    expect(d.fromVoice).toBe(true);
    expect(new Set(d.items.map((i) => i.key)).size).toBe(2);
  });

  it("gives one empty row when nothing was parsed", () => {
    const d = draftFromParse({ ...parse, items: [], total: null, customer: null });
    expect(d.items).toHaveLength(1);
    expect(d.total).toBe("");
    expect(d.customer).toBe("");
  });
});

describe("helpers", () => {
  it("sums only parsable amounts", () => {
    expect(itemsSum([newItem("a", "", "30"), newItem("b", "", ""), newItem("c", "", "28")])).toBe(58);
    expect(itemsSum([newItem("a")])).toBeNull();
  });
  it("matches customers case-insensitively", () => {
    expect(isNewCustomer(" ramesh ", ["Ramesh"])).toBe(false);
    expect(isNewCustomer("Suresh", ["Ramesh"])).toBe(true);
    expect(isNewCustomer("  ", ["Ramesh"])).toBe(false);
  });
  it("drops new_customer from warnings", () => {
    expect(warningFlags(["new_customer", "sum_mismatch"])).toEqual(["sum_mismatch"]);
  });
});

describe("finalizeDraft", () => {
  it("builds the entry body", () => {
    const r = finalizeDraft(draftFromParse(parse), ["रमेश"]);
    expect(r).toEqual({
      ok: true,
      entry: {
        customerName: "रमेश",
        kind: "udhaar",
        items: [
          { name: "Maggi", qty: "2", amount: 30 },
          { name: "दूध", qty: null, amount: 28 },
        ],
        total: 58,
        transcriptRaw: parse.transcriptRaw,
        transcriptClean: parse.transcriptClean,
        flags: ["numbers_differ"],
      },
    });
  });

  it("adds new_customer when the typed name is not in the list", () => {
    const d = { ...draftFromParse(parse), customer: "सुरेश" };
    const r = finalizeDraft(d, ["रमेश"]);
    expect(r.ok && r.entry.flags).toEqual(["numbers_differ", "new_customer"]);
  });

  it("allows a payment with no items and skips blank rows", () => {
    const d = { ...emptyDraft(), customer: "रमेश", kind: "jama" as const, total: "500" };
    const r = finalizeDraft(d, ["रमेश"]);
    expect(r.ok && r.entry).toMatchObject({ kind: "jama", items: [], total: 500, flags: [] });
  });

  it("rejects missing name, missing total and bad amounts", () => {
    expect(finalizeDraft({ ...emptyDraft(), total: "10" }, []).ok).toBe(false);
    expect(finalizeDraft({ ...emptyDraft(), customer: "a" }, []).ok).toBe(false);
    expect(finalizeDraft({ ...emptyDraft(), customer: "a", total: "0" }, []).ok).toBe(false);
    const bad = { ...emptyDraft(), customer: "a", total: "10", items: [newItem("x", "", "1.5")] };
    expect(finalizeDraft(bad, []).ok).toBe(false);
    const noName = { ...emptyDraft(), customer: "a", total: "10", items: [newItem("", "", "10")] };
    expect(finalizeDraft(noName, []).ok).toBe(false);
  });
});
