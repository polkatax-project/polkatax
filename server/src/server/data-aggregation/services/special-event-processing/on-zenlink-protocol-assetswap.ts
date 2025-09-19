import { Asset } from "../../../blockchain/substrate/model/asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedAssetMovement } from "./event-derived-asset-movement";
import { EventHandlerContext } from "./event-handler-context";
import { mapKeyToCanonicalAddress } from "./helper";

export const extractZenLinkValues = async (
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<{
  address: string;
  assets: Asset[];
  amounts: string[];
}> => {
  let addresses = event.params
    .filter((p) => p.type_name === "AccountId")
    .map((v) => v.value);
  if (addresses.length > 2) {
    throw Error(
      "Unexpected number of address in zenlink protocol. EventId " +
        event.original_event_index,
    );
  }
  if (addresses.length > 1 && addresses[0] !== addresses[1]) {
    throw Error(
      "Two different account Ids in zenlink event. Ignoring event. EventId " +
        event.original_event_index,
    );
  }
  const address = mapKeyToCanonicalAddress(addresses[0]);

  const assetIndices = event.params.find((p) => p.type_name === "Vec<AssetId>")
    ? (
        event.params.find((p) => p.type_name === "Vec<AssetId>")?.value ?? []
      ).map((a) => a.asset_index)
    : event.params
        .filter((p) => p.type_name === "AssetId")
        .map((p) => p.value?.asset_index);

  const assetTypes = event.params.find((p) => p.type_name === "Vec<AssetId>")
    ? (
        event.params.find((p) => p.type_name === "Vec<AssetId>")?.value ?? []
      ).map((a) => a.asset_type)
    : event.params
        .filter((p) => p.type_name === "AssetId")
        .map((p) => p.value?.asset_type);

  const assets = assetIndices
    .map((a, idx) =>
      tokens.find(
        (t) =>
          (assetTypes[idx] === 0 && t.native) ||
          (assetTypes[idx] !== 0 && t.asset_id === String(a)),
      ),
    )
    .filter((a) => !!a);
  if (addresses.length > 3) {
    throw Error(
      "Unexpected number of assets too larger in zenlink protocol. EventId " +
        event.original_event_index,
    );
  }

  const balances = event.params.find((p) => p.type_name === "Vec<AssetBalance>")
    ? (event.params.find((p) => p.type_name === "Vec<AssetBalance>")?.value ??
      [])
    : event.params
        .filter((p) => p.type_name === "AssetBalance")
        .map((p) => p.value);

  return {
    address,
    assets,
    amounts: balances,
  };
};

export const onZenlinkProtcolAssetSwap = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement[]> => {
  const { address, assets, amounts } = await extractZenLinkValues(event, {
    tokens,
  });
  if (assets.length < 2) {
    throw Error(
      "Unexpected number of assets too small in zenlink protocol. EventId " +
        event.original_event_index,
    );
  }
  /**
   * transfer of native token (asset_id = 0) are already captured via transfer event.
   */
  const transfers: EventDerivedAssetMovement[] = [];
  transfers.push({
    event,
    from: address,
    rawAmount: amounts[0],
    token: assets[0],
    semanticGroupId: event.original_event_index,
    label: "Swap",
  });
  transfers.push({
    event,
    to: address,
    rawAmount: amounts[1],
    token: assets[1],
    semanticGroupId: event.original_event_index,
    label: "Swap",
  });
  if (assets.length === 3) {
    transfers.push({
      event,
      to: address,
      rawAmount: amounts[2],
      token: assets[2],
      semanticGroupId: event.original_event_index,
      label: "Swap",
    });
  }
  return transfers;
};

export const onZenlinkProtcolLiquidityRemoved = async (
  event: EventDetails,
  { tokens }: EventHandlerContext,
): Promise<EventDerivedAssetMovement[]> => {
  const { address, assets, amounts } = await extractZenLinkValues(event, {
    tokens,
  });

  return assets.map((_, idx) => ({
    event,
    to: address,
    rawAmount: amounts[idx],
    token: assets[idx],
    label: "Liquidity removed",
  }));
};

export const onZenlinkProtcolLiquidityAdded = async (
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<EventDerivedAssetMovement[]> => {
  const { address, assets, amounts } = await extractZenLinkValues(event, {
    tokens,
  });

  return assets.map((_, idx) => ({
    event,
    from: address,
    rawAmount: amounts[idx],
    token: assets[idx],
    label: "Liquidity added",
  }));
};
