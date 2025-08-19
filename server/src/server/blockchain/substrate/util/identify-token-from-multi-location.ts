import * as subscanChains from "../../../../../res/gen/subscan-chains.json";
import * as otherSubstrateChains from "../../../../../res/other-substrate-chains.json";
import { MultiLocation } from "../model/multi-location";

export type TokenInfo =
  | {
      type: "native";
      chain: string | undefined;
      symbol: string | undefined;
      address?: string;
    }
  | {
      type: "parachain_asset";
      chain: string | undefined;
      generalIndex?: number;
      address?: string; // only used on moonbeam?
    }
  | {
      type: "ethereum_asset";
      chain: "Ethereum";
      address?: string; // undefined => ETH
    }
  | {
      type: "unknown";
      chain: string | undefined;
    };

// Try to resolve a chain info by paraId.
// Returns {chain, symbol} or undefined if not found.
function lookupParachainByParaId(
  paraId: number,
): { chain: string; symbol: string } | undefined {
  const hit =
    subscanChains.chains.find((c) => c.paraId === paraId) ||
    otherSubstrateChains.chains.find((c) => c.paraId === paraId);
  if (hit) return { chain: hit.domain, symbol: hit.token };
  return undefined;
}

// Try to resolve a chain’s native symbol by *name* (domain).
function lookupNativeByChainName(
  name: string,
): { chain: string; symbol: string } | undefined {
  const norm = (s: string) => s.toLowerCase();
  const hitByName =
    subscanChains.chains.find((c) => norm(c.domain) === norm(name)) ||
    otherSubstrateChains.chains.find((c) => norm(c.domain) === norm(name));

  if (hitByName) return { chain: hitByName.domain, symbol: hitByName.token };
  // Fallback for eth
  if (name.toLocaleLowerCase() === "ethereum")
    return { chain: name, symbol: "ETH" };
  if (name.toLocaleLowerCase() === "solana")
    return { chain: name, symbol: "SOL" };
  return undefined;
}

// Resolve the chain you end up at by "going up" `parents` levels from fromChain.
// parents: 0 => fromChain; 1 => relayChain; >=2 => unknown (unless later re-specified).
function ascendChain(
  fromChain: string,
  relayChain: string,
  parents: number,
): string | undefined {
  if (parents <= 0) return fromChain;
  if (parents === 1) return relayChain;
  // parents >= 2 means "above" the relay consensus; let future junctions re-specify (e.g., GlobalConsensus)
  return undefined;
}

// A structured junction representation
type J =
  | { kind: "Parachain"; value: number }
  | { kind: "GlobalConsensus"; value: string }
  | { kind: "PalletInstance"; value: number }
  | { kind: "GeneralIndex"; value: number }
  | { kind: "AccountKey20"; value: string }
  | { kind: "AccountId32"; value: string }
  | { kind: "GeneralKey"; value: string }
  | { kind: "Here" };

export function isMultiLocation(data: any) {
  return data.hasOwnProperty("parents") && data.hasOwnProperty("interior");
}

// Recursively flatten all junctions from `interior` (supports X1/X2/X3, nesting, or direct keys)
function flattenJunctions(root?: any): J[] {
  const out: J[] = [];

  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;

    // Recognize known junctions on this object
    if ("Parachain" in node)
      out.push({ kind: "Parachain", value: Number(node.Parachain) });
    if ("GlobalConsensus" in node && typeof node.GlobalConsensus === "object") {
      const k = Object.keys(node.GlobalConsensus)[0];
      if (k) out.push({ kind: "GlobalConsensus", value: k });
    }
    if ("PalletInstance" in node)
      out.push({ kind: "PalletInstance", value: Number(node.PalletInstance) });
    if ("Pallet" in node)
      out.push({ kind: "PalletInstance", value: Number(node.Pallet) });
    if ("GeneralIndex" in node)
      out.push({ kind: "GeneralIndex", value: Number(node.GeneralIndex) });
    if ("AccountKey20" in node && node.AccountKey20?.key)
      out.push({ kind: "AccountKey20", value: String(node.AccountKey20.key) });
    if ("AccountId32" in node && node.AccountId32?.id)
      out.push({ kind: "AccountId32", value: String(node.AccountId32.id) });
    if ("GeneralKey" in node)
      out.push({ kind: "GeneralKey", value: String(node.GeneralKey) });
    if ("Here" in node) out.push({ kind: "Here" });

    // Recurse into ALL child values (arrays or objects), not just Xn
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (v && typeof v === "object") {
        if (Array.isArray(v)) v.forEach(visit);
        else visit(v);
      }
    }
  };

  visit(root);
  return out;
}

export function identifyTokenFromMultiLocation(
  referenceChain: string, // relay chain if UMP, origin parachain if HRMP/XCMP
  multiLocation: MultiLocation,
): TokenInfo {
  const relayChain =
    subscanChains.chains.find((c) => c.domain === referenceChain)?.relay ??
    otherSubstrateChains.chains.find((c) => c.domain === referenceChain)?.relay;
  const parents = multiLocation.parents ?? 0;
  const junctions = flattenJunctions(multiLocation.interior);

  const first = <K extends J["kind"]>(k: K) =>
    junctions.find((j) => j.kind === k) as Extract<J, { kind: K }> | undefined;

  // Step 1: Resolve the *true origin chain* using parents
  const originChain = ascendChain(referenceChain, relayChain, parents);

  // 1) GlobalConsensus takes precedence
  const gc = first("GlobalConsensus");
  if (gc) {
    if (gc.value === "Ethereum") {
      const erc = first("AccountKey20");
      return { type: "ethereum_asset", chain: "Ethereum", address: erc?.value };
    }
    const chainInfo = lookupNativeByChainName(gc.value);
    if (chainInfo) {
      return {
        type: "native",
        chain: chainInfo.chain,
        symbol: chainInfo.symbol,
      };
    }
    return { type: "native", chain: gc.value, symbol: gc.value.toUpperCase() };
  }

  // 2) "Here" relative to the resolved origin
  if (junctions.some((j) => j.kind === "Here")) {
    const resolved = lookupNativeByChainName(originChain);
    return {
      type: "native",
      chain: resolved?.chain ?? originChain,
      symbol: resolved?.symbol,
    };
  }

  // 3) Parachain / asset rules
  const para = first("Parachain");
  const pallet = first("PalletInstance");
  const gidx = first("GeneralIndex");
  const a20 = first("AccountKey20");

  // 3a) Parachain asset by GeneralIndex
  if (para && gidx) {
    const hit = lookupParachainByParaId(para.value);
    return {
      type: "parachain_asset",
      chain: hit?.chain ?? `Parachain-${para.value}`,
      generalIndex: gidx.value,
    };
  }

  // 3b) Parachain asset by AccountKey20
  if (para && a20) {
    const hit = lookupParachainByParaId(para.value);
    return {
      type: "parachain_asset",
      chain: hit?.chain ?? `Parachain-${para.value}`,
      address: a20.value,
    };
  }

  // 3c) Parachain native: Parachain + PalletInstance
  if (para && pallet && !gidx && !a20) {
    const hit = lookupParachainByParaId(para.value);
    return {
      type: "native",
      chain: hit?.chain ?? `Parachain-${para.value}`,
      symbol: hit?.symbol,
    };
  }

  // 3d) PalletInstance only => native of originChain
  if (pallet && !para && !gidx && !a20) {
    const resolved = lookupNativeByChainName(originChain);
    return {
      type: "native",
      chain: resolved?.chain ?? originChain,
      symbol: resolved?.symbol,
    };
  }

  // 3e) Parachain only => native of that parachain
  if (para && !gidx && !pallet && !a20) {
    const hit = lookupParachainByParaId(para.value);
    return {
      type: "native",
      chain: hit?.chain ?? `Parachain-${para.value}`,
      symbol: hit?.symbol,
    };
  }

  // 4) Bare GeneralIndex => asset on originChain
  if (gidx && !para) {
    return {
      type: "parachain_asset",
      chain: originChain,
      generalIndex: gidx.value,
    };
  }

  // 5) Fallback: relay chain native if parents == 1 and no para
  if (!para && parents === 1) {
    const resolved = lookupNativeByChainName(relayChain);
    return {
      type: "native",
      chain: resolved?.chain ?? relayChain,
      symbol: resolved?.symbol,
    };
  }

  // 6) Fallback: originChain native if parents:0 and no junctions
  if (parents === 0 && junctions.length === 0) {
    const resolved = lookupNativeByChainName(originChain);
    return {
      type: "native",
      chain: resolved?.chain ?? originChain,
      symbol: resolved?.symbol,
    };
  }

  // 7) Unknown
  return { type: "unknown", chain: originChain };
}
