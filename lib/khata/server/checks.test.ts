import { describe, expect, it } from "vitest";
import { runChecks, type Extracted } from "./checks";
import { matchCustomer } from "./names";

const customers = [
  { id: 1, name: "रमेश वर्मा" },
  { id: 2, name: "Pooja" },
  { id: 3, name: "हज़ारी लाल" },
];

const entry = (p: Partial<Extracted>): Extracted => ({
  customer: "रमेश वर्मा",
  kind: "udhaar",
  items: [],
  total: null,
  ...p,
});

describe("runChecks", () => {
  it("passes a clean entry", () => {
    const r = runChecks(
      "रमेश वर्मा 2 Maggi 30 रुपये और दूध 28 रुपये",
      "रमेश वर्मा 2 Maggi 30 रुपये और दूध 28 रुपये",
      entry({
        items: [
          { name: "Maggi", qty: "2", amount: 30 },
          { name: "दूध", qty: null, amount: 28 },
        ],
        total: 58,
      }),
      customers,
    );
    expect(r.flags).toEqual([]);
    expect(r.customerId).toBe(1);
  });

  it("flags numbers that differ between transcripts", () => {
    const r = runChecks("500 रुपये जमा", "600 रुपये जमा", entry({ kind: "jama", total: 500 }), customers);
    expect(r.flags).toContain("numbers_differ");
    expect(r.flags).not.toContain("amount_not_heard");
  });

  it("skips numbers_differ when there is no clean transcript", () => {
    const r = runChecks("500 रुपये", null, entry({ total: 500 }), customers);
    expect(r.flags).toEqual([]);
  });

  it("treats spoken words and digits as the same number", () => {
    const r = runChecks("दो सौ चालीस रुपये", "240 रुपये", entry({ total: 240 }), customers);
    expect(r.flags).toEqual([]);
  });

  it("flags an empty raw transcript", () => {
    const r = runChecks("  ", "500", entry({ total: 500 }), customers);
    expect(r.flags).toContain("raw_empty");
    expect(r.flags).not.toContain("amount_not_heard");
  });

  it("flags an amount in neither transcript", () => {
    const r = runChecks("Maggi 30", "Maggi 30", entry({ items: [{ name: "Maggi", qty: null, amount: 40 }], total: 40 }), customers);
    expect(r.flags).toContain("amount_not_heard");
  });

  it("counts a total equal to the item sum as heard", () => {
    const r = runChecks(
      "Maggi 30 दूध 28",
      null,
      entry({
        items: [
          { name: "Maggi", qty: null, amount: 30 },
          { name: "दूध", qty: null, amount: 28 },
        ],
        total: 58,
      }),
      customers,
    );
    expect(r.flags).toEqual([]);
  });

  it("flags a sum mismatch", () => {
    const r = runChecks(
      "Maggi 30 दूध 28 कुल 60",
      null,
      entry({
        items: [
          { name: "Maggi", qty: null, amount: 30 },
          { name: "दूध", qty: null, amount: 28 },
        ],
        total: 60,
      }),
      customers,
    );
    expect(r.flags).toEqual(["sum_mismatch"]);
  });

  it("flags a new customer and no total", () => {
    const r = runChecks("सुरेश को Maggi दे दो", null, entry({ customer: "सुरेश", items: [{ name: "Maggi", qty: null, amount: null }] }), customers);
    expect(r.flags).toEqual(["new_customer", "no_total"]);
    expect(r.customerId).toBeNull();
    expect(r.customer).toBe("सुरेश");
  });

  it("flags new_customer when no name was found", () => {
    const r = runChecks("500", null, entry({ customer: null, total: 500 }), customers);
    expect(r.flags).toEqual(["new_customer"]);
  });
});

describe("matchCustomer", () => {
  it("ignores case, spaces and nukta", () => {
    expect(matchCustomer("pooja", customers)?.id).toBe(2);
    expect(matchCustomer(" POOJA ", customers)?.id).toBe(2);
    expect(matchCustomer("रमेशवर्मा", customers)?.id).toBe(1);
    expect(matchCustomer("हजारी लाल", customers)?.id).toBe(3);
  });
  it("does not match a different name", () => {
    expect(matchCustomer("रमेश", customers)).toBeNull();
    expect(matchCustomer(null, customers)).toBeNull();
  });
});
