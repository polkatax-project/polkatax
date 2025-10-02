export const getBeginningLastYear = (): number => {
  return new Date(
    Date.UTC(
      new Date().getUTCFullYear() - 2,
      11, // month index (0-based, so 11 = December)
      31,
      23,
      23,
      59,
      999,
    ),
  ).getTime();
};

export const getEndOfLastYear = (): number => {
  return new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      0, // month index (0-based, so 11 = December)
      1,
      23,
      59,
      59,
      999,
    ),
  ).getTime();
};
