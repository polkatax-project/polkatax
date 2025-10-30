import { RequestHelper } from "../../common/util/request.helper";
import { BalanceEvent } from "./model/balance-event";
import { ChainSlashes } from "./model/chain-slashes";
import { LiquidStakingMintedInfos } from "./model/liquid-staking-minted-infos";
import { LiquidStakingRebondedInfos } from "./model/liquid-staking-rebonded-infos";
import { LiquidStakingRedeemedInfos } from "./model/liquid-staking-redeemed-infos";
import { StakingResultsDetailed } from "./model/staking-results";

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
  ): Promise<{ items: StakingResultsDetailed[] }> {
    return this.requestHelper.req(
      `http://localhost:${process.env["DATA_PLATFORM_PORT"] || 9090}/api/rewards/list-account-rewards-detailed`,
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

  fetchLiquidStakingMintedEvents(
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ items: LiquidStakingMintedInfos[] }> {
    return this.requestHelper.req(
      `http://localhost:${process.env["DATA_PLATFORM_PORT"] || 9090}/api/bifrost/list-liquididy-staking-minted`,
      "POST",
      {
        accountId,
        startDate,
        endDate,
      },
    );
  }

  fetchLiquidStakingRedeemedEvents(
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ items: LiquidStakingRedeemedInfos[] }> {
    return this.requestHelper.req(
      `http://localhost:${process.env["DATA_PLATFORM_PORT"] || 9090}/api/bifrost/list-liquididy-staking-redeemed`,
      "POST",
      {
        accountId,
        startDate,
        endDate,
      },
    );
  }

  fetchLiquidStakingRebondedEvents(
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ items: LiquidStakingRebondedInfos[] }> {
    return this.requestHelper.req(
      `http://localhost:${process.env["DATA_PLATFORM_PORT"] || 9090}/api/bifrost/list-liquididy-staking-rebonded`,
      "POST",
      {
        accountId,
        startDate,
        endDate,
      },
    );
  }

  async fetchBalanceEvents(
    chainType: string,
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<BalanceEvent[]> {
    const result = await this.requestHelper.req(
      `http://localhost:${process.env["DATA_PLATFORM_PORT"] || 9090}/api/balances/list-movements`,
      "POST",
      {
        accountId,
        startDate,
        endDate,
        chainType,
      },
    );
    return result?.chainBalanceMovements?.balanceMovementResults ?? [];
  }
}
