import { startStub as cryptoPricesStub } from "../src/crypto-currency-prices/stub";
import { PaymentsService } from "../src/server/data-aggregation/services/substrate-payments.service";
import { createDIContainer } from "../src/server/di-container";

export const fetchPayments = async (address: string, 
    chain: { domain: string, label: string, token: string }) => {
  const cryptoPriceServer = await cryptoPricesStub();
  const container = createDIContainer();
  try {
    const currency = "usd";
    const paymentsService: PaymentsService = container.resolve("paymentsService");
    const { payments, unmatchedEvents } = await paymentsService.fetchPaymentsTxAndEvents({
      chain,
      address,
      currency,
      minDate: new Date(Date.UTC(new Date().getFullYear() - 1, 0, 1)).getTime(), // new Date(Date.UTC(2025, 4, 1)).getTime(), // 
    });
    if (payments.length === 0) {
      return { payments: [] }
    }
    const subscanApi = container.resolve("subscanApi")
    const minBlock = (await subscanApi.fetchExtrinsic(chain.domain, payments[payments.length - 1].extrinsic_index)).block
    const maxBlock = (await subscanApi.fetchExtrinsic(chain.domain, payments[0].extrinsic_index)).block

    return { payments, unmatchedEvents, minBlock, maxBlock }
  } finally {
    await cryptoPriceServer.close();
  }
};