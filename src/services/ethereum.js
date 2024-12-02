import { Web3 } from "web3"
import { bytesToHex } from '@ethereumjs/util';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
import { generateEthAddress } from './kdf/eth';
import { Common } from '@ethereumjs/common'
import { Contract, JsonRpcProvider } from "ethers";
import { MPC_CONTRACT } from "./kdf/mpc";

export class Ethereum {
  constructor(chain_rpc, chain_id) {
    this.web3 = new Web3(chain_rpc);
    window.web3 = this.web3;
    this.provider = new JsonRpcProvider(chain_rpc);
    this.chain_id = chain_id;
    this.queryGasPrice();
  }

  async deriveAddress(accountId, derivation_path) {
    const { address, publicKey } = await generateEthAddress({ accountId, derivation_path });
    return { address, publicKey };
  }

  async queryGasPrice() {
    const block = await this.web3.eth.getBlock("latest");
    const maxPriorityFeePerGas = await this.web3.eth.getMaxPriorityFeePerGas();
    const maxFeePerGas = block.baseFeePerGas * 2n + maxPriorityFeePerGas;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  async getBalance(accountId) {
    const balance = await this.web3.eth.getBalance(accountId);
    return this.web3.utils.fromWei(balance, "ether");
  }

  async getContractViewFunction(receiver, abi, methodName, args = []) {
    const contract = new Contract(receiver, abi, this.provider);

    return await contract[methodName](...args);
  }

  createTransactionData(receiver, abi, methodName, args = []) {
    const contract = new Contract(receiver, abi);

    return contract.interface.encodeFunctionData(methodName, args);
  }

  async createTransaction({ sender, receiver, amount, data = undefined }) {
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

    // Store in sessionStorage for later
    sessionStorage.setItem('transaction', transaction.serialize());

    return { transaction };
  }

  async requestSignatureToMPC({ wallet, path, transaction, attachedDeposit = 1 }) {
    const payload = Array.from(transaction.getHashedMessageToSign());

    const { big_r, s, recovery_id } = await wallet.callMethod({
      contractId: MPC_CONTRACT,
      method: 'sign',
      args: { request: { payload, path, key_version: 0 } },
      gas: '250000000000000', // 250 Tgas
      deposit: attachedDeposit,
    });

    return { big_r, s, recovery_id };
  }

  async reconstructSignedTransaction(big_r, S, recovery_id, transaction) {
    // reconstruct the signature
    const r = Buffer.from(big_r.affine_point.substring(2), 'hex');
    const s = Buffer.from(S.scalar, 'hex');
    const v = recovery_id;

    const signedTx = transaction.addSignature(v, r, s);

    if (signedTx.getValidationErrors().length > 0) throw new Error("Transaction validation errors");
    if (!signedTx.verifySignature()) throw new Error("Signature is not valid");
    return signedTx;
  }

  async reconstructSignedTXFromLocalSession(big_r, s, recovery_id, sender) {
    const serialized = Uint8Array.from(JSON.parse(`[${sessionStorage.getItem('transaction')}]`));
    const transaction = FeeMarketEIP1559Transaction.fromSerializedTx(serialized);
    return this.reconstructSignedTransaction(big_r, s, recovery_id, transaction, sender);
  }

  // This code can be used to actually relay the transaction to the Ethereum network
  async broadcastTX(signedTransaction) {
    const serializedTx = bytesToHex(signedTransaction.serialize());
    const relayed = this.web3.eth.sendSignedTransaction(serializedTx);
    let txHash;
    await relayed.on('transactionHash', (hash) => { txHash = hash });
    return txHash;
  }
}