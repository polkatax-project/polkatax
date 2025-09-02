import { Parser } from '@json2csv/plainjs';
import { formatDateUTC } from '../util/date-utils';
import saveAs from 'file-saver';
import { TaxData } from '../model/tax-data';
import { TaxableEvent, TaxableEventTransfer } from '../model/taxable-event';

const extractCurrency = (
  t: TaxableEventTransfer | undefined,
  chain: string
) => {
  return t ? `${t.symbol.toUpperCase()}:${t.asset_unique_id}:${chain}` : '';
};

const getNetWorth = (t: (TaxableEventTransfer | undefined)[]) => {
  return t
    .filter((t) => !!t)
    .map((t) => t.fiatValue)
    .filter((fiat) => fiat !== undefined && fiat !== null && !isNaN(fiat))
    .map((fiat) => Math.abs(fiat!))?.[0];
};

export const exportKoinlyCsv = (taxdata: TaxData) => {
  const parser = new Parser();
  const values: any = [];
  (taxdata.values ?? []).forEach((t: TaxableEvent) => {
    const allSent = t.transfers.filter((t) => t.amount < 0);
    const allReceived = t.transfers.filter((t) => t.amount > 0);
    for (
      let idx = 0;
      idx < Math.max(allSent.length, allReceived.length);
      idx++
    ) {
      const sent = allSent?.[idx];
      const received = allReceived?.[idx];
      values.push({
        Date: formatDateUTC(t.timestamp),
        'Sent Amount': sent ? Math.abs(sent.amount) : '',
        'Sent Currency': extractCurrency(sent, taxdata.chain),
        'Received Amount': received?.amount ?? '',
        'Received Currency': extractCurrency(received, taxdata.chain),
        'Net Worth Amount': getNetWorth([received, sent]) || '',
        'Net Worth Currency': taxdata.currency,
        Label: '',
        Description: t.label,
        TxHash: t.extrinsic_index,
      });
    }
  });
  const csv = parser.parse(values);
  saveAs(
    new Blob([csv], { type: 'text/plain;charset=utf-8' }),
    `tax-data-koinly-${taxdata.chain}-${taxdata.address.substring(0, 5)}.csv`
  );
};
