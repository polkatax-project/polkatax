export const getEndOfLastYear = () => {
  return new Date(
    new Date().getFullYear() - 1 + '-12-31T23:59:59.999'
  ).getTime();
};
