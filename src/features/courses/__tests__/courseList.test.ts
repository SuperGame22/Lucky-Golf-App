import { describe, expect, it } from "vitest";
import { MAX_COURSES, rankCourses } from "../courseList";

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe("course list", () => {
  it("shows at most five", () => {
    expect(MAX_COURSES).toBe(5);
  });

  it("puts courses that start with the search first, then ones with a matching word, then the rest", () => {
    const rows = [
      { name: "Silverado Pebble Creek" },
      { name: "Old Pebble Links" },
      { name: "Pebble Beach Golf Links" },
      { name: "Spyglass Hill (near Pebble Beach)" },
      { name: "Pebbledash" },
    ];
    expect(names(rankCourses(rows, "pebble"))).toEqual([
      "Pebble Beach Golf Links", "Pebbledash", // start with it
      "Old Pebble Links", "Silverado Pebble Creek", // a word starts with it
      "Spyglass Hill (near Pebble Beach)", // contains it
    ]);
  });

  it("is case-insensitive, ignores extra spaces, and does not change the input", () => {
    const rows = [{ name: "b course" }, { name: "A COURSE" }];
    expect(names(rankCourses(rows, "  A  ".trim()))).toEqual(["A COURSE", "b course"]);
    expect(names(rows)).toEqual(["b course", "A COURSE"]);
  });
});
