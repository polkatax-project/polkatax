import { SubscanService } from "../../blockchain/substrate/api/subscan.service";
import { ForeignAsset } from "../../blockchain/substrate/model/foreign-asset";
import { Transfer } from "../../blockchain/substrate/model/raw-transfer";
import {
  EventDetails,
  SubscanEvent,
} from "../../blockchain/substrate/model/subscan-event";
import { mapPublicKeyToAddress } from "../../blockchain/substrate/util/map-public-key-to-address";
import { logger } from "../../logger/logger";
import isEqual from "lodash.isequal";
import { Asset } from "../../blockchain/substrate/model/asset";
import { isEvmAddress } from "../../data-aggregation/helper/is-evm-address";
import { getAddress } from "ethers";
import BigNumber from "bignumber.js";

interface EventDerivedTransfer extends Transfer {
  event_id: string;
  module_id: string;
  original_event_id: string;
}

interface AssetInfos {
  tokens: Asset[];
  foreignAssets: ForeignAsset[];
}

const getPropertyValue = (property: string | string[], event: EventDetails) => {
  if (!Array.isArray(property)) {
    property = [property]
  }
  return event.params.find(
    (p) => property.includes(p.name),
  )?.value;
}

const extractAddress = (property: string | string[], event: EventDetails) => {
  const value = getPropertyValue(property, event)
  return mapKeyToCanonicalAddress(value);
}

const extractAsset = (property: string | string[], event: EventDetails, tokens: Asset[]) => {
  const value = getPropertyValue(property, event)
  return tokens.find((t) => value == t.asset_id || isEqual(value, t.asset_id));
}

const extractForeignAsset = (property: string | string[], event: EventDetails, tokens: ForeignAsset[]) => {
  const value = getPropertyValue(property, event)
  return tokens.find((t) => value == t.asset_id || isEqual(value, t.multi_location) || isEqual(value, t.asset_id));
}

const mapKeyToCanonicalAddress = (key: string) => {
  if (isEvmAddress(key)) {
    return getAddress(key);
  }
  return mapPublicKeyToAddress(key);
};

const toTransfer = (event: EventDetails, from: string, to: string, amount: number, token: { symbol: string, decimals: number, unique_id: string }) => {
  if (to === undefined || from === undefined || !token || !amount) {
    throw `Missing data: to: ${to}, from: ${from}, token: ${token}, amount: ${amount}`
  }
  return {
    event_id: event.event_id,
    module_id: event.module_id,
    original_event_id: event.original_event_index,
    block: event.block_num,
    hash: event.extrinsic_hash,
    extrinsic_index: event.extrinsic_index,
    timestamp: event.timestamp!,
    symbol: token.symbol,
    amount: amount,
    to,
    from,
    asset_unique_id: token.unique_id,
  }
}

export class SpecialEventsToTransfersService {
  eventConfigs: {
    chains;
    event: string | string[];
    condition?: (event: SubscanEvent, peerEvents: SubscanEvent[]) => boolean,
    handler: (
      chain: { domain: string; token: string },
      e: EventDetails,
      context: AssetInfos & { events: SubscanEvent[] },
    ) => Promise<EventDerivedTransfer | EventDerivedTransfer[]>;
  }[] = [
    { 
      chains: ["coretime-polkadot", "coretime-kusama"],
      event: "brokerPurchased",
      handler: (c, e, context) => this.onCoretimePurchased(e, context),
    },
    { 
      chains: ["coretime-polkadot", "coretime-kusama"],
      event: "brokerRenewed",
      handler: (c, e, context) => this.onCoretimePurchased(e, context),
    },
    { 
        chains: ["*"],
        event: "balancesReserveRepatriated",
        handler: (c, e, context) => this.onReserveRepatriated(e, context),
    },
    { 
        chains: ["energywebx"],
        event: "balancesDeposit",
        handler: (c, e, context) => this.onBalancesDeposit(e, context),
        condition: (event, events) => !!events.find(e => e.module_id + e.event_id === "tokenmanagerAVTLifted"), 
    },
    { 
        chains: ["energywebx"],
        event: "balancesWithdraw",
        handler: (c, e, context) => this.onBalancesWithdraw(e, context),
        condition: (event, events) => !!events.find(e => e.module_id + e.event_id === "tokenmanagerAvtLowered"), 
    },
    /*{
      chains: ["*"],
      event: "balancesLocked",
      handler: (c, e, context) => this.onBalancesDeposit(e, context),
    },
    {
      chains: ["*"],
      event: "balancesUnlocked",
      handler: (c, e, context) => this.onBalancesWithdraw(e, context),
    },*/
    {
      chains: ["bifrost"],
      event: "balancesIssued",
      handler: (c, e, context) =>
        this.onBalancesDeposit(e, context),
    },
    {
      chains: ["bifrost"],
      event: "vtokenmintingRedeemed",
      handler: (c, e, context) => this.bifrostRedeemedVToken(e, context),
    },
    {
      chains: ["bifrost"],
      event: "vtokenmintingMinted",
      handler: (c, e, context) => this.bifrostMintedVToken(e, context),
    },
    {
      chains: ["bifrost"],
      event: "vtokenmintingRebondedByUnlockId",
      handler: (c, e, context) => this.bifrostMintedVToken(e, context),
    },
    {
      chains: ["assethub-polkadot", "assethub-kusama"],
      event: "assetconversionSwapExecuted",  // SwapCreditExecuted
      handler: (c, e, context) => this.onAssethubSwapExecuted(e, context),
    },
    {
      chains: ["assethub-polkadot", "assethub-kusama"],
      event: "foreignassetsIssued",
      handler: (c, e, context) => this.onAssethubForeignAssetsIssued(e, context),
    },
    {
      chains: ["assethub-polkadot", "assethub-kusama", "coretime-polkadot", "coretime-kusama"],
      event: "assetsIssued",
      handler: (c, e, context) => this.onAssethubAssetsIssued(e, context),
    },
    {
      chains: ["*"],
      event: "balancesDeposit",
      handler: (c, e, context) => this.onBalancesDeposit(e, context),
      condition: (event, events) => !!events.find(e => e.module_id + e.event_id === "systemNewAccount"), 
    },
    {
      chains: ["*"],
      event: "balancesWithdraw",
      handler: (c, e, context) => this.onBalancesWithdraw(e, context),
      condition: (event, events) => !!events.find(e => e.module_id + e.event_id === "systemKilledAccount"), 
    },
    {
      chains: ["assethub-polkadot", "assethub-kusama", "coretime-polkadot", "coretime-kusama", "people-polkadot", "people-kusama",
        "collectives-polkadot", "collectives-kusama"
      ],
      event: "balancesMinted",
      handler: (c, e, context) => this.onBalancesDeposit(e, context),
    },
    {
      chains: ["astar", "mythos", "spiritnet"],
      event: "balancesThawed",
      handler: (c, e, context) => this.onBalancesWithdraw(e, context),
    },
    {
      chains: ["astar", "mythos", "spiritnet"],
      event: "balancesFrozen",
      handler: (c, e, context) => this.onBalancesDeposit(e, context),
    },
    {
      chains: ["polkadot", "kusama"],
      event: "delegatedstakingMigratedDelegation",
      handler: (c, e, context) => this.migratedDelegation(c, e, context),
    }
  ];

  constructor(private subscanService: SubscanService) {}

  private findMatchingConfig(
    chain: string,
    ev: { module_id: string; event_id: string },
  ) {
    return this.eventConfigs.find(
      (h) =>
        (h.chains.includes("*") || h.chains.includes(chain)) && (ev.module_id + ev.event_id) === h.event
    );
  }

  private async fetchTokens(chainInfo: {
    token: string;
    domain: string;
  }): Promise<AssetInfos> {
    const token = await this.subscanService.fetchNativeToken(chainInfo.domain);
    let extra: {
      tokens: Asset[];
      foreignAssets: ForeignAsset[];
    } = {
      tokens: [],
      foreignAssets: [],
    };
    switch (chainInfo.domain) {
      case "assethub-polkadot":
      case "assethub-kusama":
        const foreignAssets = await this.subscanService.fetchForeignAssets(
          chainInfo.domain,
        );
        const tokens = await this.subscanService.scanAssets(
          chainInfo.domain,
        );
        tokens.push({
          symbol: chainInfo.token,
          decimals: token.token_decimals,
          native: true,
          unique_id: chainInfo.token,
          asset_id: chainInfo.token,
        });
        extra = { foreignAssets, tokens };
        break;
      case "peaq":
        extra.tokens =  await this.subscanService.scanAssets(chainInfo.domain);
        extra.tokens.push({
          symbol: chainInfo.token,
          decimals: token.token_decimals,
          native: true,
          unique_id: chainInfo.token,
          asset_id: chainInfo.token,
        });
        break;
      case "bifrost":
      case "hydration":
      case "acala":
      case "astar":
      case "mythos":
      case "energywebx":
      case "unique":
      case 'spiritnet':
        extra.tokens = await this.subscanService.scanTokens(chainInfo.domain);
        extra.tokens.push({
          name: chainInfo.token,
          decimals: token.token_decimals,
          symbol: chainInfo.token,
          asset_id: { Native: chainInfo.token },
          unique_id: chainInfo.token,
          currency_id: chainInfo.token,
          native: true,
        });
        break;
      case "polkadot":
      case "kusama":
      case "coretime-polkadot":
      case "collectives-polkadot":
      case "people-polkadot":
      case "people-kusama":
      case "coretime-kusama":
      case "collectives-kusama":
          extra.tokens.push({
          name: chainInfo.token,
          decimals: token.token_decimals,
          symbol: chainInfo.token,
          asset_id: { Native: chainInfo.token },
          unique_id: chainInfo.token,
          currency_id: chainInfo.token,
          native: true,
        });
    }
    return extra;
  }

  async handleEvents(
    chainInfo: { token: string; domain: string },
    events: SubscanEvent[],
  ): Promise<EventDerivedTransfer[]> {

    const groupedEvents: Record<string, SubscanEvent[]> = {}
    events.forEach(e => {
        if (!groupedEvents[e.extrinsic_index ?? e.timestamp]) {
            groupedEvents[e.extrinsic_index ?? e.timestamp] = []
        }
        groupedEvents[e.extrinsic_index ?? e.timestamp].push(e)
    })

    const eventsOfInterest = events.filter((e) => {
      const config = this.findMatchingConfig(chainInfo.domain, e)
      if (!config) {
        return false
      }
      if (!config.condition) {
        return true
      }
      return config.condition(e, groupedEvents[e.extrinsic_index ?? e.timestamp])
    })

    const eventDetails = await this.subscanService.fetchEventDetails(
      chainInfo.domain,
      eventsOfInterest,
    );
    const extras = await this.fetchTokens(chainInfo);
    const transfersFromEvents = (
      await Promise.all(
        eventDetails.map(async (details) => {
          try {
            const originalEvent = events.find(e => e.event_index === details.original_event_index)
            const eventsInTx = groupedEvents[originalEvent.extrinsic_index ?? originalEvent.timestamp]
            return await this.findMatchingConfig(
              chainInfo.domain,
              details,
            ).handler(chainInfo, details, { ...extras, events: eventsInTx });
          } catch (error) {
            logger.error(
              `Error mapping event to transfer: ${details.extrinsic_index}, ${details.original_event_index}, ${details.module_id} ${details.event_id}`,
            );
            logger.error(error);
            return undefined;
          }
        }),
      )
    )
      .flat()
      .filter((t) => !!t);

    const groupedTransfers: Record<string, [EventDerivedTransfer]> = {};
    transfersFromEvents.forEach((t) => {
      if (!groupedTransfers[t.extrinsic_index]) {
        groupedTransfers[t.extrinsic_index] = [t];
      } else {
        groupedTransfers[t.extrinsic_index].push(t);
      }
    });
    const gatheredTransfers = Object.values(groupedTransfers).flat();
    return gatheredTransfers;
  }

  private async onAssethubSwapExecuted(
    event: EventDetails,
    {
      foreignAssets,
      tokens,
    }: { foreignAssets: ForeignAsset[]; tokens: Asset[] },
  ): Promise<EventDerivedTransfer[]> {
    const from = extractAddress("who", event)
    const to = extractAddress("send_to", event)
    const route: { col1: any; col2: any }[] = getPropertyValue("path", event)
    const assets = route
      .map((r) => r.col1)
      .map((location) => {
        if (location.interior?.Here === "NULL") {
          return tokens.find((t) => t.symbol === "DOT");
        }
        const foreign = foreignAssets.find((t) =>
          isEqual(t.multi_location, location),
        );
        if (foreign) {
          return foreign;
        }
        const findGeneralIndex = (location: any): any => {
          const stack = [location];

          while (stack.length > 0) {
            const current = stack.pop();

            if (current?.GeneralIndex) {
              return current.GeneralIndex;
            }

            if (Array.isArray(current)) {
              stack.push(...current);
            } else if (current && typeof current === "object") {
              stack.push(...Object.values(current));
            }
          }

          return undefined;
        };
        const generalIndex = findGeneralIndex(location);
        return tokens.find((t) => t.asset_id == generalIndex);
      });
    const fromAsset = assets[0];
    const toAsset = assets[assets.length - 1];

    const amount_in = Number(getPropertyValue("amount_in", event)) / Math.pow(10, fromAsset?.decimals)
    const amount_out = Number(getPropertyValue("amount_out", event)) / Math.pow(10, toAsset?.decimals)
    return [
      toTransfer(event, from, "", amount_in, fromAsset),
      toTransfer(event, "", to, amount_out, toAsset)
    ];
  }

  private async onAssethubForeignAssetsIssued(
    event: EventDetails,
    { foreignAssets }: { foreignAssets: ForeignAsset[] },
  ): Promise<EventDerivedTransfer> {
    const owner = extractAddress("owner", event)
    const asset = extractForeignAsset("asset_id", event, foreignAssets)
    const amount = Number(getPropertyValue("amount", event)) / Math.pow(10, asset?.decimals);
    return toTransfer(event, "", owner, amount, asset)
  }

  private async onAssethubAssetsIssued(
    event: EventDetails,
    { tokens }: { tokens: Asset[] },
  ): Promise<EventDerivedTransfer> {
    const owner = extractAddress("owner", event)
    const asset = extractAsset("asset_id", event, tokens)
    const amount = Number(getPropertyValue("amount", event)) / Math.pow(10, asset?.decimals);
    return toTransfer(event, "", owner, amount, asset)
  }

  private async onBalancesDeposit(
    event: EventDetails,
    { tokens }: { tokens: Asset[] },
  ): Promise<EventDerivedTransfer> {
    const address = extractAddress("who", event)
    const tokenInfo = tokens.find((t) => t.native);
    const amount = Number(getPropertyValue("amount", event)) / Math.pow(10, tokenInfo?.decimals);
    return toTransfer(event, "", address, amount, tokenInfo)
  }

  private async onBalancesWithdraw(
    event: EventDetails,
    { tokens }: { tokens: Asset[] },
  ): Promise<EventDerivedTransfer> {
    const address = extractAddress("who", event)
    const tokenInfo = tokens.find((t) => t.native);
    const amount = Number(getPropertyValue("amount", event)) / Math.pow(10, tokenInfo?.decimals);
    return toTransfer(event, address, "", amount, tokenInfo)
  }

  private async onPeaqBalancesBurned(
    event: EventDetails,
    { tokens }: { tokens: Asset[] },
  ): Promise<EventDerivedTransfer> {
    const address = extractAddress("who", event)
    const asset = extractAsset("asset_id", event, tokens)
    const amount = Number(getPropertyValue("amount", event)) / Math.pow(10, asset?.decimals);
    return toTransfer(event, address, "", amount, asset)
  }

  private async onPeaqBalancesIssued(
    event: EventDetails,
    { tokens }: { tokens: Asset[] },
  ): Promise<EventDerivedTransfer> {
    const address = extractAddress("who", event)
    const asset = extractAsset("asset_id", event, tokens)
    const amount = Number(getPropertyValue("amount", event)) / Math.pow(10, asset?.decimals);
    return toTransfer(event, "", address, amount, asset)
  }

  private async onCoretimePurchased(
    event: EventDetails,
    { tokens }: { tokens: Asset[] },
  ): Promise<EventDerivedTransfer> {
    const address = extractAddress("who", event)
    const tokenInfo = tokens.find((t) => t.native);
    const amount = Number(getPropertyValue("price", event)) / Math.pow(10, tokenInfo?.decimals);
    return toTransfer(event, address, "", amount, tokenInfo)
  }

  private async bifrostMintedVToken(
    event: EventDetails,
    { tokens }: { tokens: Asset[] },
  ): Promise<EventDerivedTransfer> {
    const address = extractAddress(["minter", "address", "rebonder"], event)
    const tokenId = getPropertyValue(["currency_id", "token_id"], event)
    const vTokenId = {};
    Object.keys(tokenId).forEach((property) => {
      vTokenId["V" + property] = tokenId[property];
    });
    const token = tokens.find((t) => isEqual(t.asset_id, vTokenId));
    const amount = new BigNumber(
      getPropertyValue(["v_currency_amount", "vtoken_amount"], event)
    )
      .multipliedBy(Math.pow(10, -token.decimals))
      .toNumber();
    return toTransfer(event, "", address, amount, token)
  }

  private async bifrostRedeemedVToken(
    event: EventDetails,
    { tokens }: { tokens: Asset[] },
  ): Promise<EventDerivedTransfer> {
    const address = extractAddress(["redeemer", "address"], event)
    const tokenId = getPropertyValue(["currency_id", "token_id"], event)
    const vTokenId = {};
    Object.keys(tokenId).forEach((property) => {
      vTokenId["V" + property] = tokenId[property];
    });
    const token = tokens.find((t) => isEqual(t.asset_id, vTokenId));
    const amount = new BigNumber(getPropertyValue(["v_currency_amount", "vtoken_amount"], event))
      .multipliedBy(Math.pow(10, -token.decimals))
      .toNumber();
    return toTransfer(event, address, "", amount, token)
  }

  private async migratedDelegation(
    chainInfo: { token: string; domain: string },
    event: EventDetails,
    { tokens }: { tokens: Asset[] },
  ): Promise<EventDerivedTransfer> {
    const address = extractAddress("delegator", event)
    const token = tokens.find((t) => t.symbol === chainInfo.token);
    const amount = new BigNumber(getPropertyValue("amount", event))
      .multipliedBy(Math.pow(10, -token.decimals))
      .toNumber();
    return toTransfer(event, "", address, amount, token)
  }

  private async onReserveRepatriated(
    event: EventDetails,
    { tokens }: { tokens: Asset[] },
  ): Promise<EventDerivedTransfer> {
    const to = extractAddress("to", event)
    const from = extractAddress("from", event)
    const tokenInfo = tokens.find((t) => t.native);
    const amount = Number(getPropertyValue("amount", event)) / Math.pow(10, tokenInfo?.decimals);
    return toTransfer(event, from, to, amount, tokenInfo)

  }

}
