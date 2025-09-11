import dotenv from "dotenv";
import { envFile } from "../../src/server/env.config";
dotenv.config({ path: envFile });
import * as substrateNodesWsEndpoints from "../../res/substrate-nodes-ws-endpoints.json";
import { PolkadotApi } from "../../src/server/blockchain/substrate/api/polkadot-api";
import * as subscanChains from "../../res/gen/subscan-chains.json";
import { createDIContainer } from "../../src/server/di-container";
import { PortfolioMovementCorrectionService } from "../../src/server/data-correction/portfolio-movement-correction.service";
import * as fs from "fs";
import { PortfolioMovement } from "../../src/server/data-aggregation/model/portfolio-movement";
import { SubscanService } from "../../src/server/blockchain/substrate/api/subscan.service";
import { EventDetails, SubscanEvent } from "../../src/server/blockchain/substrate/model/subscan-event";
import { extractAddress, getPropertyValue } from "../../src/server/data-aggregation/services/special-event-processing/helper";
import { MultiLocation } from "../../src/server/blockchain/substrate/model/multi-location";
import isEqual from "lodash.isequal";
import { BalanceChange, BalancesChangesService } from "../../src/server/data-aggregation/services/balance-change.service";
import { AssetMovementReconciliationService } from "../../src/server/data-aggregation/services/asset-movement-reconciliation.service";

const validateWsEndpoints = async () => {
  const toRemove = [];
  for (const domain of Object.keys(substrateNodesWsEndpoints)) {
    const webSockets = substrateNodesWsEndpoints[domain];
    let polkadotApi: PolkadotApi;
    console.log("domain " + domain);
    if (domain === "default") {
      continue;
    }
    for (const ws of webSockets) {
      console.log("ws " + ws);
      try {
        polkadotApi = new PolkadotApi(domain);
        await polkadotApi.setApiAt(1);
        const address =
          domain === "moonbeam" || domain === "moonriver"
            ? "0x56F17ebFe6B126E9f196e7a87f74e9f026a27A1F"
            : "1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y";
        await polkadotApi.getNativeTokenBalance(address);
      } catch (err) {
        console.error(err);
        console.log(`Non-archive node removed: ${domain}-${ws}`, err.message);
        toRemove.push({ domain, ws });
      } finally {
        await polkadotApi.disconnect();
      }
    }
  }
  console.log(JSON.stringify(toRemove, null, 2));
};

const compare = () => {
  const onlyStaking = subscanChains.chains.filter(
    (c) =>
      c.stakingPallets.length > 0 &&
      !Object.keys(substrateNodesWsEndpoints).includes(c.domain),
  );
  const all = subscanChains.chains.filter((c) =>
    Object.keys(substrateNodesWsEndpoints).includes(c.domain),
  );
  const removed = subscanChains.chains.filter(
    (c) =>
      c.stakingPallets.length === 0 &&
      !Object.keys(substrateNodesWsEndpoints).includes(c.domain),
  );
  console.log(
    JSON.stringify(
      onlyStaking.map((c) => c.domain),
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      all.map((c) => c.domain),
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      removed.map((c) => c.domain),
      null,
      2,
    ),
  );
};

const fixErrors = async () => {
  const container = createDIContainer();
  const portfolioMovementCorrectionService: PortfolioMovementCorrectionService =
    container.resolve("portfolioMovementCorrectionService");
  const data = fs.readFileSync(
    "./hydration-13zGzFdxkfYzYZVBoKEtnbGWkqJNHBCm4SvkVLLB7qbEXfqc.json",
    "utf-8",
  );
  let portfolioMovments: PortfolioMovement[] = JSON.parse(data);

  const minDate = new Date("2024-12-25T00:00:00.000").getTime();
  const maxDate = new Date("2024-12-31T00:00:00.000").getTime();

  portfolioMovments = portfolioMovments.filter((p) => {
    return p.timestamp >= minDate && p.timestamp <= maxDate;
  });

  const blocks = [
    ...new Set(portfolioMovments.map((p) => [p.block, p.block - 1]).flat()),
  ];
  console.log(blocks.length);

  await portfolioMovementCorrectionService.fixErrorsAndMissingData(
    { domain: "hydration", token: "HDX" },
    "13zGzFdxkfYzYZVBoKEtnbGWkqJNHBCm4SvkVLLB7qbEXfqc",
    portfolioMovments,
    [],
    minDate,
    maxDate,
  );
};


const calculateBalancesChanges = async () => {
  const container = createDIContainer();
  const subscanService: SubscanService =
    container.resolve("subscanService");

  const minDate = new Date("2024-01-01T00:00:00.000").getTime();
  const maxDate = new Date("2024-12-31T23:59:59.999").getTime();
  const address = "1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y";

  // validate
  const data = fs.readFileSync(
    "./logs/polkadot-" + address + ".json",
    "utf-8",
  );
  const parsedData = JSON.parse(data);

  const portfolioMovements: PortfolioMovement[] = parsedData.portfolioMovements

  const events = await subscanService.searchAllEvents({
    chainName: 'polkadot',
     address, 
     module: "balances",
     minDate,
     maxDate
    })
    
  const eventDetails: EventDetails[] = await subscanService.fetchEventDetails('polkadot', events)

  fs.writeFileSync(
    "./logs/polkadot-" + address + "-event-details.json",
    JSON.stringify(eventDetails, null, 2)
  );

    const movements: Record<number, number> = {}
    for (const event of eventDetails) {
      movements[event.timestamp] = movements[event.timestamp] ?? 0
      switch (event.event_id) {
        case 'Withdraw':
        case 'Burned':
          movements[event.timestamp] -= getPropertyValue("amount", event)* Math.pow(10, -10)
          break;
        case 'Transfer':
          const to = extractAddress("to", event);
          if (to === address) {
            movements[event.timestamp] += getPropertyValue("amount", event)* Math.pow(10, -10)
          } else {
            movements[event.timestamp] -= getPropertyValue("amount", event)* Math.pow(10, -10)
          }
          break;
        case 'Deposit':
        case 'Minted':
          movements[event.timestamp] += getPropertyValue("amount", event)* Math.pow(10, -10)
          break;
      }
    }

  fs.writeFileSync(
    "./logs/polkadot-" + address + "-movements.json",
    JSON.stringify(movements, null, 2)
  );

  portfolioMovements.forEach(p => {
    const transferSum = p.transfers.reduce((sum, next) => sum + next.amount, 0)
    const otherSum = movements[p.timestamp] 
    if (transferSum - otherSum > 0) {
      console.log(`${transferSum - otherSum}, extrinsic ${p.extrinsic_index}`)
    }
  })
};



const calculatePortfolioChanges = async () => {
  const container = createDIContainer();
  const subscanService: SubscanService =
    container.resolve("subscanService");

  const minDate = new Date("2024-01-01T00:00:00.000").getTime();
  const maxDate = new Date("2024-12-31T23:59:59.999").getTime();
  const address = "1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y";
  const chain = "hydration";

  // validate
  const data = fs.readFileSync(
    "./logs/" + chain + "-" + address + "-recursive-fix.json",
    "utf-8",
  );
  const parsedData = JSON.parse(data);

  const portfolioMovements: PortfolioMovement[] = JSON.parse(data); // parsedData.portfolioMovements
  /*
  const events = await subscanService.searchAllEvents({
      chainName: chain,
     address, 
     module: "balances",
     minDate,
     maxDate
    })
    
  const eventDetails: EventDetails[] = await subscanService.fetchEventDetails(chain, events)

  fs.writeFileSync(
    "./logs/" + chain + "-" + address + "-balances-events.json",
    JSON.stringify(eventDetails, null, 2)
  );

    const movements: Record<number, number> = {}
    for (const event of eventDetails) {
      movements[event.timestamp] = movements[event.timestamp] ?? 0
      switch (event.event_id) {
        case 'Withdraw':
        case 'Burned':
          movements[event.timestamp] -= getPropertyValue("amount", event)* Math.pow(10, -10)
          break;
        case 'Transfer':
          const to = extractAddress("to", event);
          if (to === address) {
            movements[event.timestamp] += getPropertyValue("amount", event)* Math.pow(10, -10)
          } else {
            movements[event.timestamp] -= getPropertyValue("amount", event)* Math.pow(10, -10)
          }
          break;
        case 'Deposit':
        case 'Minted':
          movements[event.timestamp] += getPropertyValue("amount", event)* Math.pow(10, -10)
          break;
      }
    }
    */
/*
    const assetEvents = await subscanService.searchAllEvents({
      chainName: chain,
     address, 
     module: "assets",
     minDate,
     maxDate
    })
    const assetEventDetails: EventDetails[] = await subscanService.fetchEventDetails(chain, assetEvents)

  fs.writeFileSync(
    "./logs/" + chain + "-" + address + "-asset-events.json",
    JSON.stringify(assetEventDetails, null, 2)
  );

  const assets = await subscanService.scanAssets(chain)

    const assetMovements: Record<number, Record<string ,number>> = {}
    for (const event of assetEventDetails) {
      const assetId = getPropertyValue("asset_id", event)
      const asset = assets.find(a => a.asset_id == assetId)
      let amount = 0
      switch (event.event_id) {
        case 'Withdrawn':
          amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
          break;
        case 'Burned':
          amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
          break;
        case 'Transferred':
          const to = extractAddress("to", event);
          if (to === address) {
            amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
          } else {
            amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
          }
          break;
        case 'Deposited':
          amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
          break;
        case 'Issued':
          amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -asset.decimals)
          break;
      }
      assetMovements[event.timestamp] = assetMovements[event.timestamp] ?? {}
      assetMovements[event.timestamp][asset.unique_id] = assetMovements[event.timestamp][asset.unique_id] ?? 0
      assetMovements[event.timestamp][asset.unique_id] += amount
    }

  fs.writeFileSync(
    "./logs/" + chain + "-" + address + "-asset-movements.json",
    JSON.stringify(assetMovements, null, 2)
  );

  portfolioMovements.forEach(p => {
    Object.entries(assetMovements[p.timestamp] ?? {}).forEach(([key, value]) => {
        const asset = assets.find(a => a.unique_id === key)
        const transferSum = p.transfers.filter(t => t.asset_unique_id === key).reduce((sum, next) => sum + next.amount, 0)
        if (transferSum - value > 0) {
          console.log(`${transferSum - value}, extrinsic ${p.extrinsic_index}, token: ${key}, ${asset.symbol}`)
        }
      })
  })

*/
/*
  const foreignAssetEvents = await subscanService.searchAllEvents({
      chainName: chain,
     address, 
     module: "foreignAssets",
     minDate,
     maxDate
    })
    const foreignAssetEventDetails: EventDetails[] = await subscanService.fetchEventDetails(chain, foreignAssetEvents)

  fs.writeFileSync(
    "./logs/" + chain + "-" + address + "-foreignAsset-events.json",
    JSON.stringify(foreignAssetEventDetails, null, 2)
  );

  const foreignAssets = await subscanService.fetchForeignAssets(chain)

    const foreigAssetMovements: Record<number, Record<string ,number>> = {}
    for (const event of foreignAssetEventDetails) {
      const assetId: MultiLocation = getPropertyValue("asset_id", event)
      let foreignAsset = foreignAssets.find((a) =>
          isEqual(a.multi_location, assetId),
      );
      if (!foreignAsset && typeof assetId?.interior?.X1 === "object") {
          const assetIdAlt = {
            parents: assetId.parents,
            interior: { X1: [assetId?.interior?.X1] }
          } 
          foreignAsset = foreignAssets.find((a) =>
            isEqual(a.multi_location, assetIdAlt),
          );
      }
      let amount = 0
      switch (event.event_id) {
        case 'Withdrawn':
          amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
          break;
        case 'Burned':
          amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
          break;
        case 'Transferred':
          const to = extractAddress("to", event);
          if (to === address) {
            amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
          } else {
            amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
          }
          break;
        case 'Deposited':
          amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
          break;
        case 'Issued':
          amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -foreignAsset.decimals)
          break;
      }
      foreigAssetMovements[event.timestamp] = foreigAssetMovements[event.timestamp] ?? {}
      foreigAssetMovements[event.timestamp][foreignAsset.unique_id] = foreigAssetMovements[event.timestamp][foreignAsset.unique_id] ?? 0
      foreigAssetMovements[event.timestamp][foreignAsset.unique_id] += amount
    }

  fs.writeFileSync(
    "./logs/" + chain + "-" + address + "-foreigAsset-movements.json",
    JSON.stringify(foreigAssetMovements, null, 2)
  );

  portfolioMovements.forEach(p => {
    Object.entries(foreigAssetMovements[p.timestamp] ?? {}).forEach(([key, value]) => {
        const asset = foreignAssets.find(a => a.unique_id === key)
        const transferSum = p.transfers.filter(t => t.asset_unique_id === key).reduce((sum, next) => sum + next.amount, 0)
        if (transferSum - value > 0) {
          console.log(`${transferSum - value}, extrinsic ${p.extrinsic_index}, token: ${key}, ${asset.symbol}`)
        }
      })
  })*/


  const tokenEvents = await subscanService.searchAllEvents({
      chainName: chain,
     address, 
     module: "tokens",
     minDate,
     maxDate
    })
    const tokenEventDetails: EventDetails[] = await subscanService.fetchEventDetails(chain, tokenEvents)

  fs.writeFileSync(
    "./logs/" + chain + "-" + address + "-tokenEvents-events.json",
    JSON.stringify(tokenEventDetails, null, 2)
  );

    const tokens = await subscanService.scanTokens(chain)

    const tokenMovements: Record<number, Record<string ,number>> = {}
    const tokenMovementsExtr: Record<string, Record<string ,number>> = {}
    for (const event of tokenEventDetails) {
      const token_id = getPropertyValue("currency_id", event)
      let token = tokens.find(t => t.token_id === token_id);
      let amount = 0
      if (!token) {
        console.log("undefined!")
        continue;
      }
      switch (event.event_id) {
        case 'Withdrawn':
          amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
          break;
        case 'Transfer':
          const to = extractAddress("to", event);
          if (to === address) {
            amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
          } else {
            amount -= getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
          }
          break;
        case 'Deposited':
          amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
          break;
        case 'Endowed':
          amount += getPropertyValue(["amount", "balance"], event)* Math.pow(10, -token.decimals)
          break;
        default:
          console.warn("Unkown eventId " + event.event_id)
      }
      tokenMovements[event.timestamp] = tokenMovements[event.timestamp] ?? {}
      tokenMovements[event.timestamp][token.unique_id] = tokenMovements[event.timestamp][token.unique_id] ?? 0
      tokenMovements[event.timestamp][token.unique_id] += amount

      tokenMovementsExtr[event.extrinsic_index] = tokenMovementsExtr[event.extrinsic_index] ?? {}
      tokenMovementsExtr[event.extrinsic_index][token.unique_id] = tokenMovementsExtr[event.extrinsic_index][token.unique_id] ?? 0
      tokenMovementsExtr[event.extrinsic_index][token.unique_id] += amount
    }

  fs.writeFileSync(
    "./logs/" + chain + "-" +  address + "-token-movements.json",
    JSON.stringify(tokenMovements, null, 2)
  );

  portfolioMovements.forEach(p => {
    Object.entries(tokenMovementsExtr[p.extrinsic_index] ?? {}).forEach(([key, value]) => {
        const asset = tokens.find(a => a.unique_id === key)
        const transferSum = p.transfers.filter(t => t.asset_unique_id === key).reduce((sum, next) => sum + next.amount, 0)
        if (transferSum - value > 0) {
          console.log(`${transferSum - value}, extrinsic ${p.extrinsic_index}, token: ${key}, ${asset.symbol}`)
        }
      })
  })
};

const balanceChangeService = async () => {
  const container = createDIContainer();
  const balancesChangesService: BalancesChangesService =
    container.resolve("balancesChangesService");

  const subscanService: SubscanService =
    container.resolve("subscanService");
  const minDate = new Date("2024-01-01T00:00:00.000").getTime();
  const maxDate = new Date("2024-12-31T23:59:59.999").getTime();
  const address = "1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y";
  const chain = { domain: "assethub-polkadot", token: "DOT" }

    /// verify
  const data = fs.readFileSync(
    "./logs/" + chain.domain + "-" + address + "-recursive-fix.json",
    "utf-8",
  );
  const portfolioMovements: PortfolioMovement[] = JSON.parse(data) // parsedData.portfolioMovements

  const tokenEvents = await subscanService.searchAllEvents({
    chainName: chain.domain,
    address, 
    module: "tokens",
    minDate,
    maxDate
  })
  const balanceEvents = await subscanService.searchAllEvents({
    chainName: chain.domain,
    address, 
    module: "balances",
    minDate,
    maxDate
  })
 const assetEvents = await subscanService.searchAllEvents({
    chainName: chain.domain,
    address, 
    module: "assets",
    minDate,
    maxDate
  })
   const foreignAssetsEvents = await subscanService.searchAllEvents({
    chainName: chain.domain,
    address, 
    module: "foreignAssets", 
    minDate,
    maxDate
  })
  const changes = await balancesChangesService.fetchAllBalanceChanges(chain, address, [
    ...tokenEvents, ...balanceEvents, ...assetEvents, ...foreignAssetsEvents])
  fs.writeFileSync(
    "./logs/" + chain.domain + "-" +  address + "-changes.json",
    JSON.stringify(changes, null, 2)
  );

  portfolioMovements.forEach(p => {
    let matchingChanges = changes.find(c => c.extrinsic_index === p.extrinsic_index)!
    if (!matchingChanges) {
      matchingChanges = changes.find(c => c.block === p.block)!
    }    
    if (!matchingChanges) {
      matchingChanges = changes.find(c => c.timestamp === p.timestamp)!
    }
    if (!matchingChanges) {
      console.error("no changes for movement " + p.extrinsic_index)
    } else {
      matchingChanges.assets.forEach(change => {
          const transferSum = p.transfers.filter(t => t.asset_unique_id === change.asset_unique_id).reduce((sum, next) => sum + next.amount, 0)
          if (transferSum - change.amount !== 0) {
            console.log(`${transferSum - change.amount}, extrinsic ${p.extrinsic_index}, token: ${change.asset_unique_id}, ${change.symbol}`)
          }
      })
    }
  })

}


const reconciliate = async () => {
  const container = createDIContainer();
  const assetMovementReconciliationService: AssetMovementReconciliationService =
    container.resolve("assetMovementReconciliationService");

  const subscanService: SubscanService =
    container.resolve("subscanService");

  const address = "1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y";
  const chain = { domain: "assethub-polkadot", token: "DOT" }

    /// verify
  const data = fs.readFileSync(
    "./logs/" + chain.domain + "-" + address + ".json",
    "utf-8",
  );
  const parsed = JSON.parse(data) // parsedData.portfolioMovements
  const portfolioMovements: PortfolioMovement[] = parsed.portfolioMovements
  const unmatchedEvents: SubscanEvent[] = parsed.unmatchedEvents

  const movementData = fs.readFileSync(
    "./logs/" + chain.domain + "-" + address + "-changes.json",
    "utf-8",
  );
  const balanceChanges: BalanceChange[] = JSON.parse(movementData)

  await assetMovementReconciliationService.reconciliate(chain, address, portfolioMovements, unmatchedEvents, balanceChanges)
  fs.writeFileSync(
    "./logs/" + chain.domain + "-" +  address + "-reconciliated.json",
    JSON.stringify({portfolioMovements, unmatchedEvents}, null, 2)
  );
}

reconciliate();
