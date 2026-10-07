import { describe, expect, it } from "vitest";
import { attitudeFromEuler, elevationFromGravity, gravityFromEuler, rollFromGravity, rotationSpeedDps } from "../engine/attitude";

const deg = (r: number) => (r * 180) / Math.PI;

describe("attitude from device orientation", () => {
  it("upright portrait: gravity down the screen, no roll, level", () => {
    const g = gravityFromEuler(90, 0);
    expect(g[0]).toBeCloseTo(0, 9);
    expect(g[1]).toBeCloseTo(-1, 9);
    expect(g[2]).toBeCloseTo(0, 9);
    const a = attitudeFromEuler(90, 0);
    expect(deg(a.rollRad)).toBeCloseTo(0, 6);
    expect(deg(a.elevationRad)).toBeCloseTo(0, 6);
  });

  it("looking up reads as positive elevation, looking down as negative", () => {
    expect(deg(attitudeFromEuler(120, 0).elevationRad)).toBeCloseTo(30, 6);
    expect(deg(attitudeFromEuler(70, 0).elevationRad)).toBeCloseTo(-20, 6);
  });

  it("roll: gravity rotated in the screen plane reads as that angle, signed", () => {
    const t = (10 * Math.PI) / 180;
    expect(deg(rollFromGravity([-Math.sin(t), -Math.cos(t), 0]))).toBeCloseTo(10, 6);
    expect(deg(rollFromGravity([Math.sin(t), -Math.cos(t), 0]))).toBeCloseTo(-10, 6);
  });

  it("an upright landscape phone also reads as zero roll", () => {
    // Screen rotated 90 deg: the device +x axis points up, so gravity is along -x.
    expect(deg(rollFromGravity([-1, 0, 0], 90))).toBeCloseTo(0, 6);
    expect(deg(rollFromGravity([1, 0, 0], 270))).toBeCloseTo(0, 6);
  });

  it("clamps elevation input rounding noise instead of returning NaN", () => {
    expect(elevationFromGravity([0, 0, 1.0000001])).toBeCloseTo(Math.PI / 2, 6);
  });

  it("rotation speed is the vector magnitude, and null when a sensor is missing", () => {
    expect(rotationSpeedDps(3, 4, 0)).toBe(5);
    expect(rotationSpeedDps(null, 4, 0)).toBeNull();
  });
});
