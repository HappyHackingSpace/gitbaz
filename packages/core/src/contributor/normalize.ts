/**
 * Logarithmic normalization: approaches 1.0 as value grows.
 * halfPoint controls steepness — value at which output ≈ 0.5.
 */
export const normalize = (value: number, halfPoint: number): number => {
	if (!Number.isFinite(value) || value <= 0) return 0;
	if (halfPoint <= 0) return 1;
	return value / (value + halfPoint);
};
