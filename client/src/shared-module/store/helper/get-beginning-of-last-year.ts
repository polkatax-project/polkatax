export const getBeginningOfLastYear = () => {
  return new Date(
    new Date().getFullYear() - 1 + '-01-01T00:00:00.000'
  ).getTime();
};
