import { FetchedDataRepository } from "./fetched-data.repository";
import { RequestHelper } from "./request.helper";
import { firstValueFrom, ReplaySubject, Subject } from 'rxjs'

export class ResponseCache {
  private pendingRequests: Record<string, Subject<any>> = {}

  constructor(
    private fetchedDataRepository: FetchedDataRepository,
    private requestHelper: RequestHelper,
  ) {}

  async fetchData<T>(
    url,
    method,
    body?,
    cacheDurationInHours?: number,
  ): Promise<T | null> {
    const cachedData = await this.fetchedDataRepository.fetchStoredData<any>(
      url,
      method,
      body,
    );
    if (cachedData !== undefined) {
      return cachedData;
    }

    const key = this.fetchedDataRepository.generateCacheKey(
      url,
      method,
      body,
    )
    if (this.pendingRequests[key]) {
      return firstValueFrom(this.pendingRequests[key])
    } 
    this.pendingRequests[key] = new ReplaySubject<any>(1)

    try {
      const json = await this.requestHelper.req(url, method, body);
      this.pendingRequests[key].next(json)
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
        this.pendingRequests[key].next(null)
        await this.fetchedDataRepository.storeFetchedResult(
          url,
          method,
          body,
          null,
          cacheDurationInHours,
        );
        return null;
      }
      throw error;
    } finally {
      delete this.pendingRequests[key]
    }
  }
}
