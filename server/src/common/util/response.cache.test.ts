import { FetchedDataRepository } from "./fetched-data.repository";
import { RequestHelper } from "./request.helper";
import { expect, it, jest, describe, beforeEach } from "@jest/globals";
import { ResponseCache } from "./response.cache";

jest.mock("./fetched-data.repository");
jest.mock("./request.helper");

describe("ResponseCache", () => {
  let responseCache: ResponseCache;
  let mockRepo: jest.Mocked<FetchedDataRepository>;
  let mockHelper: jest.Mocked<RequestHelper>;

  const url = "https://api.example.com/data";
  const method = "GET";
  const body = { some: "body" };
  const key = "cache_key";
  const responseData = { message: "Hello" };

  beforeEach(() => {
    mockRepo = {
      fetchStoredData: jest.fn(),
      generateCacheKey: jest.fn().mockReturnValue(key),
      storeFetchedResult: jest.fn(),
    } as any;

    mockHelper = {
      req: jest.fn(),
    } as any;

    responseCache = new ResponseCache(mockRepo, mockHelper);
  });

  it("returns cached data if available", async () => {
    mockRepo.fetchStoredData.mockResolvedValue(responseData);

    const result = await responseCache.fetchData(url, method, body);

    expect(mockRepo.fetchStoredData).toHaveBeenCalledWith(url, method, body);
    expect(result).toEqual(responseData);
    expect(mockHelper.req).not.toHaveBeenCalled();
  });

  it("fetches and stores data if not cached", async () => {
    mockRepo.fetchStoredData.mockResolvedValue(undefined);
    mockHelper.req.mockResolvedValue(responseData);

    const result = await responseCache.fetchData(url, method, body);

    expect(mockHelper.req).toHaveBeenCalledWith(url, method, body);
    expect(mockRepo.storeFetchedResult).toHaveBeenCalledWith(
      url,
      method,
      body,
      responseData,
      undefined,
    );
    expect(result).toEqual(responseData);
  });

  it("prevents parallel redundant requests (deduplication)", async () => {
    mockRepo.fetchStoredData.mockResolvedValue(undefined);
    mockHelper.req.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(responseData), 10)),
    );

    const [res1, res2] = await Promise.all([
      responseCache.fetchData(url, method, body),
      responseCache.fetchData(url, method, body),
    ]);

    expect(mockHelper.req).toHaveBeenCalledTimes(1);
    expect(res1).toEqual(responseData);
    expect(res2).toEqual(responseData);
  });

  it("stores and returns null for 404 responses", async () => {
    const error = { statusCode: 404 };
    mockRepo.fetchStoredData.mockResolvedValue(undefined);
    mockHelper.req.mockRejectedValue(error);

    const result = await responseCache.fetchData(url, method, body);

    expect(result).toBeNull();
    expect(mockRepo.storeFetchedResult).toHaveBeenCalledWith(
      url,
      method,
      body,
      null,
      undefined,
    );
  });

  it("throws non-404 errors", async () => {
    const error = { statusCode: 500, message: "Internal Server Error" };
    mockRepo.fetchStoredData.mockResolvedValue(undefined);
    mockHelper.req.mockRejectedValue(error);

    await expect(responseCache.fetchData(url, method, body)).rejects.toEqual(
      error,
    );
  });

  it("cleans up pendingRequests after fetch", async () => {
    mockRepo.fetchStoredData.mockResolvedValue(undefined);
    mockHelper.req.mockResolvedValue(responseData);
    await responseCache.fetchData(url, method, body);
    expect((responseCache as any).pendingRequests[key]).toBeUndefined();
  });
});
