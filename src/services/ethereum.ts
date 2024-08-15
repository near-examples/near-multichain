import {Web3} from "web3"
import {bytesToHex} from '@ethereumjs/util';
import {FeeMarketEIP1559Transaction} from '@ethereumjs/tx';
import {
  deriveChildPublicKey,
  najPublicKeyStrToUncompressedHexPoint,
  uncompressedHexPointToEvmAddress
} from './kdf';
import {Common} from '@ethereumjs/common'
import {Wallet} from "./near-wallet";
import {Address, Chain, EthereumWalletResult, PayloadAndTx} from "../components/Chain";
import {Dispatch} from "react";
import * as nearAPI from "near-api-js";

export class Ethereum implements Chain<Buffer, FeeMarketEIP1559Transaction, EthereumWalletResult>{
  private web3: Web3
  private chain_id: string;

  constructor(chain_rpc, chain_id) {
    this.web3 = new Web3(chain_rpc);
    this.chain_id = chain_id;
    this.queryGasPrice();
  }

  async deriveAddress(accountId, derivation_path): Promise<Address> {
    const publicKey = await deriveChildPublicKey(najPublicKeyStrToUncompressedHexPoint(), accountId, derivation_path);
    const address = uncompressedHexPointToEvmAddress(publicKey);
    return { publicKey: Buffer.from(publicKey, 'hex'), address };
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
    const nonce = await this.web3.eth.getTransactionCount(sender);
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.queryGasPrice();

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

    const tx = FeeMarketEIP1559Transaction.fromTxData(transactionData, {common});
    // Return the message hash
    return {
      payload: Buffer.from(tx.getHashedMessageToSign()),
      tx: tx,
    };
  }

  async requestSignatureToMPC(wallet: Wallet, contractId: string, path: string, {payload: ethPayload, tx}: PayloadAndTx<Buffer, FeeMarketEIP1559Transaction>, sender: string): Promise<string> {
    // Ask the MPC to sign the payload
    const payload = Array.from(ethPayload.reverse());
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
  }

  // async reconstructSignature(big_r, S, recovery_id, transaction) {
  async reconstructSignature(walletArgs, transaction) {
    const e: EthereumWalletResult = walletArgs;
    // reconstruct the signature
    const r = Buffer.from(e.big_r.affine_point.substring(2), 'hex');
    const s = Buffer.from(e.s.scalar, 'hex');
    const v = e.recovery_id;

    const signature = transaction.addSignature(v, r, s);

    if (signature.getValidationErrors().length > 0) throw new Error("Transaction validation errors");
    if (!signature.verifySignature()) throw new Error("Signature is not valid");
    return signature;
  }

  // This code can be used to actually relay the transaction to the Ethereum network
  async relayTransaction(signedTransaction: FeeMarketEIP1559Transaction, setStatus: Dispatch<string>, successCb: (txHash: string, setState: Dispatch<string>) => void) {
    const serializedTx = bytesToHex(signedTransaction.serialize());
    const relayed = await this.web3.eth.sendSignedTransaction(serializedTx);
    const txHash = relayed.transactionHash;

    successCb(txHash, setStatus);
  }

}