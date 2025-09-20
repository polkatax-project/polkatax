import { Parser } from '@json2csv/plainjs';
import { formatDateUTC } from '../util/date-utils';
import saveAs from 'file-saver';
import { TaxData } from '../model/tax-data';
import { TaxableEvent, TaxableEventTransfer } from '../model/taxable-event';
import { mapLabelToKoinlyTag } from './map-label-to-koinly-tag';
import { koilyTokenMapping } from '../const/koinly-token-mapping';

const extractCurrency = (t: TaxableEventTransfer | undefined) => {
  return t
    ? koilyTokenMapping[t.symbol.toUpperCase()]
      ? `ID:${koilyTokenMapping[t.symbol.toUpperCase()]}`
      : `${t.symbol.toUpperCase()}`
    : '';
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
    const koinlyTag = mapLabelToKoinlyTag(t.label);
    const combineTransfers = t.label === 'Swap';

    if (combineTransfers) {
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
          'Sent Currency': extractCurrency(sent),
          'Received Amount': received ? Math.abs(received.amount) : '',
          'Received Currency': extractCurrency(received),
          'Net Worth Amount': getNetWorth([received, sent]) || '',
          'Net Worth Currency': taxdata.currency,
          Label: koinlyTag,
          Description: t.label,
          TxHash: t.extrinsic_index ?? t.block,
        });
      }
    } else {
      t.transfers.forEach((transfer) => {
        const received = transfer.amount > 0;
        values.push({
          Date: formatDateUTC(t.timestamp),
          'Sent Amount': received ? '' : Math.abs(transfer.amount),
          'Sent Currency': received ? '' : extractCurrency(transfer),
          'Received Amount': received ? Math.abs(transfer.amount) : '',
          'Received Currency': received ? extractCurrency(transfer) : '',
          'Net Worth Amount': getNetWorth([transfer]) || '',
          'Net Worth Currency': taxdata.currency,
          Label: koinlyTag,
          Description: t.label,
          TxHash: t.extrinsic_index ?? t.block,
        });
      });
    }
  });
  const csv = parser.parse(values);
  saveAs(
    new Blob([csv], { type: 'text/plain;charset=utf-8' }),
    `tax-data-koinly-${taxdata.chain}-${taxdata.address.substring(0, 5)}.csv`
  );
};
