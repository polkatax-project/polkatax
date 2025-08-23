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
import { filterOnLastYear } from './helper/filter-on-last-year';
import { addIsoDate } from './helper/add-iso-date';
import { convertToCanonicalAddress } from '../util/convert-to-canonical-address';
import { isValidEvmAddress } from '../util/is-valid-address';
import { getAddress } from 'ethers';

const jobs$: BehaviorSubject<JobResult[]> = new BehaviorSubject<JobResult[]>((JSON.parse(localStorage.getItem('wallets') || '[]') as string[]).map((wallet: string) => ({
  wallet,
  blockchain: 'dummy',
  currency: '',
  status: 'pending',
  lastModified: new Date().getTime()
})));
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
    const list: JobResult[] = Array.isArray(payload) ? payload : [payload];
    for (const newJobResult of list) {
      if (newJobResult.data) {
        newJobResult.data.values = addIsoDate(newJobResult.data.values);
        filterOnLastYear(newJobResult.data);
        newJobResult.data = addMetaData(newJobResult, newJobResult.data.values);
      }
      jobs = jobs.filter(
        (j) =>
          (j.blockchain !== newJobResult.blockchain || j.blockchain !== 'dummy') ||
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
    addWallets(wallets: string[]) {
      for (const wallet of wallets) {
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        if (wallets.indexOf(wallet) === -1) {
          wallets.push(wallet);
          localStorage.setItem('wallets', JSON.stringify(wallets));
        }
      }
      walletsAddresses$.next(wallets);
    },
    async syncWallets(addresses: string[]) {
      const genericAddresses = []
      const currency = await firstValueFrom(
        useSharedStore().currency$.pipe(filter((c) => c !== undefined))
      ) as string
      for (const address of addresses) {
        const genericAddress = isValidEvmAddress(address)
        ? getAddress(address)
        : convertToCanonicalAddress(address);
        genericAddresses.push(genericAddress)
        wsSendMsg({
          type: 'fetchDataRequest',
          payload: {
            wallet: genericAddress,
            currency: currency
          },
        });
      }
      this.addWallets(genericAddresses);
      const jobs = await firstValueFrom(jobs$)
      const walletsWithoutJobs = addresses.filter(a => !jobs.find(j => j.wallet === a))
      const dummyJobs = walletsWithoutJobs.map(wallet => {
        return {
          wallet,
          blockchain: 'dummy',
          currency,
          status: 'pending',
          lastModified: new Date().getTime()
        }
      })
      jobs.push(...dummyJobs)
      jobs$.next(jobs)
    },
    async sync() {
      this.syncWallets([this.address.trim()])
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
