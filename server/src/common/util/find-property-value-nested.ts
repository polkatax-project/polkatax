export function getNestedValue<R = any>(obj: any, path: string): R | undefined {
  return path
    .split(".")
    .reduce(
      (acc: any, key: string) =>
        acc !== undefined && acc !== null ? acc[key] : undefined,
      obj,
    );
}
