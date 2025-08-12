import { Asset } from "../../../blockchain/substrate/model/asset";
import { EventDetails } from "../../../blockchain/substrate/model/subscan-event";
import { EventDerivedTransfer } from "../../model/event-derived-transfer";
import { mapKeyToCanonicalAddress } from "./helper";
import { toTransfer } from "./to-transfer";

export const extractZenLinkValues = async (
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<{
  address: string;
  assets: Asset[];
  amounts: number[];
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

  const assets = assetIndices
    .map((a) => tokens.find((t) => t.asset_id === String(a)))
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

  const amounts = balances.map(
    (b, idx) => Number(b) / Math.pow(10, assets[idx]?.decimals),
  );
  return {
    address,
    assets,
    amounts,
  };
};

export const onZenlinkProtcolAssetSwap = async (
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<EventDerivedTransfer[]> => {
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
  const transfers = [];
  if (assets[0].asset_id !== "0") {
    transfers.push(toTransfer(event, address, "", amounts[0], assets[0]));
  }
  if (assets[1].asset_id !== "0") {
    transfers.push(toTransfer(event, "", address, amounts[1], assets[1]));
  }
  if (assets.length === 3) {
    if (assets[2].asset_id !== "0") {
      transfers.push(toTransfer(event, "", address, amounts[2], assets[2]));
    }
  }
  return transfers;
};

export const onZenlinkProtcolLiquidityRemoved = async (
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<EventDerivedTransfer[]> => {
  const { address, assets, amounts } = await extractZenLinkValues(event, {
    tokens,
  });

  return assets
    .filter((a) => a.asset_id !== "0")
    .map((_, idx) =>
      toTransfer(
        event,
        "",
        address,
        amounts[idx],
        assets[idx],
        undefined,
        "Liquidity removed",
      ),
    );
};

export const onZenlinkProtcolLiquidityAdded = async (
  event: EventDetails,
  { tokens }: { tokens: Asset[] },
): Promise<EventDerivedTransfer[]> => {
  const { address, assets, amounts } = await extractZenLinkValues(event, {
    tokens,
  });

  return assets
    .filter((a) => a.asset_id !== "0")
    .map((_, idx) =>
      toTransfer(
        event,
        address,
        "",
        amounts[idx],
        assets[idx],
        undefined,
        "Liquidity added",
      ),
    );
};
