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
  tap,
} from 'rxjs';
import { useSharedStore } from '../../shared-module/store/shared.store';
import { TaxableEvent } from '../../shared-module/model/taxable-event';
import { TaxData } from '../../shared-module/model/tax-data';
import { Rewards } from '../../shared-module/model/rewards';
import { JobResult } from '../../shared-module/model/job-result';
import { isTaxableEventVisible } from '../helper/is-taxable-event-visible';
import { allTokensHidden, isTokenHidden } from '../helper/is-token-hidden';
const blockchain$ = new ReplaySubject<string>(1);
const wallet$ = new ReplaySubject<string>(1);
const currency$ = new ReplaySubject<string>(1);

const tokenFilter$ = new ReplaySubject<{ name: string; value: boolean }[]>(1);
const hiddenTokens$ = new ReplaySubject<{ name: string; value: boolean }[]>(1);

const eventTypeFilter$ = new BehaviorSubject<Record<string, boolean>>({
  'Staking rewards': false,
  'Incoming transfers': false,
  'Outgoing transfers': false,
  Swaps: false,
});

const allFiltersInActive = (filters: Record<string, boolean>) => {
  return Object.entries(filters).every(([, v]) => v === false);
};

const excludedEntries$: BehaviorSubject<TaxableEvent[]> = new BehaviorSubject<
  TaxableEvent[]
>([]);

const taxData$ = new ReplaySubject<TaxData>(1);
combineLatest([useSharedStore().jobs$, blockchain$, wallet$, currency$])
  .pipe(
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
      (prev, curr) =>
        curr.values.length === prev.values.length &&
        curr.chain === prev.chain &&
        curr.address === prev.address &&
        curr.currency === prev.currency
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
        tokenFilter$.next(
          tokens
            .map((t) => ({ name: t, value: true }))
            .sort((a, b) => (a.name > b.name ? 1 : -1))
        );
        hiddenTokens$.next(
          tokens
            .map((t) => ({ name: t, value: false }))
            .sort((a, b) => (a.name > b.name ? 1 : -1))
        );
      }
      excludedEntries$.next([]);
    })
  )
  .subscribe((data) => taxData$.next(data));

const stakingRewards$ = new ReplaySubject<Rewards>(1);
combineLatest([useSharedStore().jobs$, blockchain$, wallet$, currency$])
  .pipe(
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
      (prev, curr) =>
        (curr?.values ?? []).length === (prev?.values ?? []).length
    )
  )
  .subscribe((data) => stakingRewards$.next(data));

const visibleTaxData$ = new ReplaySubject<TaxData>(1);
combineLatest([taxData$, eventTypeFilter$, tokenFilter$, hiddenTokens$])
  .pipe(
    map(([taxData, eventTypeFilter, tokenFilter, hiddenTokens]) => {
      const tokenFilterActive = tokenFilter.some((t) => t.value);
      const hiddenTokensActive = hiddenTokens.some((t) => t.value);
      let visibleTaxableEvents = taxData?.values
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
            allFiltersInActive(eventTypeFilter) ||
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
        .filter(
          (e) =>
            (!tokenFilterActive || isTaxableEventVisible(tokenFilter, e)) &&
            (!hiddenTokensActive || !allTokensHidden(hiddenTokens, e))
        );
      if (hiddenTokensActive) {
        visibleTaxableEvents = visibleTaxableEvents.map((e) => {
          const transfers = e.transfers.filter(
            (t) => !isTokenHidden(hiddenTokens, t.symbol)
          );
          return {
            ...e,
            transfers,
          };
        });
      }
      return {
        ...taxData,
        values: visibleTaxableEvents,
      };
    })
  )
  .subscribe((data) => visibleTaxData$.next(data));

export const useTaxableEventStore = defineStore('taxable-events', {
  state: (): {
    taxData$: Observable<TaxData>;
    visibleTaxData$: Observable<TaxData>;
    excludedEntries$: Observable<TaxableEvent[]>;
    tokenFilter$: Observable<{ name: string; value: boolean }[]>;
    hiddenTokens$: Observable<{ name: string; value: boolean }[]>;
    eventTypeFilter$: Observable<Record<string, boolean>>;
    stakingRewards$: Observable<Rewards>;
  } => {
    return {
      taxData$,
      visibleTaxData$,
      excludedEntries$: excludedEntries$.asObservable(),
      tokenFilter$: tokenFilter$.asObservable(),
      hiddenTokens$: hiddenTokens$.asObservable(),
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
    async clearTokenFilter() {
      const tokens = await firstValueFrom(tokenFilter$);
      tokens.forEach((t) => (t.value = false));
      tokenFilter$.next(tokens);
    },
    async clearHiddenTokens() {
      const hiddenTokens = await firstValueFrom(hiddenTokens$);
      hiddenTokens.forEach((t) => (t.value = false));
      hiddenTokens$.next(hiddenTokens);
    },
    async toggleHiddenToken(symbol: string) {
      const hiddenTokens = await firstValueFrom(hiddenTokens$);
      hiddenTokens
        .filter((t) => t.name === symbol)
        .forEach((t) => (t.value = !t.value));
      hiddenTokens$.next(hiddenTokens);
    },
    async toggleTokenFilter(symbol: string) {
      const tokens = await firstValueFrom(tokenFilter$);
      tokens
        .filter((t) => t.name === symbol)
        .forEach((t) => (t.value = !t.value));
      tokenFilter$.next(tokens);
    },
    async toggleEventFilter(filterName: string) {
      const filter = await firstValueFrom(eventTypeFilter$);
      filter[filterName] = !filter[filterName];
      eventTypeFilter$.next(filter);
    },
    async resetFilters() {
      const filter = await firstValueFrom(eventTypeFilter$);
      Object.keys(filter).forEach((k) => (filter[k] = false));
      eventTypeFilter$.next(filter);

      const tokenFilter = await firstValueFrom(tokenFilter$);
      tokenFilter.forEach((t) => (t.value = false));
      tokenFilter$.next(tokenFilter);

      const hiddenTokens = await firstValueFrom(hiddenTokens$);
      hiddenTokens.forEach((t) => (t.value = false));
      hiddenTokens$.next(hiddenTokens);
    },
    async removeAllEventTypeFilters() {
      const filters = await firstValueFrom(eventTypeFilter$);
      Object.keys(filters).forEach((key) => (filters[key] = false));
      eventTypeFilter$.next(filters);
    },
    async setExcludedEntries(entries: TaxableEvent[]) {
      excludedEntries$.next(entries);
    },
  },
});
