export const selectToken = (deviations) => {
  return deviations.reduce((curr, d) => {
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
