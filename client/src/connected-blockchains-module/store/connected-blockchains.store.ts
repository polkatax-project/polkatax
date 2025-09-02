import { defineStore } from 'pinia';
import { combineLatest, map, ReplaySubject, Observable } from 'rxjs';
import { useSharedStore } from '../../shared-module/store/shared.store';
import { JobResult } from '../../shared-module/model/job-result';
import { wsSendMsg } from '../../shared-module/service/ws-connection';

export const useConnectedBlockchainsStore = defineStore(
  'connected-blockchains',
  () => {
    // Subjects for reactive wallet and currency
    const wallet$ = new ReplaySubject<string>(1);
    const currency$ = new ReplaySubject<string>(1);

    // Reference to jobs observable from shared store
    const sharedStore = useSharedStore();

    // Observable of jobs filtered by wallet and currency
    const jobsMatchingWallet$ = combineLatest([
      sharedStore.jobs$,
      wallet$,
      currency$,
    ]).pipe(
      map(([jobs, wallet, currency]) =>
        jobs.filter((job) => job.wallet === wallet && job.currency === currency)
      )
    );

    // Observable of jobs filtered and sorted
    const syncedChains$: Observable<JobResult[]> = jobsMatchingWallet$.pipe(
      map((jobs) =>
        jobs
          .filter((j) => j.error || (j.data?.values.length ?? 0) > 0)
          .sort((a, b) => (a.blockchain > b.blockchain ? 1 : -1))
      )
    );

    // Observable indicating if any job is synchronizing
    const isSynchronizing$ = jobsMatchingWallet$.pipe(
      map((jobs) =>
        jobs.some((j) => j.status === 'pending' || j.status === 'in_progress')
      )
    );

    // Actions
    function setWallet(wallet: string) {
      wallet$.next(wallet);
    }

    function setCurrency(currency: string) {
      currency$.next(currency);
    }

    function retry(job: JobResult) {
      wsSendMsg({
        type: 'fetchDataRequest',
        payload: {
          wallet: job.wallet,
          blockchains: [job.blockchain],
          currency: job.currency,
          syncFromDate: job.syncFromDate,
          syncUntilDate: job.syncUntilDate,
        },
      });
    }

    return {
      syncedChains$,
      isSynchronizing$,
      setWallet,
      setCurrency,
      retry,
    };
  }
);
