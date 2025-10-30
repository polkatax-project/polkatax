import Bottleneck from "bottleneck";
import { logger } from "../../../logger/logger";

const keys = (process.env["SUBSCAN_API_KEY"] ?? "").split(",");
const limiters = keys.map((key) => ({
  bottleneck: new Bottleneck({
    minTime: 200, // at least 200ms between requests = 5/sec
    reservoir: 5, // start with 5 tokens
    reservoirRefreshAmount: 5,
    reservoirRefreshInterval: 1000, // refill every second
  }),
  key,
}));

let counter = 0;
export function getAvailableLimiter() {
  counter = (counter + 1) % limiters.length;
  return limiters[counter];
}

export function throttledApiCall<T>(task: (apiKey) => Promise<T>) {
  const limiter = getAvailableLimiter();
  return limiter.bottleneck.schedule(() => task(limiter.key));
}
