import { Common } from "@ethereumjs/common";
import { FeeMarketEIP1559Transaction } from "@ethereumjs/tx";
import { Account, Connection, Contract } from "@near-js/accounts";
import { KeyPair } from "@near-js/crypto";
import { InMemoryKeyStore } from "@near-js/keystores";
import { ethers, providers } from "ethers";
import { deriveChildPublicKey, najPublicKeyStrToUncompressedHexPoint, uncompressedHexPointToEvmAddress } from "./kdf";

const testnetAccountId = "influencer.testnet";
const privateKey = "ed25519:GbKyzirGrd3me3ppFJscxkkigPMWtiteGrAYkncPvi7Ucg6SfECbVvtzfsToabe4CNKRvo4K6JXTkiQ5Ea3PL45"
const multichainContract = "multichain-testnet-2.testnet";
const derivationPath = "test";
const ethReceiverAddress = "0x47bF16C0e80aacFf796E621AdFacbFaaf73a94A4";
const providerUrl = 'https://rpc2.sepolia.org'

const canRederiveEthAddress = async () => {
  const nearConnection = await getNearConnection();
  const testnetAccount = new Account(nearConnection, testnetAccountId);
  const multichainContractAcc = new Contract(
    testnetAccount,
    multichainContract,
    {
      changeMethods: ['sign'],
      viewMethods: ['public_key'],
      useLocalViewExecution: false
    }
  );

  const rootPublicKey = await multichainContractAcc.public_key();
  const publicKey = await deriveChildPublicKey(najPublicKeyStrToUncompressedHexPoint(rootPublicKey), testnetAccountId, derivationPath);
  const derivedEthAddress = uncompressedHexPointToEvmAddress(publicKey);

  const common = new Common({ chain: 'sepolia' });
  const provider = new providers.JsonRpcProvider(
    providerUrl
  );
  const feeData = 1 //await provider.getFeeData();
  const txData = {
    to: ethReceiverAddress,
    value: 1,
    chainId: common.chainId(),
    gasLimit: 21000,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    nonce: await provider.getTransactionCount(derivedEthAddress)
  };
  const ethTransaction = FeeMarketEIP1559Transaction.fromTxData(txData, {
    common
  });

  const [R, s] = await multichainContractAcc.sign({
    args: {
      payload: Array.from(new Uint8Array(ethTransaction.getHashedMessageToSign().slice().reverse())),
      path: derivationPath
    },
    gas: '300000000000000'
  });
  const r = Buffer.from(R.substring(2), 'hex');
  const unsignedTransaction = FeeMarketEIP1559Transaction.fromTxData(txData, { common });

  const rederivedEthAdresses = [0, 1].map(v => unsignedTransaction.addSignature(BigInt(v), r, Buffer.from(s, 'hex')).getSenderAddress().toString());
  const rederivedEthAddress = rederivedEthAdresses.find(address => address === derivedEthAddress);
  if (rederivedEthAddress) {
    console.log('Eth address rederived successfully: ' + rederivedEthAddress);
    return true;
  }
  console.log('Eth address rederivation failed');
  return false;
}


const getNearConnection = async () => {
  const keyStore = new InMemoryKeyStore();
  await keyStore.setKey(
    "testnet",
    testnetAccountId,
    KeyPair.fromString(privateKey)
  );
  return Connection.fromConfig({
    networkId: 'testnet',
    provider: { type: 'JsonRpcProvider', args: { url: "https://rpc.testnet.near.org" } },
    signer: { type: 'InMemorySigner', keyStore },
  });
}

canRederiveEthAddress().then(console.log);