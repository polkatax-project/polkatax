import { JobResult } from '../../model/job-result';
import { TaxData } from '../../model/tax-data';
import { TaxableEvent } from '../../model/taxable-event';

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
  taxableEvents: TaxableEvent[]
): TaxData {
  const enriched = {
    values: addId(taxableEvents),
    chain: job.blockchain,
    currency: job.currency,
    address: job.wallet,
  };
  sortRewards(enriched);
  return enriched;
}
