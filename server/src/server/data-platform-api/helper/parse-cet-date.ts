import { DateTime } from "luxon";

export const parseCETDate = (date: string): number => {
  return DateTime.fromISO(date, { zone: "Europe/Berlin" }).toMillis();
};
