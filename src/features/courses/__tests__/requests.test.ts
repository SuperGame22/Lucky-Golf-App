import { describe, expect, it } from "vitest";
import { buildHoleData, emptyHoles, photoPath, requestProblem } from "../requests";

const ok = { name: "Hidden Valley", city: "Waco", state: "TX" };
const photo = { type: "image/jpeg", size: 1_000_000 };

describe("course request form", () => {
  it("needs a name, a state and a photo", () => {
    expect(requestProblem(ok, photo)).toBeNull();
    expect(requestProblem({ ...ok, name: " " }, photo)).toMatch(/name/);
    expect(requestProblem({ ...ok, state: "" }, photo)).toMatch(/state/);
    expect(requestProblem(ok, null)).toMatch(/photo/);
  });
  it("rejects the wrong kind or size of file", () => {
    expect(requestProblem(ok, { type: "application/pdf", size: 10 })).toMatch(/JPG/);
    expect(requestProblem(ok, { type: "image/jpeg", size: 9_000_000 })).toMatch(/too big/);
  });
  it("keeps the photo inside the player's own folder", () => {
    expect(photoPath("u-1", "abc-123", "image/png")).toBe("u-1/abc-123.png");
    expect(photoPath("u-1", "../evil", "image/heic")).toBe("u-1/evil.heic");
    expect(photoPath("u-1", "x", "")).toBe("u-1/x.jpg");
  });
});

describe("hole entry", () => {
  it("builds hole data, yardage optional", () => {
    const holes = emptyHoles(9).map(() => ({ par: "4", yards: "" }));
    holes[0].yards = "380";
    const res = buildHoleData(holes);
    expect("data" in res && res.data[0]).toEqual({ hole: 1, par: 4, yards_est: 380 });
    expect("data" in res && res.data[1]).toEqual({ hole: 2, par: 4, yards_est: null });
    expect("data" in res && res.data).toHaveLength(9);
  });
  it("points at the first bad hole", () => {
    const holes = emptyHoles(18).map(() => ({ par: "4", yards: "" }));
    holes[4].par = "";
    expect(buildHoleData(holes)).toEqual({ error: "Hole 5: par must be 3 to 6" });
    holes[4].par = "5"; holes[6].yards = "5000";
    expect(buildHoleData(holes)).toEqual({ error: "Hole 7: yards must be 30 to 900" });
  });
});
