import { defineStore } from 'pinia';
import {
  BehaviorSubject,
  combineLatest,
  defer,
  filter,
  firstValueFrom,
  from,
  map,
  of,
  ReplaySubject,
  shareReplay,
  take,
} from 'rxjs';
import { fetchCurrency } from '../service/fetch-currency';
import { wsMsgReceived$, wsSendMsg } from '../service/ws-connection';
import { JobResult } from '../model/job-result';
import { fetchSubscanChains } from '../service/fetch-subscan-chains';
import { addMetaData, sortJobs } from './helper/job.service';
import { addIsoDate } from './helper/add-iso-date';
import { convertToCanonicalAddress } from '../util/convert-to-canonical-address';
import { isValidEvmAddress } from '../util/is-valid-address';
import { getAddress } from 'ethers';
import { FiscalYear } from '../model/fiscal-year';
import { filterOnFiscalYear } from './helper/filter-on-fiscal-year';
import { extractStakingRewards } from './helper/extract-staking-rewards';
import { calculateRewardSummary } from './helper/calculate-reward-summary';
import { groupRewardsByDay } from './helper/group-rewards-by-day';

const jobs$: BehaviorSubject<JobResult[]> = new BehaviorSubject<JobResult[]>(
  (JSON.parse(localStorage.getItem('wallets') || '[]') as string[]).map(
    (wallet: string) => ({
      wallet,
      blockchain: 'dummy',
      currency: '',
      status: 'pending',
      lastModified: new Date().getTime(),
    })
  )
);
const subscanChains$ = from(fetchSubscanChains()).pipe(shareReplay(1));
const walletsAddresses$ = new BehaviorSubject(
  JSON.parse(localStorage.getItem('wallets') || '[]')
);

wsMsgReceived$
  .pipe(
    filter((msg) => msg.type === 'data'),
    map((msg) => msg.payload)
  )
  .subscribe(async (payload: JobResult | JobResult[]) => {
    let jobs = await firstValueFrom(jobs$);
    const fiscalYear = await firstValueFrom(fiscalYear$);
    const list: JobResult[] = Array.isArray(payload) ? payload : [payload];
    for (const newJobResult of list) {
      if (newJobResult.data) {
        newJobResult.data.values = addIsoDate(newJobResult.data.values);
        filterOnFiscalYear(newJobResult.data, fiscalYear);
        newJobResult.data = addMetaData(
          newJobResult,
          newJobResult.data.values,
          fiscalYear
        );
        newJobResult.stakingRewards = extractStakingRewards(newJobResult.data);
        newJobResult.stakingRewardsSummary = calculateRewardSummary(
          newJobResult.stakingRewards.values
        );
        newJobResult.dailyStakingRewards = groupRewardsByDay(
          newJobResult.stakingRewards.values
        );
      }
      jobs = jobs.filter(
        (j) =>
          (j.blockchain !== newJobResult.blockchain &&
            j.blockchain !== 'dummy') ||
          j.wallet !== newJobResult.wallet
      );
      jobs.push(newJobResult);
    }
    sortJobs(jobs);
    jobs$.next(jobs);
  });

const currency$ = new ReplaySubject<string>(1);
defer(() => {
  const currency = localStorage.getItem('currency');
  if (currency) {
    return of(currency);
  } else {
    return fetchCurrency();
  }
})
  .pipe(take(1))
  .subscribe((currency) => currency$.next(currency));

const fiscalYear$ = new ReplaySubject<FiscalYear>(1);
currency$
  .pipe(
    take(1),
    map((currency) => {
      const fiscalYear = localStorage.getItem('fiscalYear');
      if (fiscalYear) {
        return fiscalYear as FiscalYear;
      } else {
        switch (currency) {
          case 'USD':
            return 'Oct 1 - Sep 30' as const;
          case 'CAD':
          case 'GBP':
          case 'INR':
          case 'JPY':
          case 'SGD':
          case 'CNY':
            return 'Apr 1 - Mar 31' as const;
          case 'AUD':
          case 'NZD':
            return 'Jul 1 - Jun 30' as const;
          case 'ZAR':
            return 'Mar 1 - Feb 28/29' as const;
          default:
            return 'Jan 1 - Dec 31' as const;
        }
      }
    })
  )
  .subscribe((fiscalYear) => fiscalYear$.next(fiscalYear));

combineLatest([
  firstValueFrom(currency$),
  from([JSON.parse(localStorage.getItem('wallets') || '[]') as string[]]),
])
  .pipe(take(1))
  .subscribe(async ([currency, wallets]) => {
    wallets.forEach((w) => {
      wsSendMsg({
        type: 'fetchDataRequest',
        payload: {
          currency: currency,
          wallet: w,
        },
      });
    });
  });

const webSocketResponseError$ = wsMsgReceived$.pipe(
  filter((msg) => !!msg.error),
  map((msg) => msg.error!)
);

export const useSharedStore = defineStore('shared', {
  state: () => {
    return {
      currency$: currency$.asObservable(),
      fiscalYear$: fiscalYear$.asObservable(),
      webSocketResponseError$,
      subscanChains$,
      jobs$: jobs$.asObservable(),
      address: '',
      walletsAddresses$: walletsAddresses$.asObservable(),
    };
  },
  actions: {
    selectCurrency(newCurrency: string) {
      localStorage.setItem('currency', newCurrency);
      currency$.next(newCurrency);
    },
    selectFiscalYear(fiscalYear: FiscalYear) {
      localStorage.setItem('fiscalYear', fiscalYear);
      fiscalYear$.next(fiscalYear);
    },
    addWallets(wallets: string[]) {
      const existingWallets = JSON.parse(
        localStorage.getItem('wallets') || '[]'
      );
      for (const wallet of wallets) {
        if (existingWallets.indexOf(wallet) === -1) {
          existingWallets.push(wallet);
          localStorage.setItem('wallets', JSON.stringify(existingWallets));
        }
      }
      walletsAddresses$.next(existingWallets);
    },
    async syncWallets(addresses: string[]) {
      const canonicaAddresses = [];
      const currency = (await firstValueFrom(
        useSharedStore().currency$.pipe(filter((c) => c !== undefined))
      )) as string;
      for (const address of addresses) {
        const canonicaAddress = isValidEvmAddress(address)
          ? getAddress(address)
          : convertToCanonicalAddress(address);
        canonicaAddresses.push(canonicaAddress);
        wsSendMsg({
          type: 'fetchDataRequest',
          payload: {
            wallet: canonicaAddress,
            currency: currency,
          },
        });
      }
      this.addWallets(canonicaAddresses);
      const jobs = await firstValueFrom(jobs$);
      const walletsWithoutJobs = canonicaAddresses.filter(
        (a) => !jobs.find((j) => j.wallet === a)
      );
      const dummyJobs = walletsWithoutJobs.map((wallet) => {
        return {
          wallet,
          blockchain: 'dummy',
          currency,
          status: 'pending',
          lastModified: new Date().getTime(),
        };
      });
      jobs.push(...dummyJobs);
      jobs$.next(jobs);
    },
    async sync() {
      this.syncWallets([this.address.trim()]);
    },
    async removeWallet(job: JobResult) {
      const wallets: string[] = JSON.parse(
        localStorage.getItem('wallets') || '[]'
      );
      const newWallets = wallets.filter((w) => w !== job.wallet);
      localStorage.setItem('wallets', JSON.stringify(newWallets));
      walletsAddresses$.next(wallets);
      const reqId = wsSendMsg({
        type: 'unsubscribeRequest',
        payload: {
          wallet: job.wallet,
          currency: job.currency,
        },
      });
      await firstValueFrom(
        wsMsgReceived$.pipe(
          filter(
            (m) => m.type === 'acknowledgeUnsubscribe' && m.reqId === reqId
          )
        )
      );
      const jobs = (await firstValueFrom<JobResult[]>(this.jobs$)).filter(
        (j) => j.wallet !== job.wallet || job.currency !== j.currency
      );
      jobs$.next([...jobs]);
    },
  },
});
