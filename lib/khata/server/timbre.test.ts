import { describe, expect, it } from "vitest";
import { balanceText, entryText } from "./timbre";

describe("speech text", () => {
  it("reads an udhaar entry with Indian grouping", () => {
    expect(entryText("रमेश वर्मा", "udhaar", 240, 1140)).toBe(
      "रमेश वर्मा जी, आज 240 रुपये का सामान खाते में लिखा गया। अब कुल बाकी 1,140 रुपये है।",
    );
    expect(entryText("Pooja", "udhaar", 240, 240000)).toContain("2,40,000");
  });
  it("reads a jama entry", () => {
    expect(entryText("सुनीता साहू", "jama", 500, 0)).toBe("सुनीता साहू जी, आपने 500 रुपये जमा किए। अब आपका कोई बाकी नहीं है।");
  });
  it("reads a balance", () => {
    expect(balanceText("अनिल", 186)).toBe("अनिल जी, आपका कुल बाकी 186 रुपये है।");
    expect(balanceText("अनिल", -50)).toContain("50 रुपये एडवांस");
  });
});
