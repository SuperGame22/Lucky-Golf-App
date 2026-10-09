import { describe, expect, it } from "vitest";
import { describePrize, easternDate, parsePrizeCsv, timeLeft, upcomingWeeks, weekStartDate } from "../raffle";

describe("raffle weeks", () => {
  it("turn over Sunday 8 pm Eastern", () => {
    expect(weekStartDate(new Date("2026-10-12T00:00:00Z"))).toBe("2026-10-11"); // Sun 8:00 pm EDT
    expect(weekStartDate(new Date("2026-10-11T23:59:00Z"))).toBe("2026-10-04"); // Sun 7:59 pm EDT
    expect(weekStartDate(new Date("2026-10-14T15:00:00Z"))).toBe("2026-10-11"); // Wednesday
  });
  it("follow the clock change in November", () => {
    expect(weekStartDate(new Date("2026-11-02T00:59:00Z"))).toBe("2026-10-25"); // Sun 7:59 pm EST
    expect(weekStartDate(new Date("2026-11-02T01:00:00Z"))).toBe("2026-11-01"); // Sun 8:00 pm EST
  });
  it("lists the weeks ahead, starting with the running one", () => {
    expect(upcomingWeeks(new Date("2026-10-14T15:00:00Z"), 3)).toEqual(["2026-10-11", "2026-10-18", "2026-10-25"]);
    expect(upcomingWeeks(new Date("2026-10-14T15:00:00Z"), 13)).toHaveLength(13);
  });
  it("reads a stored week start as its Eastern date", () => {
    expect(easternDate(new Date("2026-10-12T00:00:00Z"))).toBe("2026-10-11");
  });
});

describe("prize upload", () => {
  it("reads rows, with or without a header, quotes and blanks", () => {
    const { items, errors } = parsePrizeCsv(
      `week_start,prize_name,prize_credit,prize_spins,prize_products\n2026-11-08,"Hat, cap and balls",25,5,Lucky hat\n2026-11-15,Spinz boost,,10,`);
    expect(errors).toEqual([]);
    expect(items).toEqual([
      { week_start: "2026-11-08", prize_name: "Hat, cap and balls", prize_credit: 25, prize_spins: 5, prize_products: "Lucky hat" },
      { week_start: "2026-11-15", prize_name: "Spinz boost", prize_credit: 0, prize_spins: 10 },
    ]);
  });
  it("reports each bad line and keeps the good ones", () => {
    const { items, errors } = parsePrizeCsv(`2026-11-08,Good,10,0,\n2026-11-09,Monday,1,1,\nnot-a-date,x,1,1,\n2026-11-15,,5,0,\n2026-11-22,Neg,-5,0,\n2026-11-29,Frac,1,1.5,`);
    expect(items).toHaveLength(1);
    expect(errors).toHaveLength(5);
    expect(errors[0]).toMatch(/Line 2.*not a Sunday/);
  });
});

describe("display", () => {
  it("describes a prize bundle", () => {
    expect(describePrize({ prize_credit: 25, prize_spins: 5, prize_products: " Hat " })).toBe("$25 credit + 5 Spinz + Hat");
    expect(describePrize({ prize_credit: 0, prize_spins: 0, prize_products: null })).toBe("");
  });
  it("counts down", () => {
    const now = new Date("2026-10-14T00:00:00Z");
    expect(timeLeft("2026-10-17T04:30:00Z", now)).toBe("3d 4h");
    expect(timeLeft("2026-10-14T04:12:00Z", now)).toBe("4h 12m");
    expect(timeLeft("2026-10-14T00:09:30Z", now)).toBe("9m");
    expect(timeLeft("2026-10-13T00:00:00Z", now)).toBe("Drawing soon");
  });
});
