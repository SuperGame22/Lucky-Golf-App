import { describe, expect, it } from "vitest";
import { SURVEY_QUESTIONS, nextQuestion } from "../questions";

describe("beta survey", () => {
  it("asks the first unanswered question, then goes away", () => {
    expect(nextQuestion([])?.key).toBe("prize_style");
    expect(nextQuestion(["prize_style"])).toBeNull();
  });
  it("moves on to the next question when one is added", () => {
    const two = [...SURVEY_QUESTIONS, { key: "q2", text: "?", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }];
    expect(nextQuestion(["prize_style"], two)?.key).toBe("q2");
  });
});
