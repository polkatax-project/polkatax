import { FetchedDataRepository } from "./fetched-data.repository";
import { RequestHelper } from "./request.helper";
import { firstValueFrom, ReplaySubject, Subject } from "rxjs";

export class ResponseCache {
  private pendingRequests: Record<string, Subject<any>> = {};

  constructor(
    private fetchedDataRepository: FetchedDataRepository,
    private requestHelper: RequestHelper,
  ) {}

  async tryFetchDataFromStore<T>(url, method, body?): Promise<T | null> {
    const cachedData = await this.fetchedDataRepository.fetchStoredData<any>(
      url,
      method,
      body,
    );
    return cachedData;
  }

  async fetchAndStoreData<T>(
    url,
    method,
    body?,
    cacheDurationInHours?: number,
    apiKey?: string,
  ): Promise<T | null> {
    const key = this.fetchedDataRepository.generateCacheKey(url, method, body);
    if (this.pendingRequests[key]) {
      return firstValueFrom(this.pendingRequests[key]);
    }

    this.pendingRequests[key] = new ReplaySubject<any>(1);

    const fromStore = await this.fetchedDataRepository.fetchStoredData<T>(
      url,
      method,
      body,
    );

    if (fromStore) {
      this.pendingRequests[key].next(fromStore);
      delete this.pendingRequests[key];
      return fromStore;
    }

    try {
      const json = await this.requestHelper.req(url, method, body, apiKey);
      this.pendingRequests[key].next(json);
      await this.fetchedDataRepository.storeFetchedResult(
        url,
        method,
        body,
        json,
        cacheDurationInHours,
      );
      return json;
    } catch (error) {
      if (error.statusCode === 404) {
        /**
         * 404 errors can happen when a chain is removed from subscan indexing.
         */
        this.pendingRequests[key].next(null);
        await this.fetchedDataRepository.storeFetchedResult(
          url,
          method,
          body,
          null,
          cacheDurationInHours,
        );
        return null;
      } else {
        this.pendingRequests[key].error(error);
      }
      throw error;
    } finally {
      delete this.pendingRequests[key];
    }
  }
}
