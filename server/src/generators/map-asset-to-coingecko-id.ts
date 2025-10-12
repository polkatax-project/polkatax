import { envFile } from "../../src/server/env.config";
import dotenv from "dotenv";
dotenv.config({ path: envFile });
import stringSimilarity from "string-similarity";
import * as coingeckoTokens from "../../res/coingecko-tokens.json";
import { createDIContainer } from "../server/di-container";
import { SubscanService } from "../server/blockchain/substrate/api/subscan.service";
import * as fs from "fs";

type Asset = {
  name: string;
  symbol: string;
};

type CoinGeckoCoin = {
  id: string;
  name: string;
  symbol: string;
};

type MatchResult = {
  coingeckoId: string;
  coingeckoName: string;
  coingeckoSymbol: string;
  confidence: number;
};

/**
 * Normalize a string for fuzzy comparison
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // remove spaces, punctuation, hyphens, etc.
    .trim();
}

/**
 * Compute a weighted similarity score between an asset and a CoinGecko coin.
 */
function computeScore(asset: Asset, coin: CoinGeckoCoin): number {
  const symA = normalize(asset.symbol);
  const symB = normalize(coin.symbol);
  const nameA = normalize(asset.name);
  const nameB = normalize(coin.name);

  const symbolScore = stringSimilarity.compareTwoStrings(symA, symB);
  const nameScore = stringSimilarity.compareTwoStrings(nameA, nameB);

  // Weighted average: symbol match more important than name

  return asset.name ? 0.7 * symbolScore + 0.3 * nameScore : symbolScore;
}

/**
 * Find the best CoinGecko match for an on-chain asset.
 *
 * @param asset - { name, symbol }
 * @param threshold - Minimum confidence score required for a match (default: 0.75)
 */
export function findBestCoinGeckoMatch(
  asset: Asset,
  threshold = 0.75,
): MatchResult {
  let best: CoinGeckoCoin | null = null;
  let bestScore = 0;

  for (const coin of coingeckoTokens.tokens) {
    const score = computeScore(asset, coin);
    if (score > bestScore) {
      bestScore = score;
      best = coin;
    }
  }

  if (!best || bestScore < threshold) return null;

  return {
    coingeckoId: best.id,
    coingeckoName: best.name,
    coingeckoSymbol: best.symbol,
    confidence: parseFloat(bestScore.toFixed(3)),
  };
}

const mapCoins = async (chain: string) => {
  const mappings: any[] = fs.existsSync(
    "./res/gen/" + chain + "-coingecko-mappings.json",
  )
    ? JSON.parse(
        fs.readFileSync(
          "./res/gen/" + chain + "-coingecko-mappings.json",
          "utf-8",
        ),
      ).mappings
    : [];
  const subscanService: SubscanService =
    createDIContainer().resolve("subscanService");
  const assets = await subscanService.scanTokensAndAssets(chain);
  const results = assets
    .map((a) => {
      let symbol = a.symbol;
      if (symbol.startsWith("xc") && symbol.length >= 4) {
        symbol = symbol.slice(2);
      }
      const match = findBestCoinGeckoMatch({
        symbol: symbol,
        name: a.name ?? a?.metadata?.name,
      });
      return {
        symbol: a.symbol,
        name: a.name ?? a?.metadata?.name,
        transferCount: a.transfer_count,
        uniqueId: a.unique_id,
        coingeckoId: match?.coingeckoId,
        coingeckoName: match?.coingeckoName,
        coingeckoSymbol: match?.coingeckoSymbol,
        confidence: match?.confidence,
      };
    })
    .filter((t) => t.transferCount > 0 && t.coingeckoId);
  results.forEach((r) => {
    if (!mappings.find((m) => m.uniqueId === r.uniqueId)) {
      mappings.push(r);
    }
  });
  fs.writeFileSync(
    "./res/gen/" + chain + "-coingecko-mappings.json",
    JSON.stringify({ mappings: mappings }, null, 2),
  );
};

const mapAll = async () => {
  for (let chain of [
    "astar",
    "basilisk",
    "bifrost",
    "bifrost-kusama",
    "acala",
    "karura",
    "manta",
    "assethub-polkadot",
    "assethub-kusama",
  ]) {
    await mapCoins(chain);
  }
};
mapAll();
