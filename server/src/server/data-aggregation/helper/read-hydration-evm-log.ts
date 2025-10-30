import { ethers } from "ethers";
import { EventDetails } from "../../blockchain/substrate/model/subscan-event";

const contract = {
  address: "0x7FA84C913bB5138Ee76740B810AA96B6d5Ac1ca5",
  abi: [
    {
      inputs: [
        {
          internalType: "contract IPoolAddressesProvider",
          name: "provider",
          type: "address",
        },
      ],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "backer",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "fee",
          type: "uint256",
        },
      ],
      name: "BackUnbacked",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "user",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "enum DataTypes.InterestRateMode",
          name: "interestRateMode",
          type: "uint8",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "borrowRate",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
      ],
      name: "Borrow",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "target",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "initiator",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "enum DataTypes.InterestRateMode",
          name: "interestRateMode",
          type: "uint8",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "premium",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
      ],
      name: "FlashLoan",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "totalDebt",
          type: "uint256",
        },
      ],
      name: "IsolationModeTotalDebtUpdated",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "collateralAsset",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "debtAsset",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "user",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "debtToCover",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "liquidatedCollateralAmount",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "address",
          name: "liquidator",
          type: "address",
        },
        {
          indexed: false,
          internalType: "bool",
          name: "receiveAToken",
          type: "bool",
        },
      ],
      name: "LiquidationCall",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "user",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
      ],
      name: "MintUnbacked",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amountMinted",
          type: "uint256",
        },
      ],
      name: "MintedToTreasury",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "user",
          type: "address",
        },
      ],
      name: "RebalanceStableBorrowRate",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "user",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "repayer",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "bool",
          name: "useATokens",
          type: "bool",
        },
      ],
      name: "Repay",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "liquidityRate",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "stableBorrowRate",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "variableBorrowRate",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "liquidityIndex",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "variableBorrowIndex",
          type: "uint256",
        },
      ],
      name: "ReserveDataUpdated",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "user",
          type: "address",
        },
      ],
      name: "ReserveUsedAsCollateralDisabled",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "user",
          type: "address",
        },
      ],
      name: "ReserveUsedAsCollateralEnabled",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "user",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
      ],
      name: "Supply",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "user",
          type: "address",
        },
        {
          indexed: false,
          internalType: "enum DataTypes.InterestRateMode",
          name: "interestRateMode",
          type: "uint8",
        },
      ],
      name: "SwapBorrowRateMode",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "user",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint8",
          name: "categoryId",
          type: "uint8",
        },
      ],
      name: "UserEModeSet",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "reserve",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "user",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "to",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
      ],
      name: "Withdraw",
      type: "event",
    },
    {
      inputs: [],
      name: "ADDRESSES_PROVIDER",
      outputs: [
        {
          internalType: "contract IPoolAddressesProvider",
          name: "",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "BRIDGE_PROTOCOL_FEE",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "FLASHLOAN_PREMIUM_TOTAL",
      outputs: [
        {
          internalType: "uint128",
          name: "",
          type: "uint128",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "FLASHLOAN_PREMIUM_TO_PROTOCOL",
      outputs: [
        {
          internalType: "uint128",
          name: "",
          type: "uint128",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "MAX_NUMBER_RESERVES",
      outputs: [
        {
          internalType: "uint16",
          name: "",
          type: "uint16",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "MAX_STABLE_RATE_BORROW_SIZE_PERCENT",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "POOL_REVISION",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "fee",
          type: "uint256",
        },
      ],
      name: "backUnbacked",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "interestRateMode",
          type: "uint256",
        },
        {
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
        {
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
      ],
      name: "borrow",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint8",
          name: "id",
          type: "uint8",
        },
        {
          components: [
            {
              internalType: "uint16",
              name: "ltv",
              type: "uint16",
            },
            {
              internalType: "uint16",
              name: "liquidationThreshold",
              type: "uint16",
            },
            {
              internalType: "uint16",
              name: "liquidationBonus",
              type: "uint16",
            },
            {
              internalType: "address",
              name: "priceSource",
              type: "address",
            },
            {
              internalType: "string",
              name: "label",
              type: "string",
            },
          ],
          internalType: "struct DataTypes.EModeCategory",
          name: "category",
          type: "tuple",
        },
      ],
      name: "configureEModeCategory",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
        {
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
      ],
      name: "deposit",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
      ],
      name: "dropReserve",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "address",
          name: "from",
          type: "address",
        },
        {
          internalType: "address",
          name: "to",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "balanceFromBefore",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "balanceToBefore",
          type: "uint256",
        },
      ],
      name: "finalizeTransfer",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "receiverAddress",
          type: "address",
        },
        {
          internalType: "address[]",
          name: "assets",
          type: "address[]",
        },
        {
          internalType: "uint256[]",
          name: "amounts",
          type: "uint256[]",
        },
        {
          internalType: "uint256[]",
          name: "interestRateModes",
          type: "uint256[]",
        },
        {
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
        {
          internalType: "bytes",
          name: "params",
          type: "bytes",
        },
        {
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
      ],
      name: "flashLoan",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "receiverAddress",
          type: "address",
        },
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "bytes",
          name: "params",
          type: "bytes",
        },
        {
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
      ],
      name: "flashLoanSimple",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
      ],
      name: "getConfiguration",
      outputs: [
        {
          components: [
            {
              internalType: "uint256",
              name: "data",
              type: "uint256",
            },
          ],
          internalType: "struct DataTypes.ReserveConfigurationMap",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint8",
          name: "id",
          type: "uint8",
        },
      ],
      name: "getEModeCategoryData",
      outputs: [
        {
          components: [
            {
              internalType: "uint16",
              name: "ltv",
              type: "uint16",
            },
            {
              internalType: "uint16",
              name: "liquidationThreshold",
              type: "uint16",
            },
            {
              internalType: "uint16",
              name: "liquidationBonus",
              type: "uint16",
            },
            {
              internalType: "address",
              name: "priceSource",
              type: "address",
            },
            {
              internalType: "string",
              name: "label",
              type: "string",
            },
          ],
          internalType: "struct DataTypes.EModeCategory",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint16",
          name: "id",
          type: "uint16",
        },
      ],
      name: "getReserveAddressById",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
      ],
      name: "getReserveData",
      outputs: [
        {
          components: [
            {
              components: [
                {
                  internalType: "uint256",
                  name: "data",
                  type: "uint256",
                },
              ],
              internalType: "struct DataTypes.ReserveConfigurationMap",
              name: "configuration",
              type: "tuple",
            },
            {
              internalType: "uint128",
              name: "liquidityIndex",
              type: "uint128",
            },
            {
              internalType: "uint128",
              name: "currentLiquidityRate",
              type: "uint128",
            },
            {
              internalType: "uint128",
              name: "variableBorrowIndex",
              type: "uint128",
            },
            {
              internalType: "uint128",
              name: "currentVariableBorrowRate",
              type: "uint128",
            },
            {
              internalType: "uint128",
              name: "currentStableBorrowRate",
              type: "uint128",
            },
            {
              internalType: "uint40",
              name: "lastUpdateTimestamp",
              type: "uint40",
            },
            {
              internalType: "uint16",
              name: "id",
              type: "uint16",
            },
            {
              internalType: "address",
              name: "aTokenAddress",
              type: "address",
            },
            {
              internalType: "address",
              name: "stableDebtTokenAddress",
              type: "address",
            },
            {
              internalType: "address",
              name: "variableDebtTokenAddress",
              type: "address",
            },
            {
              internalType: "address",
              name: "interestRateStrategyAddress",
              type: "address",
            },
            {
              internalType: "uint128",
              name: "accruedToTreasury",
              type: "uint128",
            },
            {
              internalType: "uint128",
              name: "unbacked",
              type: "uint128",
            },
            {
              internalType: "uint128",
              name: "isolationModeTotalDebt",
              type: "uint128",
            },
          ],
          internalType: "struct DataTypes.ReserveData",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
      ],
      name: "getReserveNormalizedIncome",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
      ],
      name: "getReserveNormalizedVariableDebt",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getReservesList",
      outputs: [
        {
          internalType: "address[]",
          name: "",
          type: "address[]",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "user",
          type: "address",
        },
      ],
      name: "getUserAccountData",
      outputs: [
        {
          internalType: "uint256",
          name: "totalCollateralBase",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "totalDebtBase",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "availableBorrowsBase",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "currentLiquidationThreshold",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "ltv",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "healthFactor",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "user",
          type: "address",
        },
      ],
      name: "getUserConfiguration",
      outputs: [
        {
          components: [
            {
              internalType: "uint256",
              name: "data",
              type: "uint256",
            },
          ],
          internalType: "struct DataTypes.UserConfigurationMap",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "user",
          type: "address",
        },
      ],
      name: "getUserEMode",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "address",
          name: "aTokenAddress",
          type: "address",
        },
        {
          internalType: "address",
          name: "stableDebtAddress",
          type: "address",
        },
        {
          internalType: "address",
          name: "variableDebtAddress",
          type: "address",
        },
        {
          internalType: "address",
          name: "interestRateStrategyAddress",
          type: "address",
        },
      ],
      name: "initReserve",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "contract IPoolAddressesProvider",
          name: "provider",
          type: "address",
        },
      ],
      name: "initialize",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "collateralAsset",
          type: "address",
        },
        {
          internalType: "address",
          name: "debtAsset",
          type: "address",
        },
        {
          internalType: "address",
          name: "user",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "debtToCover",
          type: "uint256",
        },
        {
          internalType: "bool",
          name: "receiveAToken",
          type: "bool",
        },
      ],
      name: "liquidationCall",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address[]",
          name: "assets",
          type: "address[]",
        },
      ],
      name: "mintToTreasury",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
        {
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
      ],
      name: "mintUnbacked",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "address",
          name: "user",
          type: "address",
        },
      ],
      name: "rebalanceStableBorrowRate",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "interestRateMode",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
      ],
      name: "repay",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "interestRateMode",
          type: "uint256",
        },
      ],
      name: "repayWithATokens",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "interestRateMode",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256",
        },
        {
          internalType: "uint8",
          name: "permitV",
          type: "uint8",
        },
        {
          internalType: "bytes32",
          name: "permitR",
          type: "bytes32",
        },
        {
          internalType: "bytes32",
          name: "permitS",
          type: "bytes32",
        },
      ],
      name: "repayWithPermit",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          internalType: "address",
          name: "to",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
      ],
      name: "rescueTokens",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
      ],
      name: "resetIsolationModeTotalDebt",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          components: [
            {
              internalType: "uint256",
              name: "data",
              type: "uint256",
            },
          ],
          internalType: "struct DataTypes.ReserveConfigurationMap",
          name: "configuration",
          type: "tuple",
        },
      ],
      name: "setConfiguration",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "address",
          name: "rateStrategyAddress",
          type: "address",
        },
      ],
      name: "setReserveInterestRateStrategyAddress",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint8",
          name: "categoryId",
          type: "uint8",
        },
      ],
      name: "setUserEMode",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "bool",
          name: "useAsCollateral",
          type: "bool",
        },
      ],
      name: "setUserUseReserveAsCollateral",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
        {
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
      ],
      name: "supply",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "onBehalfOf",
          type: "address",
        },
        {
          internalType: "uint16",
          name: "referralCode",
          type: "uint16",
        },
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256",
        },
        {
          internalType: "uint8",
          name: "permitV",
          type: "uint8",
        },
        {
          internalType: "bytes32",
          name: "permitR",
          type: "bytes32",
        },
        {
          internalType: "bytes32",
          name: "permitS",
          type: "bytes32",
        },
      ],
      name: "supplyWithPermit",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "interestRateMode",
          type: "uint256",
        },
      ],
      name: "swapBorrowRateMode",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "protocolFee",
          type: "uint256",
        },
      ],
      name: "updateBridgeProtocolFee",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint128",
          name: "flashLoanPremiumTotal",
          type: "uint128",
        },
        {
          internalType: "uint128",
          name: "flashLoanPremiumToProtocol",
          type: "uint128",
        },
      ],
      name: "updateFlashloanPremiums",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "asset",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "to",
          type: "address",
        },
      ],
      name: "withdraw",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
  ],
  transactionHash:
    "0x09497c45a662166a987f389f681ba25d79ea16968fb509a37c23d1fae12c064e",
  receipt: {
    to: null,
    from: "0x3dC06FAA422A0Cf6014847031dDc1DeC7B63F76a",
    contractAddress: "0x7FA84C913bB5138Ee76740B810AA96B6d5Ac1ca5",
    transactionIndex: 0,
    gasUsed: "7973310",
    logsBloom:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    blockHash:
      "0xfad8dc0ab9cfbeb844acd43671d75d17ff02145a1259aa58487ce0d012e8b3d4",
    transactionHash:
      "0x09497c45a662166a987f389f681ba25d79ea16968fb509a37c23d1fae12c064e",
    logs: [],
    blockNumber: 2113535,
    cumulativeGasUsed: "7973310",
    status: 1,
    byzantium: true,
  },
};

export const readHydratinEvmLog = (eventDetails: EventDetails): any => {
  const iface = new ethers.Interface(contract.abi);
  const log = eventDetails.params.find((p) => p.name === "log");
  if (!log) {
    return undefined;
  }
  const decoded = iface.parseLog(log.value);
  if (!decoded) {
    return undefined;
  }
  const result: Record<string, number | string> = {};
  result.name = decoded.name;
  for (const [i, input] of decoded.fragment.inputs.entries()) {
    const name = input.name || `[${i}]`;
    let value = decoded.args[i];
    result[name] = value;
    if (name === "reserve") {
      result["tokenId"] = parseLow4Bytes(value).decimal;
    }
  }
  return result;
};

function parseLow4Bytes(hex) {
  // Remove 0x prefix
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;

  // Ensure even length (should be 64 hex chars for 32 bytes)
  const padded = clean.padStart(64, "0");

  // Take the last 8 hex chars (4 bytes)
  const low4BytesHex = padded.slice(-8);

  // Convert to decimal
  const decimalValue = parseInt(low4BytesHex, 16);

  return {
    hex: "0x" + low4BytesHex,
    decimal: decimalValue,
  };
}
