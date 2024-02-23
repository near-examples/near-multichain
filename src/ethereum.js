import { Web3, } from "web3"
import { bytesToHex } from '@ethereumjs/util';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { Common } from '@ethereumjs/common'

export class Ethereum {
  constructor(chain_rpc, chain_id) {
    this.web3 = new Web3(chain_rpc);
    this.chain_id = chain_id;
  }

  async createPayload(eth_sender) {
    const common = new Common({ chain: this.chain_id });

    // Get the nonce
    const nonce = await this.web3.eth.getTransactionCount(eth_sender);

    // Construct transaction
    const transactionData = {
      nonce,
      gasLimit: 21000,
      maxFeePerGas: 32725779198,
      maxPriorityFeePerGas: 1,
      to: '0xa3286628134bad128faeef82f44e99aa64085c94',
      value: 1 + Math.floor(Math.random() * 1000000000000000),
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
    const transactionResult = await this.web3.eth.sendSignedTransaction(serializedTx);
    setStatus(`Ethereum TX hash: "${transactionResult.transactionHash}"`);
  }
}