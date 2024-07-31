import {Wallet} from "../services/near-wallet";
import {BaseTransaction} from "@ethereumjs/tx/dist/cjs/baseTransaction";
import {FeeMarketEIP1559Transaction} from "@ethereumjs/tx";
import {ChainProps} from "./Bitcoin";

export interface Address {
    publicKey: Buffer,
    address: string

}
export interface Chain<TransactionType> {
    deriveAddress(accountId, derivation_path): Promise<Address>
    createPayload(sender: string, receiver: string, amount: number): Promise<TransactionType>
    requestSignatureToMPC(wallet: Wallet, contractId: string, path: string, ethPayload: any, transaction: TransactionType, sender: string): Promise<TransactionType>
    relayTransaction(tx: TransactionType)
}

