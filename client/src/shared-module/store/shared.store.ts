import { defineStore } from 'pinia';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  firstValueFrom,
  from,
  map,
  ReplaySubject,
  shareReplay,
  take,
} from 'rxjs';
import { fetchCurrency } from '../service/fetch-currency';
import { wsMsgReceived$, wsSendMsg } from '../service/ws-connection';
import { JobResult } from '../model/job-result';
import { fetchSubscanChains } from '../service/fetch-subscan-chains';
import { mapRawValuesToRewards, sortJobs } from './helper/job.service';
import { filterOnLastYear } from './helper/filter-on-last-year';
import { addIsoDate } from './helper/add-iso-date';
import { convertToCanonicalAddress } from '../util/convert-to-canonical-address';
import { isValidEvmAddress } from '../util/is-valid-address';

const jobs$ = new BehaviorSubject<JobResult[]>([]);
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
        newJobResult.data = mapRawValuesToRewards(
          newJobResult,
          newJobResult.data.token,
          newJobResult.data.values
        );
      }
      jobs = jobs.filter(
        (j) =>
          j.blockchain !== newJobResult.blockchain ||
          j.wallet !== newJobResult.wallet
      );
      jobs.push(newJobResult);
    }
    sortJobs(jobs);
    jobs$.next(jobs);
  });

combineLatest([
  from(fetchCurrency()),
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

const currency$ = new ReplaySubject<string>(1);
from(fetchCurrency())
  .pipe(take(1))
  .subscribe((currency) => currency$.next(currency));

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
      currency$.next(newCurrency);
    },
    addWallet(wallet: string) {
      const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
      if (wallets.indexOf(wallet) === -1) {
        wallets.push(wallet);
        localStorage.setItem('wallets', JSON.stringify(wallets));
        walletsAddresses$.next(wallets);
      }
    },
    async sync() {
      const genericAddress = isValidEvmAddress(this.address.trim())
        ? this.address.trim()
        : convertToCanonicalAddress(this.address.trim());
      wsSendMsg({
        type: 'fetchDataRequest',
        payload: {
          wallet: genericAddress,
          currency: await firstValueFrom(
            useSharedStore().currency$.pipe(filter((c) => c !== undefined))
          ),
        },
      });
      this.addWallet(genericAddress);
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
      const jobs = (await firstValueFrom(this.jobs$)).filter(
        (j) => j.wallet !== job.wallet || job.currency !== j.currency
      );
      jobs$.next([...jobs]);
    },
  },
});
