import { Deviation } from "../model/deviation";

export const selectToken = (
  deviations: Deviation[],
  excludedTokens: string[] = [],
): Deviation => {
  const relevantTokens = deviations.filter(
    (d) => d.absoluteDeviationTooLarge && !excludedTokens.includes(d.unique_id),
  );
  return relevantTokens[Math.floor(Math.random() * relevantTokens.length)];
};
