import { createDIContainer } from "../src/server/di-container";
import * as fs from "fs";
import { SubscanApi } from "../src/server/blockchain/substrate/api/subscan.api";
import { Payment } from "../src/server/data-aggregation/model/payment";
import { Token } from "../src/server/blockchain/substrate/model/token";
import { fetchPayments } from "./fetch-payments";

const createDiffSheet = (balances: { block?: number, balance: number, diff?: number }[], payments: Payment[], tolerance = 0.01, tolerance_xcm = 0.05) => {
  for (let idx = 1; idx < balances.length; idx ++) {
    balances[idx].diff = balances[idx].balance - balances[idx - 1].balance
  }
  balances.shift() // remove first element because it cannot have a 'diff'
  const diffSheet = balances.map((b) => {
    const block = b.block;
    const matchingPayments = payments.filter(
      (p) => p.block === block || Number(p.extrinsic_index.split("-")[0]) === block,
    );

    let expectedChange = 0;

    matchingPayments.forEach((p) => {
      expectedChange += -(p?.feeUsed ?? 0) - (p?.tip ?? 0);
      p.transfers.forEach((t) => {
        expectedChange += t?.amount ?? 0;
      });
    });

    const firstMatchingPayment =
      matchingPayments.length > 0 ? matchingPayments[0] : undefined;
    return {
      ...b,
      extrinsic_index: firstMatchingPayment?.extrinsic_index,
      expectedBalanceChange: expectedChange,
      deviationFromExpectation: b.diff - expectedChange,
      label: firstMatchingPayment?.label,
    };
  });

  const unexplainedChanges = diffSheet.filter(
    (s) =>
      diffSheet.indexOf(s) > 0 &&
      ((Math.abs(s.deviationFromExpectation) > tolerance &&
        s.label !== "xcm_transfer") ||
        Math.abs(s.deviationFromExpectation) > tolerance_xcm),
  );

  return { diffSheet, unexplainedChanges }
}

function fetchToken(domain: string): Promise<Token> {
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");
  return subscanApi.fetchNativeToken(domain)
}

async function getAllBalanceChanges(wallet: string, domain: string) {
  const subscanApi: SubscanApi = createDIContainer().resolve("subscanApi");
  let balanceChanges = (await subscanApi.fetchBalanceHistory(wallet, domain)) ?? [];
  return balanceChanges.sort((a,b) => a.block - b.block)
}

const veryNativeBalanceHistory = async (address: string, chain: { domain: string, label: string, token: string }, ) => {
  const token = await fetchToken(chain.domain)
  const balanceChanges = await getAllBalanceChanges(address, chain.domain)
  const { payments } = await fetchPayments(address, chain);
  const minBlock = (payments[payments.length - 1].block)
  const balanceChangesFiltered = balanceChanges.filter(b => b.block >= minBlock).map(b => {
    return {
      ...b,
      balance: Number(b.balance) / Math.pow(10, token.token_decimals)
    }
  })
  const { diffSheet, unexplainedChanges } = createDiffSheet(balanceChangesFiltered, payments, 0.01, 0.05)
  if (unexplainedChanges.length > 0) {
    console.log('NOK!')
    fs.writeFileSync(
      `./e2e-tests/out/unexplainedChanges.json`,
      JSON.stringify(unexplainedChanges, null, 2),
    );
    fs.writeFileSync(`./e2e-tests/out/diffSheet.json`, JSON.stringify(diffSheet, null, 2));
    fs.writeFileSync(`./e2e-tests/out/payments.json`, JSON.stringify(payments, null, 2));
  } else {
    console.log('OK!')
  }
}

const verifyMany = async () => {
  //await veryNativeBalanceHistory("15abVnvSgRJFCqhJuvrYSNL5DscRppcog8cyYaVALLU3LFjB", { domain: "kusama", label: "", token: "KSM" })

  // some don't match, reason unclear
  await veryNativeBalanceHistory("1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y", { domain: "polkadot", label: "", token: "DOT" }) 
  
  //await veryNativeBalanceHistory("12s37eSMQPEN5cuVyBxk2UypUHntwumqBHy7sJkoKpZ1v3HV", { domain: "polkadot", label: "", token: "DOT" })
  //await veryNativeBalanceHistory("14gEYLb4pzg3RvYS72MPRWWGAUBDdBpp9U6Wh4uMZhdQRis2", { domain: "polkadot", label: "", token: "DOT" })
}

verifyMany()