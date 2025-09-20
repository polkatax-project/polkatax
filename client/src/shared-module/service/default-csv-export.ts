import { Parser } from '@json2csv/plainjs';
import { formatDateUTC } from '../util/date-utils';
import saveAs from 'file-saver';
import { TaxData } from '../model/tax-data';
import { TaxableEvent, TaxableEventTransfer } from '../model/taxable-event';

const extractCurrency = (t: TaxableEventTransfer | undefined) => {
  return t ? `${t.symbol.toUpperCase()}` : '';
};

const getNetWorth = (t: (TaxableEventTransfer | undefined)[]) => {
  return t
    .filter((t) => !!t)
    .map((t) => t.fiatValue)
    .filter((fiat) => fiat !== undefined && fiat !== null && !isNaN(fiat))
    .map((fiat) => Math.abs(fiat!))?.[0];
};

export const generateDefaultCsv = (taxdata: TaxData) => {
  if (!taxdata || taxdata.values.length === 0) {
    return '';
  }
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
        'Sent Currency': extractCurrency(sent),
        'Received Amount': received ? Math.abs(received.amount) : '',
        'Received Currency': extractCurrency(received),
        'Net Worth Amount': getNetWorth([received, sent]) || '',
        'Net Worth Currency': taxdata.currency,
        Fee: t.feeUsed,
        'Fee token': t.feeTokenSymbol,
        'XCM fee': t.xcmFee,
        'XCM fee token': t.xcmFeeTokenSymbol,
        'To/From': [sent?.from, received?.from, sent?.to, received?.to]
          .filter((t) => !!t && t !== taxdata.address)
          .join('\n'),
        Label: t.label,
        'TxHash/Block': t.extrinsic_index ?? t.block,
      });
    }
  });
  return parser.parse(values);
};

export const exportDefaultCsv = (taxdata: TaxData) => {
  const csv = generateDefaultCsv(taxdata);
  saveAs(
    new Blob([csv], { type: 'text/plain;charset=utf-8' }),
    `tax-data-${taxdata.chain}-${taxdata.address.substring(0, 5)}.csv`
  );
};
