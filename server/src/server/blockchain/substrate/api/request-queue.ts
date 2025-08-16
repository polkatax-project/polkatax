import Bottleneck from "bottleneck";

export function throttledApiCall<T>(task: () => Promise<T>) {
  return limiter.schedule(task);
}

export const limiter = new Bottleneck({
  minTime: 200, // at least 200ms between requests = 5/sec
  reservoir: 5, // start with 5 tokens
  reservoirRefreshAmount: 5,
  reservoirRefreshInterval: 1000, // refill every second
});
