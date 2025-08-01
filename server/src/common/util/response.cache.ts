import { FetchedDataRepository } from "./fetched-data.repository";
import { RequestHelper } from "./request.helper";

export class ResponseCache {
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
    try {
      const json = await this.requestHelper.req(url, method, body);
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
    }
  }
}
