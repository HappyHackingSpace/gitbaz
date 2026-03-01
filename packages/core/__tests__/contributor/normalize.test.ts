import { describe, expect, it } from "vitest";
import { normalize } from "../../src/contributor/normalize.js";

describe("normalize", () => {
	it("returns 0 for zero value", () => {
		expect(normalize(0, 50)).toBe(0);
	});

	it("returns 0 for negative value", () => {
		expect(normalize(-5, 50)).toBe(0);
	});

	it("returns 1 for zero half-point", () => {
		expect(normalize(10, 0)).toBe(1);
	});

	it("returns 0.5 when value equals half-point", () => {
		expect(normalize(50, 50)).toBe(0.5);
	});

	it("approaches 1 for very large values", () => {
		const result = normalize(10000, 50);
		expect(result).toBeGreaterThan(0.99);
		expect(result).toBeLessThanOrEqual(1);
	});

	it("returns value below 0.5 when value is below half-point", () => {
		expect(normalize(10, 50)).toBeLessThan(0.5);
	});

	it("returns value above 0.5 when value is above half-point", () => {
		expect(normalize(100, 50)).toBeGreaterThan(0.5);
	});

	it("produces consistent results for known inputs", () => {
		// 5 / (5 + 5) = 0.5
		expect(normalize(5, 5)).toBe(0.5);
		// 200 / (200 + 200) = 0.5
		expect(normalize(200, 200)).toBe(0.5);
	});
});
