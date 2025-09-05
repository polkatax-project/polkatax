import { Deviation } from "../portfolio-change-validation.service";

export const selectToken = (
  deviations: Deviation[],
  excludedTokens: string[] = [],
): Deviation => {
  return deviations.reduce((curr, d) => {
    if (excludedTokens.includes(d.unique_id)) {
      return curr;
    }
    if (!d.absoluteDeviationTooLarge) {
      return curr;
    }
    if (!curr) {
      return d;
    }
    return d.deviation / (d.maxAllowedDeviation ?? 100) >
      curr.deviation / (curr.maxAllowedDeviation ?? 100)
      ? d
      : curr;
  }, undefined);
};
