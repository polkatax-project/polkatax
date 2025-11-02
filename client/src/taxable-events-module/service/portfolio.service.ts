import { Deviation } from '../../shared-module/model/deviation';
import { TaxData } from '../../shared-module/model/tax-data';
import { TaxableEvent } from '../../shared-module/model/taxable-event';

export interface Portfolio {
  balances: PortfolioEntry[];
  rangeStartDate: string;
  rangeEndDate: string;
  currency: string;
  chain: string;
  customRange: boolean;
}

export type PortfolioEntry = Deviation & {
  rangeStart: number;
  rangeEnd: number;
};

export function calculatePortfolio(
  taxData: TaxData,
  rangeStartDate: string,
  rangeEndDate: string
): Portfolio {
  const clone: (Deviation & { rangeStart: number; rangeEnd: number })[] =
    JSON.parse(JSON.stringify(taxData.deviations));
  for (const deviation of clone) {
    const rangeStart = calculateBalanceAndFees(
      taxData.fromDate,
      taxData.toDate,
      deviation,
      taxData.values,
      rangeStartDate
    );
    const rangeEnd = calculateBalanceAndFees(
      taxData.fromDate,
      taxData.toDate,
      deviation,
      taxData.values,
      rangeEndDate
    );
    deviation.rangeStart = rangeStart.balance;
    deviation.rangeEnd = rangeEnd.balance;
    deviation.fees = rangeEnd.fees - rangeStart.fees;
    deviation.feesFiat = rangeEnd.feesFiat - rangeStart.feesFiat;
  }
  return {
    balances: clone,
    rangeStartDate,
    rangeEndDate,
    currency: taxData.currency,
    chain: taxData.chain,
    customRange:
      rangeEndDate !== taxData.toDate || rangeStartDate !== taxData.fromDate,
  };
}

function calculateBalanceAndFees(
  startDate: string,
  endDate: string,
  deviation: Deviation,
  values: TaxableEvent[],
  targetDate: string
) {
  if (startDate === targetDate) {
    return { balance: deviation.balanceBefore, fees: 0, feesFiat: 0 };
  }
  if (endDate === targetDate) {
    return {
      balance: deviation.balanceAfter,
      fees: deviation.fees,
      feesFiat: deviation.feesFiat,
    };
  }
  const uniqueId = deviation.unique_id;
  const relevantEvents = values.filter((v) => v.isoDate! <= targetDate);
  const fees = relevantEvents
    .filter((p) => p.feeTokenUniqueId === uniqueId)
    .reduce((curr, p) => curr + (p?.feeUsed ?? 0) + (p?.tip ?? 0), 0);
  const xcmFees = relevantEvents
    .filter((p) => p.xcmFeeTokenUniqueId === uniqueId)
    .reduce((curr, p) => curr + (p?.xcmFee ?? 0), 0);

  const feesFiat = relevantEvents
    .filter((p) => p.feeTokenUniqueId === uniqueId)
    .reduce((curr: number, p: TaxableEvent) => curr + (p?.feeUsedFiat ?? 0), 0);

  const xcmFeesFiat = relevantEvents
    .filter((p) => p.xcmFeeTokenUniqueId === uniqueId)
    .reduce((curr, p) => curr + (p?.xcmFeeFiat ?? 0), 0);

  let balance = deviation.balanceBefore - xcmFees - fees;

  relevantEvents.forEach((p) => {
    p.transfers.forEach((t) => {
      if (t.asset_unique_id === uniqueId) {
        balance += t?.amount ?? 0;
      }
    });
  });
  return { balance, fees, feesFiat: feesFiat + xcmFeesFiat };
}
