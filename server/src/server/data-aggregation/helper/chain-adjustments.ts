import { Payment } from "../model/payment";

export class ChainAdjustments {
  handleHydration(swaps: Payment[]) {
    swaps.forEach((s) => {
      if (s.transfers.length > 2) {
        const sold = s.transfers
          .filter((transfer) => transfer.amount < 0)
          .map((t) => t.symbol);
        const bought = s.transfers
          .filter((transfer) => transfer.amount > 0)
          .map((t) => t.symbol);
        for (const poolToken of ["2-pool", "4-pool"]) {
          if (
            (sold.includes(poolToken) && sold.length > 1) ||
            (bought.includes(poolToken) && bought.length > 1)
          ) {
            s.transfers.splice(
              s.transfers.map((t) => t.symbol).indexOf(poolToken),
              1,
            );
          }
        }
      }
    });
  }
}
