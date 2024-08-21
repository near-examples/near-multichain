import Web3 from "web3";
import { bytesToHex } from '@ethereumjs/util';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { deriveChildPublicKey, uncompressedHexPointToEvmAddress, najPublicKeyStrToUncompressedHexPoint } from './kdf';
import { Common } from '@ethereumjs/common';
import { Wallet } from "./near-wallet";
import { Address, Chain, EthereumWalletResult, PayloadAndTx } from "../components/Chain";
import { Dispatch } from "react";
import * as nearAPI from "near-api-js";
import { MPC_CONTRACT_KEY } from "../App";
import { Account } from "near-api-js";
import { FailoverRpcProvider } from "@near-js/providers";

export class Ethereum implements Chain<Buffer, FeeMarketEIP1559Transaction, EthereumWalletResult> {
  private web3: Web3;
  private chain_id: string;

  constructor(chain_rpc: string, chain_id: string) {
    this.web3 = new Web3(chain_rpc);
    this.chain_id = chain_id;
    this.queryGasPrice();
  }

  async deriveAddress(accountId, derivation_path): Promise<Address> {
    const publicKey = await deriveChildPublicKey(najPublicKeyStrToUncompressedHexPoint(), accountId, derivation_path);
    const address = uncompressedHexPointToEvmAddress(publicKey);
    return { publicKey: Buffer.from(publicKey, 'hex'), derivedEthNEAR: address };
  }

  async queryGasPrice() {
    const maxFeePerGas = await this.web3.eth.getGasPrice();
    const maxPriorityFeePerGas = await this.web3.eth.getMaxPriorityFeePerGas();
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  async getBalance(accountId: string) {
    const balance = await this.web3.eth.getBalance(accountId);
    const ONE_ETH = 1000000000000000000n;
    return Number(balance * 100n / ONE_ETH) / 100;
  }

  // payload to actually send the transaction
  async createPayload(sender, receiver, amount, data) {
    const common = new Common({ chain: this.chain_id });

    // Get the nonce & gas price
    const nonce = await this.web3.eth.getTransactionCount(sender);
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.queryGasPrice();

    // Construct transaction
    const transactionData = {
      nonce,
      gasLimit: 50_000,
      maxFeePerGas,
      maxPriorityFeePerGas,
      to: receiver,
      data: data,
      value: BigInt(this.web3.utils.toWei(amount, "ether")),
      chain: this.chain_id,
    };

    // Create a transaction
    const transaction = FeeMarketEIP1559Transaction.fromTxData(transactionData, { common });
    const payload = transaction.getHashedMessageToSign();

    // Store in sessionStorage for later
    sessionStorage.setItem('transaction', transaction.serialize());

    return { transaction, payload };
  }

  async requestSignatureToMPC(wallet: Wallet | Account, contractId: string, path: string, { payload: ethPayload, tx }: PayloadAndTx<Buffer, FeeMarketEIP1559Transaction>, sender: string): Promise<string> {
    // Ask the MPC to sign the payload
    const payload = Array.from(ethPayload.reverse());
    if (wallet instanceof Wallet) {
      const { big_r, s, recovery_id } = await wallet.callMethod({
        contractId,
        method: 'sign',
        args: {
          request: {
            payload,
            path,
            key_version: 0
          }
        },
        gas: '250000000000000',
        deposit: 1,
      });

      return await this.reconstructSignature(big_r, s, recovery_id, tx);
    } else if (wallet instanceof Account) {
      const { big_r, s, recovery_id } = wallet.functionCall({
        contractId: contractId,
        methodName: 'sign',
        args: {
          request: {
            payload,
            path,
            key_version: 0
          }
        },
        gas: BigInt('250000000000000'),
        attachedDeposit: BigInt(1),
      });

      return await this.reconstructSignature(big_r, s, recovery_id, tx);
    }
  }

  async reconstructSignature(big_r, S, recovery_id, transaction) {
    // reconstruct the signature
    console.log('reconstructSignature ??? ', big_r, S, recovery_id, transaction)
    const rHex = big_r.affine_point.slice(2); // Remove the "03" prefix

    const r = Buffer.from(rHex, 'hex');
    const s = Buffer.from(S.scalar, 'hex');
    const v = recovery_id;

    const signature = transaction.addSignature(v, r, s);

    if (signature.getValidationErrors().length > 0) throw new Error("Transaction validation errors");
    if (!signature.verifySignature()) throw new Error("Signature is not valid");
    return signature;
  }

  
  async reconstructSignatureFromLocalSession(big_r, s, recovery_id) {
    const tx = sessionStorage.getItem('transaction')
    const serialized = Uint8Array.from(JSON.parse(`[${tx}]`));
    const transaction = FeeMarketEIP1559Transaction.fromSerializedTx(serialized);
    console.log("transaction", transaction, serialized)
    return this.reconstructSignature(big_r, s, recovery_id, transaction);
  }

  // This code can be used to actually relay the transaction to the Ethereum network
  async relayTransaction(signedTransaction: FeeMarketEIP1559Transaction, setStatus: Dispatch<string>, successCb: (txHash: string, setState: Dispatch<string>) => void) {
    const serializedTx = bytesToHex(signedTransaction.serialize());
    console.log("relay transaction pub key", bytesToHex(signedTransaction.getSenderPublicKey()));

    const relayed = await this.web3.eth.sendSignedTransaction(serializedTx);
    const txHash = relayed.transactionHash;

    successCb(txHash, setStatus);
  }
}
