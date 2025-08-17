import { RequestHelper } from "../../common/util/request.helper";
import { ChainSlashes } from "./model/chain-slashes";
import { StakingResults } from "./model/staking-results";

export class DataPlatformApi {
  private requestHelper: RequestHelper;

  constructor() {
    this.requestHelper = new RequestHelper();
    this.requestHelper.defaultHeader = {
      "Content-Type": "application/json",
    };
  }

  fetchStakingRewards(
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ items: StakingResults[] }> {
    return this.requestHelper.req(
      `http://localhost:${process.env["DATA_PLATFORM_PORT"] || 9090}/api/rewards/list-account-rewards`,
      "POST",
      {
        accountId,
        startDate,
        endDate,
      },
    );
  }

  fetchStakingSlashes(
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ items: ChainSlashes[] }> {
    return this.requestHelper.req(
      `http://localhost:${process.env["DATA_PLATFORM_PORT"] || 9090}/api/rewards/list-account-slashes`,
      "POST",
      {
        accountId,
        startDate,
        endDate,
      },
    );
  }
}
