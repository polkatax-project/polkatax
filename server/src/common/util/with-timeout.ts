export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timeout after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export async function withTimeout(promise, ms = 10_000) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}
