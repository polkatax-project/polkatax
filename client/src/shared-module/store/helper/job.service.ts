import { FiscalYear, fiscalYearToBorders } from '../../model/fiscal-year';
import { JobResult } from '../../model/job-result';
import { TaxData } from '../../model/tax-data';
import { TaxableEvent } from '../../model/taxable-event';
import { formatDate } from '../../util/date-utils';

export function sortJobs(jobs: JobResult[]) {
  return jobs.sort((a, b) => a.wallet.localeCompare(b.wallet));
}

export function sortRewards(data: TaxData) {
  data.values.sort((a, b) => a.timestamp - b.timestamp);
}

export function addId(events: TaxableEvent[]) {
  let id = 0;
  events.forEach((t) => {
    t.id = id;
    id++;
  });
  return events;
}

export function addMetaData(
  job: JobResult,
  taxableEvents: TaxableEvent[],
  fiscalYear: FiscalYear
): TaxData {
  const syncedUntilAsDate = formatDate(new Date(job.syncedUntil!).getTime());
  const fiscalYearBorders = fiscalYearToBorders(fiscalYear);
  const enriched = {
    values: addId(taxableEvents),
    deviations: job.data?.deviations ?? [],
    chain: job.blockchain,
    currency: job.currency,
    address: job.wallet,
    fromDate: fiscalYearToBorders(fiscalYear).start,
    toDate:
      syncedUntilAsDate > fiscalYearBorders.end
        ? fiscalYearBorders.end
        : syncedUntilAsDate,
    fiscalYearIncomplete: syncedUntilAsDate <= fiscalYearBorders.end,
  };
  sortRewards(enriched);
  return enriched;
}
