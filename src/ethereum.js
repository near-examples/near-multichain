import { Web3, } from "web3"
import { bytesToHex } from '@ethereumjs/util';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { Common } from '@ethereumjs/common'

export class Ethereum {
  constructor(chain_rpc, chain_id) {
    this.web3 = new Web3(chain_rpc);
    this.chain_id = chain_id;
  }

  async getBalance(accountId) {
    const balance = await this.web3.eth.getBalance(accountId)
    const ONE_ETH = 1000000000000000000n;
    return Number(balance * 100n / ONE_ETH) / 100;
  }

  async createPayload(sender, receiver) {
    const common = new Common({ chain: this.chain_id });

    // Get the nonce
    const nonce = await this.web3.eth.getTransactionCount(sender);
    const maxFeePerGas = await this.queryGasPrice();

    // Construct transaction
    const transactionData = {
      nonce,
      gasLimit: 21000,
      maxFeePerGas,
      maxPriorityFeePerGas: 1,
      to: receiver,
      value: 10000000000000000n, //0.01 ETH
      chain: this.chain_id,
    };

    // Return the message hash
    const transaction = FeeMarketEIP1559Transaction.fromTxData(transactionData, { common });
    const tx_hash = transaction.getHashedMessageToSign();
    return { transaction, payload: Array.from(tx_hash) };
  }

  // This code can be used to actually relay the transaction to the Ethereum network
  async relayTransaction(signedTransaction) {
    const serializedTx = bytesToHex(signedTransaction.serialize());
    const relayed = await this.web3.eth.sendSignedTransaction(serializedTx);
    return relayed.transactionHash
  }

  reconstructSignature(transaction, big_r, big_s) {
    const r = Buffer.from(big_r.slice(2), 'hex');
    const s = Buffer.from(big_s, 'hex');
    let v = big_r.startsWith('02') ? 0n : 1n;

    const signedTransaction = transaction.addSignature(v, r, s);
    return signedTransaction;
  }

  async queryGasPrice() {
    const res = await fetch('https://sepolia.beaconcha.in/api/v1/execution/gasnow');
    const json = await res.json();
    return json.data.standard;
  }
}