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
import { extractStakingRewards } from './helper/extract-staking-rewards';
import { calculateRewardSummary } from './helper/calculate-reward-summary';
import { groupRewardsByDay } from './helper/group-rewards-by-day';
import { getBeginningOfLastYear } from './helper/get-beginning-of-last-year';
import { getEndOfLastYear } from './helper/get-end-of-last-year';
import { SubstrateChains } from '../model/substrate-chain';

const MAX_WALLETS_TO_SYNC = 4;

const jobs$: BehaviorSubject<JobResult[]> = new BehaviorSubject<JobResult[]>(
  (JSON.parse(localStorage.getItem('wallets') || '[]') as string[]).map(
    (wallet: string) => ({
      wallet,
      blockchain: 'dummy',
      currency: '',
      status: 'pending',
      lastModified: new Date().getTime(),
      syncFromDate: getBeginningOfLastYear(),
      syncUntilDate: getEndOfLastYear(),
    })
  )
);

const subscanChains$ = new ReplaySubject<SubstrateChains>(1);
fetchSubscanChains().then((chains) => subscanChains$.next(chains));

const walletsAddresses$ = new BehaviorSubject<string[]>(
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
        newJobResult.data = addMetaData(newJobResult, newJobResult.data.values);
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
          syncFromDate: getBeginningOfLastYear(),
          syncUntilDate: getEndOfLastYear(),
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
    async syncWallets(addresses: string[]): Promise<boolean> {
      let tooManyWallets = false;
      const existingWalletsToSync = await firstValueFrom(walletsAddresses$);
      if (existingWalletsToSync.length >= MAX_WALLETS_TO_SYNC) {
        return true;
      }
      let newWallets = addresses.filter(
        (a) => !existingWalletsToSync.includes(a)
      );
      if (
        existingWalletsToSync.length + newWallets.length >
        MAX_WALLETS_TO_SYNC
      ) {
        tooManyWallets = true;
        newWallets = newWallets.slice(
          0,
          MAX_WALLETS_TO_SYNC - existingWalletsToSync.length
        );
        if (newWallets.length === 0) {
          return tooManyWallets;
        }
      }

      const canonicaAddresses = [];
      const currency = (await firstValueFrom(
        useSharedStore().currency$.pipe(filter((c) => c !== undefined))
      )) as string;
      for (const address of newWallets) {
        const canonicaAddress = isValidEvmAddress(address)
          ? getAddress(address)
          : convertToCanonicalAddress(address);
        canonicaAddresses.push(canonicaAddress);
        wsSendMsg({
          type: 'fetchDataRequest',
          payload: {
            wallet: canonicaAddress,
            currency: currency,
            syncFromDate: getBeginningOfLastYear(),
            syncUntilDate: getEndOfLastYear(),
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
          syncFromDate: getBeginningOfLastYear(),
          syncUntilDate: getEndOfLastYear(),
        };
      });
      jobs.push(...dummyJobs);
      jobs$.next(jobs);
      return tooManyWallets;
    },
    sync() {
      return this.syncWallets([this.address.trim()]);
    },
    async removeWallet(job: {
      wallet: string;
      currency: string;
      syncFromDate: number;
      syncUntilDate: number;
    }) {
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
          syncFromDate: job.syncFromDate,
          syncUntilDate: job.syncUntilDate,
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
