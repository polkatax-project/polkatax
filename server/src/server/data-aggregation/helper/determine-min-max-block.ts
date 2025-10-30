import { BlockTimeService } from "../../blockchain/substrate/services/block-time.service";
import { PortfolioMovement } from "../model/portfolio-movement";

export const determineMinMaxBlock = async (
  chainInfo: { domain: string; token: string },
  portfolioMovements: PortfolioMovement[],
  minDate: number,
  maxDate: number,
  blockTimeService: BlockTimeService,
): Promise<{ blockMin: number; blockMax: number }> => {
  const FIVE_MINUTES = 5 * 60 * 60 * 1000;
  // assuming ascending order by timestamp
  const minBlockInData = (portfolioMovements[0] as PortfolioMovement)?.block;
  const maxBlockInData = (
    portfolioMovements[portfolioMovements.length - 1] as PortfolioMovement
  )?.block;
  const firstPortfolioMovmenetCloseToMinDate =
    Math.abs(minDate - portfolioMovements[0].timestamp) < FIVE_MINUTES;
  const lastPortfolioMovmenetCloseToMaxDate =
    Math.abs(
      maxDate - portfolioMovements[portfolioMovements.length - 1].timestamp,
    ) < FIVE_MINUTES;

  const blockMin =
    minBlockInData > 0 && firstPortfolioMovmenetCloseToMinDate
      ? minBlockInData - 1
      : await blockTimeService.findBlock(
          chainInfo.domain,
          minDate + FIVE_MINUTES,
          FIVE_MINUTES,
        );
  const blockMax =
    maxBlockInData > 0 && lastPortfolioMovmenetCloseToMaxDate
      ? maxBlockInData
      : await blockTimeService.findBlock(
          chainInfo.domain,
          maxDate - FIVE_MINUTES,
          FIVE_MINUTES,
        );
  return { blockMin, blockMax };
};
