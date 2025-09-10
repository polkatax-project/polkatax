import { TaxableEvent } from '../../shared-module/model/taxable-event';

export const isTaxableEventVisible = (
  tokenFilter: { name: string; value: boolean }[],
  taxableEvent: TaxableEvent
) => {
  if (tokenFilter.every((t) => !t.value)) {
    return true;
  }
  return taxableEvent.transfers.some(
    (t) => tokenFilter.find((v) => v.name === t.symbol.toUpperCase())?.value
  );
};
