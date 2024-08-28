import {Bytes, Web3} from "web3"
import {bytesToHex, PrefixedHexString} from '@ethereumjs/util';
import {FeeMarketEIP1559Transaction} from '@ethereumjs/tx';
import {deriveChildPublicKey, najPublicKeyStrToUncompressedHexPoint, uncompressedHexPointToEvmAddress} from './kdf';
import {Common} from '@ethereumjs/common'
import {Wallet} from "./near-wallet";
import {
  Address,
  Chain,
  EthereumWalletResult, getPubKey,
  hexToUint8Array,
  PayloadAndTx,
  uint8ArrayToHex
} from "../components/Chain";
import {Dispatch} from "react";
import {Account} from "near-api-js";
import {Hex, keccak256, recoverPublicKey, RecoverPublicKeyReturnType} from "viem";
import {hexDataSlice} from '@ethersproject/bytes';
import {parseNearAmount} from '@near-js/utils'

export class Ethereum implements Chain<Buffer, FeeMarketEIP1559Transaction, EthereumWalletResult> {
  private web3: Web3
  private chain_id: string;

  constructor(chain_rpc: string, chain_id) {
    this.web3 = new Web3(chain_rpc);
    this.chain_id = chain_id;
  }

  async deriveAddress(accountId, derivation_path): Promise<Address> {
    const publicKey = await deriveChildPublicKey(najPublicKeyStrToUncompressedHexPoint(), accountId, derivation_path);
    console.log("account id", accountId, "derivation path", derivation_path, "public key", publicKey);
    const address = uncompressedHexPointToEvmAddress(publicKey);
    console.log("address", address);
    return { publicKey: Buffer.from(publicKey, 'hex'), derivedEthNEAR: address };
  }

  async queryGasPrice() {
    const maxFeePerGas = await this.web3.eth.getGasPrice();
    const maxPriorityFeePerGas = await this.web3.eth.getMaxPriorityFeePerGas();
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  async getBalance(accountId: string) {
    const balance = await this.web3.eth.getBalance(accountId)
    return Number(this.web3.utils.fromWei(balance, "ether"));
  }

  // payload to actually send the transasction
  async createPayload(sender, receiver, amount): Promise<PayloadAndTx<Buffer, FeeMarketEIP1559Transaction>> {
    const common = new Common({ chain: this.chain_id });

    // Get the nonce & gas price
    const nonce = await this.web3.eth.getTransactionCount(sender);
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.queryGasPrice();
    console.log("max fee", maxFeePerGas, "max priorit fee", maxPriorityFeePerGas);

    const maxFeeAdjusted = maxFeePerGas + BigInt(100);
    const maxPriorityFeeAdjusted = maxPriorityFeePerGas + BigInt(100);

    // Construct transaction
    const transactionData = {
      nonce,
      gasLimit: 50_000,
      maxFeeAdjusted,
      maxPriorityFeeAdjusted,
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


  deserializeTx(str: string): FeeMarketEIP1559Transaction {
    return FeeMarketEIP1559Transaction.fromSerializedTx(Uint8Array.from(JSON.parse(`[${hexToUint8Array(str)}]`)));
  }

  serializeTx(tx: FeeMarketEIP1559Transaction): string {
    return uint8ArrayToHex(tx.serialize());
  }

  async requestSignatureToMPC(wallet: Wallet | Account, contractId: string, path: string, {payload: ethPayload, tx}: PayloadAndTx<Buffer, FeeMarketEIP1559Transaction>, sender: string): Promise<string> {
    // Ask the MPC to sign the payload
    const payload = Array.from(ethPayload);
    if (wallet instanceof Wallet) {
      await wallet.callMethod({
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
        deposit: parseNearAmount('0.01'),
      });

      // const [big_r, big_s] = await wallet.callMethod({ contractId, method: 'sign', args: { payload, path, key_version: 0 }, gas: '250000000000000' });
      // await this.reconstructSignature({big_r, s, recovery_id}, tx)
    } else if (wallet instanceof Account) {
      await wallet.functionCall({
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
        attachedDeposit: BigInt(parseNearAmount("0.01")),
      })

      // return await this.reconstructSignature({big_r, s, recovery_id}, tx)
    }
  }

  // async reconstructSignature(big_r, S, recovery_id, transaction) {
  async reconstructSignature(walletArgs, transaction: FeeMarketEIP1559Transaction): Promise<FeeMarketEIP1559Transaction> {
    try {
      const e: EthereumWalletResult = walletArgs;

      // reconstruct the signature
      const r = Buffer.from(e.big_r.affine_point.substring(2), 'hex');
      const s = Buffer.from(e.s.scalar, 'hex');
      const v = e.recovery_id;

      const signature = transaction.addSignature(v, r, s);
      getPubKey(signature);
      const signatureHex = `0x${r.toString('hex')}${s.toString('hex')}${v.toString(16).padStart(2, '0')}`;
      const recoveredPk: RecoverPublicKeyReturnType = await recoverPublicKey({hash: keccak256(transaction.getHashedMessageToSign()), signature: signatureHex as Hex});

      console.log("recovered pk", recoveredPk);
      console.log("recovered pk ethereum address", deriveEthereumAddress(recoveredPk));

      if (signature.getValidationErrors().length > 0) throw new Error("Transaction validation errors");
      if (!signature.verifySignature()) throw new Error("Signature is not valid");
      // return bytesToHex(signature.serialize());
      return signature;
    } catch (e) {
      console.log(e);
      throw Error(e);
    }
  }

  // This code can be used to actually relay the transaction to the Ethereum network
  async relayTransaction(signedTransaction: FeeMarketEIP1559Transaction, setStatus: Dispatch<string>, successCb: (txHash: string, setState: Dispatch<string>) => void) {
    const serializedTx = bytesToHex(signedTransaction.serialize());
    const relayed = await this.web3.eth.sendSignedTransaction(serializedTx);
    const txHash = relayed.transactionHash;

    successCb(txHash, setStatus);
  }
}


function deriveEthereumAddress(publicKey: string): string {
  // Remove the '04' prefix from the public key
  const uncompressedPublicKey = publicKey.startsWith('0x04')
      ? publicKey.slice(4)
      : publicKey;

  // Hash the public key using Keccak-256
  const publicKeyHash = keccak256(('0x' + uncompressedPublicKey) as Hex);

  // Take the last 20 bytes of the hash to get the Ethereum address
  return hexDataSlice(publicKeyHash, 12);
}

