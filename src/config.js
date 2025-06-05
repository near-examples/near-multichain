import { contracts } from "chainsig.js";

// export const RPCforChain = {
//     'base': "https://base-sepolia.drpc.org",
//     'eth': "https://sepolia.drpc.org"
// }

// export const explorerForChain = {
//     'base': "https://base-sepolia.blockscout.com/tx/",
//     'eth': "https://sepolia.etherscan.io/tx/"
// }

export const NetworksEVM = [
  {
    "network": "Ethereum",
    "token": "ETH",
    "rpcUrl": "https://sepolia.drpc.org",
    "explorerUrl": "https://sepolia.etherscan.io/tx/",
    "contractAddress": "0x"
  },
  {
    "network": "Base",
    "token": "BASE",
    "rpcUrl": "https://base-sepolia.drpc.org",
    "explorerUrl": "https://base-sepolia.blockscout.com/tx/",
    "contractAddress": "0x"
  },
  {
    // https://revoke.cash/es/learn/wallets/add-network/bnb-chain-testnet
    "network": "BNB Chain",
    "token": "BNB",
    "rpcUrl": "https://data-seed-prebsc-1-s1.binance.org:8545/",
    "explorerUrl": "https://testnet.bscscan.com/",
    "contractAddress": "0x"
  },
  {
    "network": "Avalanche",
    "token": "AVAX",
    "rpcUrl": "https://api.avax-test.network/ext/bc/C/rpc",
    "explorerUrl": "https://testnet.snowtrace.io/",
    "contractAddress": "0x"
  },
  {
    "network": "Polygon",
    "token": "POL",
    "rpcUrl": "https://rpc-amoy.polygon.technology",
    "explorerUrl": "https://amoy.polygonscan.com",
    "contractAddress": "0x"
  },
  {
    "network": "Arbitrum",
    "token": "ARB",
    "rpcUrl": "https://arbitrum-goerli.infura.io/v3/9aa3d645ea0e47f4456a556ef2a3c154",
    "explorerUrl": "https://goerli.arbiscan.io/",
    "contractAddress": "0x"
  },
  // {
  //   "network": "zkSync",
  //   "token": "ETHZK",
  //   "rpcUrl": "https://zksync2-testnet.zkscan.io/api",
  //   "explorerUrl": "https://zksync2-testnet.zkscan.io/",
  //   "contractAddress": "0x"
  // },
  // {
  //   "network": "Berachain",
  //   "token": "BERA",
  //   "rpcUrl": "https://devnet.bsc.tbd.website:8545",
  //   "explorerUrl": "https://explorer.devnet.berachain.com/",
  //   "contractAddress": "0x"
  // },
  {
    "network": "Linea",
    "token": "LINEA",
    "rpcUrl": "https://rpc.sepolia.linea.build",
    "explorerUrl": "https://sepolia.lineascan.build/",
    "contractAddress": "0x"
  },
  // {
  //   "network": "Unichain",
  //   "token": "UNI",
  //   "rpcUrl": "https://eth-sepolia.blockscout.com/",
  //   "explorerUrl": "https://sepolia.uniscan.xyz/",
  //   "contractAddress": "0x"
  // },
  {
    "network": "Aurora",
    "token": "AURORA",
    "rpcUrl": "https://testnet.aurora.dev",
    "explorerUrl": "https://explorer.testnet.aurora.dev",
    "contractAddress": "0x"
  }
]

export const NetworkId = 'testnet';
export const MPC_CONTRACT = 'v1.signer-prod.testnet'
export const MPC_KEY = 'secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3';

export const SIGNET_CONTRACT = new contracts.ChainSignatureContract({
  networkId: NetworkId,
  contractId: MPC_CONTRACT,
})

export const ABI = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_num",
        type: "uint256",
      },
    ],
    name: "set",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "get",
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
    name: "num",
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
];
