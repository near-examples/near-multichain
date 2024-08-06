import {Wallet} from "../services/near-wallet";
import React, {Dispatch, useContext, useEffect, useState} from "react";
import {NearContext} from "../context";
import {useDebounce} from "../hooks/debounce";
import {callContract} from "../services/near";
import {drop, FAUCET_CONTRACT, MPC_CONTRACT} from "../App";
import {Account} from "near-api-js";
import {Payload} from "@near-wallet-selector/core/src/lib/helpers";

export interface Address {
    publicKey: Buffer,
    address: string

}
export interface Chain<PayloadType, TransactionType> {
    deriveAddress(accountId, derivation_path): Promise<Address>
    createPayload(sender: string, receiver: string, amount: number): Promise<PayloadAndTx<PayloadType, TransactionType>>
    requestSignatureToMPC(wallet: Wallet, contractId: string, path: string, payloadAndTx: PayloadAndTx<PayloadType, TransactionType>, sender: string): Promise<TransactionType>
    relayTransaction(tx: TransactionType, setStatus: Dispatch<string>, successCb: (txHash: string, setStatus: Dispatch<string>) => void)
    getBalance(accountId: string): Promise<Number>
}

export interface ChainProps {
    setStatus: Dispatch<string>
    nearAccount: Account
}

export interface PayloadAndTx<PayloadType, TransactionType> {
    payload: PayloadType,
    tx: TransactionType
}

export const BlockchainComponentGenerator = (c: Chain<any>, derivationPath: string, successCb: (txHash: string, setState: Dispatch<string>) => void) => {
    return ({setStatus, nearAccount} : ChainProps) => {
        const {wallet, signedAccountId} = useContext(NearContext);

        const [senderAddress, setSenderAddress] = useState("");
        const [receiverAddress, setReceiverAddress] = useState("");

        const [loading, setLoading] = useState(false);
        const [step, setStep] = useState("request");
        const [signedTransaction, setSignedTransaction] = useState(null);

        const [derivation, setDerivation] = useState("-1");
        const derivationPath = useDebounce(derivation, 500);
        const DERIVATION_PATH = useDebounce(derivationPath, 500); // TODO edit?

        const [action, setAction] = useState("deposit");
        const [depositAmount, setDepositAmount] = useState(0.03);

        useEffect(() => {
            setEthAddress()

            async function setEthAddress() {
                setStatus('Querying your address and balance');
                setSenderAddress(`Deriving address from path ${derivationPath}...`);

                const { address } = await c.deriveAddress(signedAccountId, derivationPath);
                console.log("signed account id", signedAccountId, "derivation path", derivationPath, "address", address);
                setSenderAddress(address);

                const balance = await c.getBalance(address);
                setStatus(`Your Ethereum address is: ${address}, balance: ${balance} ETH`);
            }
        }, [signedAccountId, derivationPath]);


        async function deposit() {
            const {address, _} = await c.deriveAddress(nearAccount.accountId, DERIVATION_PATH);
            console.log("Derived", address);
            console.log("wallet", wallet, "sender address", senderAddress, "deposit", depositAmount);

            await sendMoney(wallet, senderAddress, address, depositAmount);
            console.log("doneee :)");
        }

        async function withdraw() {
            const allowed = await callContract(nearAccount, derivationPath, FAUCET_CONTRACT, "ETHEREUM");
            if (!allowed || allowed) {
                setStatus(`❌ Error: not allowed to withdraw from faucet - make sure to wait 24 hours between calls`);
            }

            const {derivedEthNEAR, _} = c.deriveAddress(nearAccount, DERIVATION_PATH);
            await sendMoney(wallet, derivedEthNEAR, senderAddress, drop);
        }

        async function sendMoney(wallet: Wallet, senderAddress: string, receiverAddress: string, amount: number) {
            setStatus('🏗️ Creating transaction');
            const { transaction, payload } = await c.createPayload(senderAddress, receiverAddress, amount);

            setStatus(`🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`);
            try {
                const signedTransaction = await c.requestSignatureToMPC(wallet, MPC_CONTRACT, derivationPath, payload, transaction, senderAddress);
                setSignedTransaction(signedTransaction);
                setStatus(`✅ Signed payload ready to be relayed to the Ethereum network`);
                setStep('relay');
            } catch (e) {
                setStatus(`❌ Error: ${e.message}`);
                setLoading(false);
            }
        }

        async function relayTransaction() {
            setLoading(true);
            setStatus('🔗 Relaying transaction to the Ethereum network... this might take a while');

            try {
                await c.relayTransaction(signedTransaction, setStatus, successCb);
            } catch (e) {
                setStatus(`❌ Error: ${e.message}`);
            }

            setStep('request');
            setLoading(false);
        }

        return (
            <>
                <div className="input-group input-group-sm my-2 mb-4">
                    <span className="text-primary input-group-text" id="chain">Action:</span>
                    <select className="form-select" aria-describedby="chain" value={action} onChange={e => setAction(e.target.value)} >
                        <option value="deposit"> Deposit </option>
                        <option value="withdraw"> Withdraw </option>
                    </select>
                </div>

                {
                    action === "deposit" ?
                        <div className="input-group input-group-sm my-2 mb-4">
                            <span>Amount: </span>
                            <input type="number" className="form-control form-control-sm" value={depositAmount}
                                   onChange={(e) => setDepositAmount(parseFloat(e.target.value))}/>
                            <input type="button" value="Submit" onClick={() => deposit()}/>
                        </div> :
                        <div className="input-group input-group-sm my-2 mb-4">
                            <span>Receiver: </span>
                            <input type="text" className="form-control form-control-sm" value={receiverAddress}
                                   onChange={(e) => setReceiverAddress(e.target.value)}/>
                            <input type="button" value="Submit" onClick={() => withdraw()}/>
                        </div>
                }

                <div className="text-center mt-3">
                    {step === 'relay' && <button className="btn btn-success text-center" onClick={relayTransaction} disabled={loading}> Relay Transaction </button>}
                </div>
            </>
        )
    }
}