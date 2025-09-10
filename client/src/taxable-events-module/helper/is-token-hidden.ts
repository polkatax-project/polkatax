import { TaxableEvent } from '../../shared-module/model/taxable-event';

export const isTokenHidden = (
  hiddenTokens: { name: string; value: boolean }[],
  token: string
) => hiddenTokens.find((v) => v.name === token.toUpperCase())?.value;

export const allTokensHidden = (
  hiddenTokens: { name: string; value: boolean }[],
  taxableEvent: TaxableEvent
) => {
  return taxableEvent.transfers.every((t) =>
    isTokenHidden(hiddenTokens, t.symbol)
  );
};
