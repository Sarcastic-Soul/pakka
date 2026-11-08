import { describe, expect, it } from "vitest";
import { createLimiter } from "./limits";

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createLimiter", () => {
  it("caps each key", () => {
    const c = clock();
    const l = createLimiter({ perKey: 2, windowMs: 1000, globalMax: 100, now: c.now });
    expect(l.check("a")).toBe("ok");
    expect(l.check("a")).toBe("ok");
    expect(l.check("a")).toBe("key");
    expect(l.check("b")).toBe("ok");
  });

  it("caps the total", () => {
    const c = clock();
    const l = createLimiter({ perKey: 5, windowMs: 1000, globalMax: 3, now: c.now });
    expect(l.check("a")).toBe("ok");
    expect(l.check("b")).toBe("ok");
    expect(l.check("c")).toBe("ok");
    expect(l.check("d")).toBe("global");
  });

  it("resets after the window", () => {
    const c = clock();
    const l = createLimiter({ perKey: 1, windowMs: 1000, globalMax: 1, now: c.now });
    expect(l.check("a")).toBe("ok");
    expect(l.check("a")).toBe("key");
    c.advance(1000);
    expect(l.check("a")).toBe("ok");
  });

  it("uses a separate global window", () => {
    const c = clock();
    const l = createLimiter({
      perKey: 1,
      windowMs: 1000,
      globalMax: 2,
      globalWindowMs: 10_000,
      now: c.now,
    });
    expect(l.check("a")).toBe("ok");
    expect(l.check("b")).toBe("ok");
    c.advance(1000);
    expect(l.check("a")).toBe("global");
    c.advance(9000);
    expect(l.check("a")).toBe("ok");
  });

  it("prunes old keys", () => {
    const c = clock();
    const l = createLimiter({ perKey: 1, windowMs: 1000, globalMax: 1e9, now: c.now });
    for (let i = 0; i < 500; i++) l.check(`k${i}`);
    expect(l.size()).toBe(500);
    c.advance(1000);
    l.check("new");
    expect(l.size()).toBe(1);
  });
});
