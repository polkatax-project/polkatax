import { logger } from "../../logger/logger";
import * as dateUtils from "../../../common/util/date-utils";
import {
  expect,
  it,
  jest,
  describe,
  beforeAll,
  afterEach,
} from "@jest/globals";
import { PortfolioMovement } from "../model/portfolio-movement";
import { convertFiatValues } from "./convert-fiat-values";
import { formatDate } from "../../../common/util/date-utils";

// Mock logger
jest.mock("../../logger/logger", () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe.only("convertFiatValues", () => {
  const timestamp = Date.now();
  const fixedDate = formatDate(new Date(timestamp));

  beforeAll(() => {
    // Stub formatDate to ensure deterministic ISO date
    jest.spyOn(dateUtils, "formatDate").mockReturnValue(fixedDate);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("converts price and fiatValue using exchange rate", () => {
    const exchangeRates = {
      [fixedDate]: {
        EUR: 0.9,
      },
    };
    console.log(fixedDate);

    const movements: PortfolioMovement[] = [
      {
        timestamp,
        transfers: [{ price: 100, fiatValue: 200 }],
      },
    ] as any;

    const result = convertFiatValues("EUR", movements, exchangeRates);

    expect(result[0].transfers[0].price).toBeCloseTo(90); // 100 * 0.9
    expect(result[0].transfers[0].fiatValue).toBeCloseTo(180); // 200 * 0.9
  });

  it("logs a warning if no exchange rate for date", () => {
    const movements: PortfolioMovement[] = [
      {
        timestamp,
        transfers: [{ price: 100, fiatValue: 200 }],
      },
    ] as any;

    const exchangeRates = {
      ["2020-01-01"]: {
        EUR: 0.9,
      },
    };

    convertFiatValues("EUR", movements, exchangeRates);

    expect(logger.warn).toHaveBeenCalledWith(
      "No fiat exchange rate found for date " + fixedDate,
    );
  });
});
