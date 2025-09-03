import { JobResult } from '../../model/job-result';
import { TaxData } from '../../model/tax-data';
import { TaxableEvent } from '../../model/taxable-event';
import { formatDate } from '../../util/date-utils';

export function sortJobs(jobs: JobResult[]) {
  return jobs.sort((a, b) => a.wallet.localeCompare(b.wallet));
}

export function sortRewards(data: TaxData) {
  data.values.sort((a, b) => -a.timestamp + b.timestamp);
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
  taxableEvents: TaxableEvent[]
): TaxData {
  const syncedUntilDay = formatDate(new Date(job.syncUntilDate).getTime());
  const syncedFromDay = formatDate(new Date(job.syncFromDate).getTime());
  const enriched = {
    values: addId(taxableEvents),
    deviations: job.data?.deviations ?? [],
    portfolioSupported: job.data?.deviations !== undefined,
    chain: job.blockchain,
    currency: job.currency,
    address: job.wallet,
    fromDate: syncedFromDay,
    toDate: syncedUntilDay,
  };
  sortRewards(enriched);
  return enriched;
}
