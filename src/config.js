import { contracts } from "chainsig.js";

export const NetworksEVM = [
  {
    network: "Ethereum",
    token: "ETH",
    rpcUrl: "https://sepolia.drpc.org",
    explorerUrl: "https://sepolia.etherscan.io/tx/",
    contractAddress: "0xFf3171733b73Cfd5A72ec28b9f2011Dc689378c6",
  },
  {
    network: "Base",
    token: "BASE",
    rpcUrl: "https://base-sepolia.drpc.org",
    explorerUrl: "https://base-sepolia.blockscout.com/tx/",
    contractAddress: "0x2d5B67280267309D259054BB3214f74e42c8a98c",
  },
  {
    network: "BNB Chain",
    token: "BNB",
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545/",
    explorerUrl: "https://testnet.bscscan.com/tx/",
    contractAddress: "0xf1A94B7Dfc407527722c91434c35c894287d1e52",
  },
  {
    network: "Avalanche",
    token: "AVAX",
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    explorerUrl: "https://subnets-test.avax.network/c-chain/tx/",
    contractAddress: "0x03a74694bD865437eb4f83c5ed61D22000A9f502",
  },
  {
    network: "Polygon",
    token: "POL",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    explorerUrl: "https://www.oklink.com/es-la/amoy/tx/",
    contractAddress: "0x03a74694bD865437eb4f83c5ed61D22000A9f502",
  },
  {
    network: "Arbitrum",
    token: "ARB",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorerUrl: "https://sepolia.arbiscan.io/tx/",
    contractAddress: "0x03a74694bD865437eb4f83c5ed61D22000A9f502",
  },
];

export const NetworkId = "testnet";
export const MPC_CONTRACT = "v1.signer-prod.testnet";
export const MPC_KEY =
  "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3";

export const SIGNET_CONTRACT = new contracts.ChainSignatureContract({
  networkId: NetworkId,
  contractId: MPC_CONTRACT,
});

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

export const CHAIN_ICONS = {
  ETH: "ethereum",
  BASE: "base",
  BNB: "binance",
  AVAX: "avalanche",
  POL: "polygon",
  ARB: "arbitrum",
  BTC: "bitcoin",
  SOL: "solana",
  SUI: "sui",
  APT: "aptos",
  XRP: "xrp",
};
