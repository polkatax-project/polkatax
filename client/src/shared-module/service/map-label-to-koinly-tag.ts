import { KoinlyTag } from '../model/koinly-tag';
import { Label } from '../model/label';

export const labelToKoinlyTag: Record<Label, KoinlyTag> = {
  'EVM Transaction': undefined, // generic transfer, cannot be tagged
  'Farming deposit': undefined,
  'Farming withdraw': undefined,
  'Liquidity removed': undefined, // applied automatically, cannot tag manually
  'Liquidity added': undefined, // applied automatically, cannot tag manually
  Swap: undefined, // Swap is used for token migration only! https://support.koinly.io/en/articles/9490023-what-are-tags
  'Crowdloan contribution': 'Add to Pool', // https://intercom.help/koinly/en/articles/9490056-staking-and-farming-tokens
  'Liquid staking token minted': 'Swap', // https://intercom.help/koinly/en/articles/9490056-staking-and-farming-tokens
  'Liquid staking token redeemed': undefined, // https://intercom.help/koinly/en/articles/9490056-staking-and-farming-tokens
  'Liquid staking token redeem success': undefined,
  'Liquid staking token rebonded': undefined,
  'XCM transfer': undefined, // treated as transfer, no tag
  'Treasury grant': 'Income', // akin to salary/income
  Reward: 'Reward',
  'Staking reward': 'Reward',
  'Staking slashed': 'Cost', // treated as expense/loss
  Fee: 'Cost',
  'Existential deposit paid': 'Cost', // treated as expense/loss
  'Coretime purchase': 'Cost', // business-like expenditure
  'Remove from Pool': 'Remove from Pool',
  'Migrated delegation': undefined,
  'Reserve repatriated': 'Income', // returned funds -> income
  Stake: undefined,
  Unstake: undefined,
};

export const mapLabelToKoinlyTag = (
  label: Label | undefined
): KoinlyTag | undefined => {
  if (label === undefined) {
    return undefined;
  }
  return labelToKoinlyTag[label];
};
