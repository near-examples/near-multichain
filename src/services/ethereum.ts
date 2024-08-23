import {Web3} from "web3"
import {bigIntMax, bytesToHex} from '@ethereumjs/util';
import {FeeMarketEIP1559Transaction, LegacyTransaction} from '@ethereumjs/tx';
import {
  deriveChildPublicKey, najPublicKeyStrToUncompressedHexPoint,
  uncompressedHexPointToEvmAddress
} from './kdf';
import {Common} from '@ethereumjs/common'
import {Wallet} from "./near-wallet";
import {Address, Chain, EthereumWalletResult, PayloadAndTx} from "../components/Chain";
import {Dispatch} from "react";
import * as nearAPI from "near-api-js";
import {MPC_CONTRACT_KEY} from "../App";
import {c} from "vite/dist/node/types.d-aGj9QkWt";
import {Account} from "near-api-js";
import {FailoverRpcProvider} from "@near-js/providers"
import secp256k1 from 'secp256k1';
import {keccak256} from "viem";
import {recoverPublicKey} from "../components/Chain";


export class Ethereum implements Chain<Buffer, FeeMarketEIP1559Transaction, EthereumWalletResult> {
  private web3: Web3
  private chain_id: string;

  constructor(chain_rpc: string, chain_id) {
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
    const balance = await this.web3.eth.getBalance(accountId)
    const ONE_ETH = 1000000000000000000n;
    return Number(balance * 100n / ONE_ETH) / 100;
  }

  // payload to actually send the transasction
  async createPayload(sender, receiver, amount): Promise<PayloadAndTx<Buffer, FeeMarketEIP1559Transaction>> {
    const common = new Common({ chain: this.chain_id });

    // Get the nonce & gas price
    // const nonce = await this.web3.eth.getTransactionCount(sender);
    const nonce = 1000;
    // const { maxFeePerGas, maxPriorityFeePerGas } = await this.queryGasPrice();
    const maxFeePerGas = BigInt(1);
    const maxPriorityFeePerGas = BigInt(1);
    // const { maxFeePerGas, maxPriorityFeePerGas } = {maxFeePerGas, maxFeePerGas};

    // Construct transaction
    const transactionData = {
      nonce,
      gasLimit: 35000,
      maxFeePerGas,
      maxPriorityFeePerGas,
      to: receiver,
      value: BigInt(this.web3.utils.toWei(amount, "ether")),
      chain: this.chain_id,
    };

    console.log("transaction data", transactionData);

    const tx = FeeMarketEIP1559Transaction.fromTxData(transactionData, {common});
    // Return the message hash
    return {
      payload: Buffer.from(tx.getHashedMessageToSign()),
      tx: tx,
    };
  }

  async requestSignatureToMPC(wallet: Wallet | Account, contractId: string, path: string, {payload: ethPayload, tx}: PayloadAndTx<Buffer, FeeMarketEIP1559Transaction>, sender: string): Promise<string> {
    // Ask the MPC to sign the payload
    const payload = Array.from(ethPayload.reverse());
    if (wallet instanceof Wallet) {
      const {big_r, s, recovery_id} = await wallet.callMethod({
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

      // const [big_r, big_s] = await wallet.callMethod({ contractId, method: 'sign', args: { payload, path, key_version: 0 }, gas: '250000000000000' });
      return await this.reconstructSignature({big_r, s, recovery_id}, tx)
    } else if (wallet instanceof Account) {
      const {big_r, s, recovery_id} = wallet.functionCall({
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
      })

      return await this.reconstructSignature({big_r, s, recovery_id}, tx)
    }
  }

  // async reconstructSignature(big_r, S, recovery_id, transaction) {
  async reconstructSignature(walletArgs, transaction: LegacyTransaction): Promise<string> {
    try {
      const e: EthereumWalletResult = walletArgs;

      // reconstruct the signature
      const r = Buffer.from(e.big_r.affine_point.substring(2), 'hex');
      const s = Buffer.from(e.s.scalar, 'hex');
      const v = e.recovery_id;

      const signature = transaction.addSignature(v, r, s);
      const recoveredPk = recoverPublicKey(keccak256(transaction.getHashedMessageToSign()), keccak256(signature.serialize()))
      console.log("recovered pk", recoveredPk);

      if (signature.getValidationErrors().length > 0) throw new Error("Transaction validation errors");
      if (!signature.verifySignature()) throw new Error("Signature is not valid");
      return bytesToHex(signature.serialize());
    } catch (e) {
      console.log(e);
      throw Error(e);
    }
  }

  // This code can be used to actually relay the transaction to the Ethereum network
  async relayTransaction(signedTransaction, setStatus: Dispatch<string>, successCb: (txHash: string, setState: Dispatch<string>) => void) {
    // const serializedTx = bytesToHex(signedTransaction);
    const relayed = await this.web3.eth.sendSignedTransaction(signedTransaction);
    const txHash = relayed.transactionHash;

    successCb(txHash, setStatus);
  }
}



