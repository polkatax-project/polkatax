export function stripNullBytes(value: any) {
  if (value === undefined) {
    return value;
  }
  if (typeof value === "string") return value.replace(/\u0000/g, "");
  if (Array.isArray(value)) return value.map(stripNullBytes);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, stripNullBytes(v)]),
    );
  }
  return value;
}
