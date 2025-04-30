import { contracts } from "chainsig.js";

export const RPCforChain = {
    'base': "https://base-sepolia.drpc.org",
    'eth': "https://sepolia.drpc.org"
}

export const explorerForChain = {
    'base': "https://base-sepolia.blockscout.com/tx/",
    'eth': "https://sepolia.etherscan.io/tx/"
}

export const NetworkId = 'testnet';
export const MPC_CONTRACT = 'v1.signer-prod.testnet'
export const MPC_KEY = 'secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3';

export const SIGNET_CONTRACT = new contracts.near.ChainSignatureContract({
  networkId: NetworkId,
  contractId: MPC_CONTRACT,
  accountId: '',
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
