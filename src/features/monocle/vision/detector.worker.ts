/// <reference lib="webworker" />
import { Candidate, DetectionResult, DetectInput, Prior, StickDetector } from "./detector";

export type WorkerRequest =
  | { id: number; kind: "detect"; data: Uint8ClampedArray; width: number; height: number; prior: Prior | null }
  | {
      id: number;
      kind: "hint";
      data: Uint8ClampedArray;
      width: number;
      height: number;
      hint: { xTop: number; yTop: number; xBase: number; yBase: number };
    };

export type WorkerResponse =
  | { id: number; kind: "detect"; result: DetectionResult; ms: number }
  | { id: number; kind: "hint"; result: (Candidate & { snappedTop: boolean; snappedBase: boolean }) | null; ms: number };

const detector = new StickDetector();

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  const t0 = performance.now();
  const input: DetectInput = { data: req.data, width: req.width, height: req.height };
  if (req.kind === "detect") {
    input.prior = req.prior;
    const result = detector.detect(input);
    (self as unknown as Worker).postMessage({ id: req.id, kind: "detect", result, ms: performance.now() - t0 } satisfies WorkerResponse);
  } else {
    const result = detector.measureFromHints(input, req.hint);
    (self as unknown as Worker).postMessage({ id: req.id, kind: "hint", result, ms: performance.now() - t0 } satisfies WorkerResponse);
  }
};
