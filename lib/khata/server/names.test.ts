import { describe, expect, it } from "vitest";
import { matchCustomer, nameKey, stripHonorifics, suggestCustomer } from "./names";

const customers = [
  { id: 1, name: "रमेश" },
  { id: 2, name: "जीतू" },
  { id: 3, name: "Bhaiyalal" },
  { id: 4, name: "Sunita" },
];

describe("stripHonorifics", () => {
  it.each([
    ["रमेश जी", "रमेश"],
    ["रमेश जि", "रमेश"],
    ["रमेश भैया", "रमेश"],
    ["रमेश भइया", "रमेश"],
    ["रमेश भाई", "रमेश"],
    ["रमेश साहब", "रमेश"],
    ["रमेश साब", "रमेश"],
    ["रमेश बाबू", "रमेश"],
    ["सुनीता दीदी", "सुनीता"],
    ["सुनीता बहन", "सुनीता"],
    ["सुनीता बहनजी", "सुनीता"],
    ["शर्मा अंकल", "शर्मा"],
    ["शर्मा आंटी", "शर्मा"],
    ["Ramesh ji", "Ramesh"],
    ["Ramesh bhaiya", "Ramesh"],
    ["Ramesh bhai", "Ramesh"],
    ["Ramesh sahab", "Ramesh"],
    ["Sunita didi", "Sunita"],
    ["Sharma uncle", "Sharma"],
    ["Sharma aunty", "Sharma"],
    ["श्री रमेश", "रमेश"],
    ["shri Ramesh", "Ramesh"],
    ["Mr. Sharma", "Sharma"],
    ["Mrs Sharma", "Sharma"],
    ["भैया रमेश", "रमेश"],
    ["श्री रमेश जी", "रमेश"],
  ])("%s -> %s", (input, out) => {
    expect(stripHonorifics(input)).toBe(out);
  });

  it("only strips whole words", () => {
    expect(stripHonorifics("जीतू")).toBe("जीतू");
    expect(stripHonorifics("Bhaiyalal")).toBe("Bhaiyalal");
    expect(stripHonorifics("जीतू भैया")).toBe("जीतू");
  });

  it("never strips down to an empty name", () => {
    expect(stripHonorifics("भैया")).toBe("भैया");
    expect(stripHonorifics("जी")).toBe("जी");
    expect(nameKey("bhai")).toBe("bhai");
  });
});

describe("matchCustomer", () => {
  it("matches names with honorifics", () => {
    expect(matchCustomer("रमेश जी", customers)?.id).toBe(1);
    expect(matchCustomer("रमेश भैया", customers)?.id).toBe(1);
    expect(matchCustomer("श्री रमेश", customers)?.id).toBe(1);
    expect(matchCustomer("Sunita didi", customers)?.id).toBe(4);
  });

  it("leaves names that only start with an honorific alone", () => {
    expect(matchCustomer("जीतू", customers)?.id).toBe(2);
    expect(matchCustomer("Bhaiyalal", customers)?.id).toBe(3);
    expect(nameKey("Bhaiyalal")).toBe("bhaiyalal");
  });

  it("returns null for no match or empty input", () => {
    expect(matchCustomer("सुरेश जी", customers)).toBeNull();
    expect(matchCustomer(null, customers)).toBeNull();
    expect(matchCustomer("  ", customers)).toBeNull();
  });
});

describe("suggestCustomer by first name", () => {
  const list = [
    { id: 1, name: "रमेश वर्मा" },
    { id: 2, name: "सुनीता साहू" },
    { id: 3, name: "अनिल तिवारी" },
    { id: 4, name: "अनिल गुप्ता" },
  ];
  it("matches a unique first name, with or without जी", () => {
    expect(suggestCustomer("रमेश", list)?.id).toBe(1);
    expect(suggestCustomer("रमेश जी", list)?.id).toBe(1);
  });
  it("does not guess when two customers share the first name", () => {
    expect(suggestCustomer("अनिल", list)).toBeNull();
  });
  it("does not match a different surname", () => {
    expect(suggestCustomer("रमेश गुप्ता", list)).toBeNull();
  });
  it("saving stays strict", () => {
    expect(matchCustomer("रमेश", list)).toBeNull();
  });
});
