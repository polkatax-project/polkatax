import { defineStore } from 'pinia';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  ReplaySubject,
  shareReplay,
  tap,
} from 'rxjs';
import { useSharedStore } from '../../shared-module/store/shared.store';
import { TaxableEvent } from '../../shared-module/model/taxable-event';
import { TaxData } from '../../shared-module/model/tax-data';
import { Rewards } from '../../shared-module/model/rewards';
import { JobResult } from '../../shared-module/model/job-result';
import { isTokenVisible } from '../helper/is-token-visible';
const blockchain$ = new ReplaySubject<string>(1);
const wallet$ = new ReplaySubject<string>(1);
const currency$ = new ReplaySubject<string>(1);

const visibleTokens$ = new ReplaySubject<{ name: string; value: boolean }[]>(1);

const eventTypeFilter$ = new BehaviorSubject<Record<string, boolean>>({
  'Staking rewards': true,
  'Incoming transfers': false,
  'Outgoing transfers': true,
  Swaps: true,
});

const excludedEntries$: BehaviorSubject<TaxableEvent[]> = new BehaviorSubject<
  TaxableEvent[]
>([]);

const taxData$ = combineLatest([
  useSharedStore().jobs$,
  blockchain$,
  wallet$,
  currency$,
]).pipe(
  map(([jobs, blockchain, wallet, currency]) => {
    return jobs.find(
      (j) =>
        j.blockchain === blockchain &&
        j.wallet === wallet &&
        j.currency === currency
    );
  }),
  map((jobResult) => jobResult?.data),
  filter((data) => !!data),
  distinctUntilChanged(
    (prev, curr) => curr.values.length === prev.values.length
  ),
  tap((data) => {
    if (data) {
      const tokens: string[] = [];
      data.values.forEach((e: TaxableEvent) =>
        e.transfers.forEach((t) => {
          if (tokens.indexOf(t.symbol.toUpperCase()) === -1) {
            tokens.push(t.symbol.toUpperCase());
          }
        })
      );
      visibleTokens$.next(
        tokens
          .map((t) => ({ name: t, value: true }))
          .sort((a, b) => (a.name > b.name ? 1 : -1))
      );
    }
    excludedEntries$.next([]);
  })
);

const stakingRewards$: Observable<Rewards> = combineLatest([
  useSharedStore().jobs$,
  blockchain$,
  wallet$,
  currency$,
]).pipe(
  map(([jobs, blockchain, wallet, currency]) => {
    return jobs.find(
      (j) =>
        j.blockchain === blockchain &&
        j.wallet === wallet &&
        j.currency === currency
    );
  }),
  filter((j) => !!j),
  map((job) => ({
    values: job.stakingRewards?.values ?? [],
    summary: job.stakingRewardsSummary!,
    dailyValues: job.dailyStakingRewards!,
    currency: job?.currency,
    address: job?.wallet,
    chain: job?.blockchain,
    token: (job as JobResult)?.stakingRewards?.token || '',
  })),
  distinctUntilChanged(
    (prev, curr) => (curr?.values ?? []).length === (prev?.values ?? []).length
  )
);

const visibleTaxData$ = combineLatest([
  taxData$,
  eventTypeFilter$,
  visibleTokens$,
]).pipe(
  map(([taxData, eventTypeFilter, visibleTokens]) => {
    const visibleTaxableEvents = taxData?.values
      .filter((v) => {
        const isStakingReward = v.label === 'Staking reward';
        const incomingTransfer =
          v.transfers.some((t) => t.amount > 0) &&
          !v.transfers.some((t) => t.amount < 0);
        const outgoingTransfer =
          v.transfers.some((t) => t.amount < 0) &&
          !v.transfers.some((t) => t.amount > 0);
        const swap =
          v.transfers.some((t) => t.amount < 0) &&
          v.transfers.some((t) => t.amount > 0);
        return (
          (isStakingReward && eventTypeFilter['Staking rewards']) ||
          (!isStakingReward &&
            incomingTransfer &&
            eventTypeFilter['Incoming transfers']) ||
          (!isStakingReward &&
            outgoingTransfer &&
            eventTypeFilter['Outgoing transfers']) ||
          (swap && eventTypeFilter['Swaps'])
        );
      })
      .filter((e) => {
        return e.transfers.some((t) => isTokenVisible(visibleTokens, t.symbol));
      });
    return {
      ...taxData,
      values: visibleTaxableEvents,
    };
  }),
  shareReplay(1)
);

export const useTaxableEventStore = defineStore('taxable-events', {
  state: (): {
    taxData$: Observable<TaxData>;
    visibleTaxData$: Observable<TaxData>;
    excludedEntries$: Observable<TaxableEvent[]>;
    visibleTokens$: Observable<{ name: string; value: boolean }[]>;
    eventTypeFilter$: Observable<Record<string, boolean>>;
    stakingRewards$: Observable<Rewards>;
  } => {
    return {
      taxData$,
      visibleTaxData$,
      excludedEntries$: excludedEntries$.asObservable(),
      visibleTokens$: visibleTokens$.asObservable(),
      eventTypeFilter$: eventTypeFilter$.asObservable(),
      stakingRewards$,
    };
  },
  actions: {
    setBlockchain(blockchain: string) {
      blockchain$.next(blockchain);
    },
    setWallet(wallet: string) {
      wallet$.next(wallet);
    },
    setCurrency(currency: string) {
      currency$.next(currency);
    },
    async toggleAllVisibleTokens() {
      const tokens = await firstValueFrom(visibleTokens$);
      const allVisible = tokens.every((t) => t.value);
      tokens.forEach((t) => (t.value = !allVisible));
      visibleTokens$.next(tokens);
    },
    async toggleTokenVisibility(symbol: string) {
      const tokens = await firstValueFrom(visibleTokens$);
      tokens
        .filter((t) => t.name === symbol)
        .forEach((t) => (t.value = !t.value));
      visibleTokens$.next(tokens);
    },
    async toggleEventFilter(filterName: string) {
      const filter = await firstValueFrom(eventTypeFilter$);
      filter[filterName] = !filter[filterName];
      eventTypeFilter$.next(filter);
    },
    async resetFilters() {
      const filter = await firstValueFrom(eventTypeFilter$);
      Object.keys(filter).forEach((k) => (filter[k] = true));
      eventTypeFilter$.next(filter);

      const tokens = await firstValueFrom(visibleTokens$);
      tokens.forEach((t) => (t.value = true));
      visibleTokens$.next(tokens);
    },
    async toggleAllEventTypeFilters() {
      const filters = await firstValueFrom(eventTypeFilter$);
      const allActive = Object.keys(filters).every((key) => filters[key]);
      Object.keys(filters).forEach((key) => (filters[key] = !allActive));
      eventTypeFilter$.next(filters);
    },
    async setExcludedEntries(entries: TaxableEvent[]) {
      excludedEntries$.next(entries);
    },
  },
});
