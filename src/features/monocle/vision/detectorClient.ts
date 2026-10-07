import { Candidate, DetectionResult, Prior, StickDetector } from "./detector";
import type { WorkerRequest, WorkerResponse } from "./detector.worker";

export type HintResult = (Candidate & { snappedTop: boolean; snappedBase: boolean }) | null;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

interface Pending {
  resolve: (v: { result: unknown; ms: number }) => void;
  reject: (e: unknown) => void;
}

/**
 * Runs the detector in a Web Worker so the camera preview and UI never wait on
 * it, and falls back to the main thread if workers are unavailable or fail.
 */
export class DetectorClient {
  private worker: Worker | null = null;
  private local: StickDetector | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  busy = false;
  usingWorker = false;

  constructor() {
    try {
      if (typeof Worker === "undefined") throw new Error("no worker");
      this.worker = new Worker(new URL("./detector.worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        p.resolve({ result: e.data.result, ms: e.data.ms });
      };
      this.worker.onerror = () => this.fallBack();
      this.usingWorker = true;
    } catch {
      this.fallBack();
    }
  }

  private fallBack() {
    this.worker?.terminate();
    this.worker = null;
    this.usingWorker = false;
    this.local ??= new StickDetector();
    for (const [, p] of this.pending) p.reject(new Error("detector worker failed"));
    this.pending.clear();
  }

  private call(req: DistributiveOmit<WorkerRequest, "id">): Promise<{ result: unknown; ms: number }> {
    const id = this.nextId++;
    if (this.worker) {
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        this.worker!.postMessage({ ...req, id });
      });
    }
    this.local ??= new StickDetector();
    const t0 = performance.now();
    const input = { data: req.data, width: req.width, height: req.height };
    const result =
      req.kind === "detect"
        ? this.local.detect({ ...input, prior: req.prior })
        : this.local.measureFromHints(input, req.hint);
    return Promise.resolve({ result, ms: performance.now() - t0 });
  }

  async detect(frame: ImageData, prior: Prior | null): Promise<{ result: DetectionResult; ms: number }> {
    this.busy = true;
    try {
      const r = await this.call({ kind: "detect", data: frame.data, width: frame.width, height: frame.height, prior });
      return r as { result: DetectionResult; ms: number };
    } catch {
      // Worker died mid-flight: retry once on the main thread.
      const r = await this.call({ kind: "detect", data: frame.data, width: frame.width, height: frame.height, prior });
      return r as { result: DetectionResult; ms: number };
    } finally {
      this.busy = false;
    }
  }

  async measureFromHints(
    frame: ImageData,
    hint: { xTop: number; yTop: number; xBase: number; yBase: number },
  ): Promise<{ result: HintResult; ms: number }> {
    const r = await this.call({ kind: "hint", data: frame.data, width: frame.width, height: frame.height, hint });
    return r as { result: HintResult; ms: number };
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
