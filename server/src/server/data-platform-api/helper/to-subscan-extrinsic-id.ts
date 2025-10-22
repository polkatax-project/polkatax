export const toSubscanExtrinsixIndex = (extrinsicIndex: string) => {
  const parts = extrinsicIndex.split("-");
  return String(Number(parts[0])) + "-" + String(Number(parts[2]));
};

export const toSubscanEventIndex = (eventIndex: string) => {
  const parts = eventIndex.split("-");
  return String(Number(parts[0])) + "-" + String(Number(parts[2]));
};
