import {
  startStubs,
  stopStubs,
} from "../shared/helper/fetch-portfolio-movements";
import { waitForPortToBeFree } from "../shared/helper/wait-for-port-to-be-free";
import { verifyPortfolioChanges } from "../shared/helper/verify-portfolio-changes";
import { getVerifyableChains } from "../shared/helper/get-verifyable-chains";

const verifyWallets = async (wallets: string[]) => {
  const maxDate = new Date();
  const minDate = new Date("2024-01-01T00:00:000Z");
  maxDate.setDate(maxDate.getDate() - 30);

  for (let wallet of wallets) {
    const chains = getVerifyableChains(wallet);
    for (let chain of chains) {
      console.log(`Evaluating ${wallet} and ${chain.domain}`);
      try {
        await verifyPortfolioChanges(
          wallet,
          chain,
          minDate.getTime(),
          Date.now(),
        );
      } catch (error) {
        throw new Error(
          `Error evaluating ${wallet} and ${chain.domain}`,
          error,
        );
      }
    }
  }
};

const verifyPortfolioChangesOfTestWallets = async () => {
  console.log("🚀 Starting e2e test...");
  await startStubs();
  try {
    const addresses = [
      "16mrcAndMguy3wqfuLNubgxxeyWQHjYAdqRbj26Vb2gYtszK",
      "1HGnvAkk9nbfZ58CzUJhjcrLdEDMkr5qNkqqYkyD5BF5v6Y",
      "12YCxZBQVxvbcdRW66JTJ8ppEYg7JxXNCYqme3dMWKJJVdtf",
    ];
    await verifyWallets(addresses);
    console.log(`✅ e2e test completed`);
  } finally {
    await stopStubs();
    await waitForPortToBeFree(3003);
    await waitForPortToBeFree(3002);
  }
};
verifyPortfolioChangesOfTestWallets();
