import { Web3 } from "web3"
import { bytesToHex } from '@ethereumjs/util';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { deriveChildPublicKey, najPublicKeyStrToUncompressedHexPoint, uncompressedHexPointToEvmAddress } from '../services/kdf';
import { Common } from '@ethereumjs/common';

export class Ethereum {
  constructor(chain_rpc, chain_id) {
    this.web3 = new Web3(chain_rpc);
    this.chain_id = chain_id;
    this.queryGasPrice();
  }

  async deriveAddress(accountId, derivation_path, tokenId) {
    const path = `${tokenId},${derivation_path}`;
    const publicKey = await deriveChildPublicKey(najPublicKeyStrToUncompressedHexPoint(), accountId, path);
    const address = await uncompressedHexPointToEvmAddress(publicKey);
    return { publicKey: Buffer.from(publicKey, 'hex'), address };
  }

  async queryGasPrice() {
    const maxFeePerGas = await this.web3.eth.getGasPrice();
    const maxPriorityFeePerGas = await this.web3.eth.getMaxPriorityFeePerGas();
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  async getBalance(accountId) {
    const balance = await this.web3.eth.getBalance(accountId);
    const ONE_ETH = 1000000000000000000n;
    return Number(balance * 100n / ONE_ETH) / 100;
  }

  async createPayload(sender, receiver, amount) {
    const common = new Common({ chain: this.chain_id });

    // Get the nonce & gas price
    const nonce = await this.web3.eth.getTransactionCount(sender);
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.queryGasPrice();

    // Construct transaction
    const transactionData = {
      nonce,
      gasLimit: 21000,
      maxFeePerGas,
      maxPriorityFeePerGas,
      to: receiver,
      value: BigInt(this.web3.utils.toWei(amount, "ether")),
      chain: this.chain_id,
    };

    // Store data required if using web wallet 
    sessionStorage.setItem('sender', sender);
    sessionStorage.setItem('nonce', nonce);
    sessionStorage.setItem('maxFeePerGas', maxFeePerGas);
    sessionStorage.setItem('maxPriorityFeePerGas', maxPriorityFeePerGas);
    sessionStorage.setItem('to', receiver);
    sessionStorage.setItem('amount', amount);
    
    // Return the message hash
    const transaction = FeeMarketEIP1559Transaction.fromTxData(transactionData, { common });
    const payload = transaction.getHashedMessageToSign();
    return { transaction, payload };
  }

  async requestSignatureFromNFT(wallet, tokenId, contractId, path, ethPayload, transaction, sender) {
    const payload = Array.from(ethPayload.reverse());
    sessionStorage.setItem('chain', "ETH");

    // Ask the NFT Chain Key contract to sign the payload
    const result = await wallet.callMethod({ contractId, method: 'ckt_sign_hash', args: { token_id: tokenId, path, payload }, gas: '300000000000000', deposit: '1' });
    return await this.reconstructSignature(result, transaction, sender);
  }

  async requestSignatureFromNFTCallback(wallet, transactionHash) {
    // Pull data from sessionStorage and reconstruct transaction
    const sender = sessionStorage.getItem('sender');
    const transactionData = {
      nonce: BigInt(sessionStorage.getItem('nonce')),
      gasLimit: 21000,
      maxFeePerGas: BigInt(sessionStorage.getItem('maxFeePerGas')),
      maxPriorityFeePerGas: BigInt(sessionStorage.getItem('maxPriorityFeePerGas')),
      to: sessionStorage.getItem('to'),
      value: BigInt(this.web3.utils.toWei(sessionStorage.getItem('amount'), "ether")),
      chain: this.chain_id,
    };

    const common = new Common({ chain: this.chain_id });
    const transaction = FeeMarketEIP1559Transaction.fromTxData(transactionData, { common });

    const result = await wallet.getTransactionResult(transactionHash);
    return await this.reconstructSignature(result, transaction, sender);
  }

  async reconstructSignature(result, transaction, sender) {
    // Reconstruct the signature
    const r = Buffer.from(result.substring(0, 64), 'hex');
    const s = Buffer.from(result.substring(64, 128), 'hex');

    const candidates = [0n, 1n].map((v) => transaction.addSignature(v, r, s));
    const signature = candidates.find((c) => c.getSenderAddress().toString().toLowerCase() === sender.toLowerCase());

    if (!signature) {
      throw new Error("Signature is not valid");
    }

    if (signature.getValidationErrors().length > 0) throw new Error("Transaction validation errors");
    if (!signature.verifySignature()) throw new Error("Signature is not valid");

    return signature;
  }

  // This code can be used to actually relay the transaction to the Ethereum network
  async relayTransaction(signedTransaction) {
    const serializedTx = bytesToHex(signedTransaction.serialize());
    const relayed = await this.web3.eth.sendSignedTransaction(serializedTx);
    return relayed.transactionHash;
  }
}