export const toSubscanExtrinsixIndex = (extrinsicIndex: string) => {
  const parts = extrinsicIndex.split("-");
  return String(Number(parts[0])) + "-" + String(Number(parts[2]));
};
