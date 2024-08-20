import {Wallet} from "../services/near-wallet";
import React, {Dispatch, useContext, useEffect, useState} from "react";
import {NearContext} from "../context";
import {useDebounce} from "../hooks/debounce";
import {callContract} from "../services/near";
import {drop, FAUCET_CONTRACT, MPC_CONTRACT} from "../App";
import {Account} from "near-api-js";
import {a} from "vite/dist/node/types.d-aGj9QkWt";
import {FeeMarketEIP1559Transaction} from "@ethereumjs/tx";
import * as nearAPI from "near-api-js";
import {BrowserLocalStorageKeyStore} from "near-api-js/lib/key_stores";

export interface Address {
    publicKey: Buffer,
    derivedEthNEAR: string
}

export interface Chain<PayloadType, TransactionType, WalletArgsType> {
    deriveAddress(accountId, derivation_path): Promise<Address>
    createPayload(sender: string, receiver: string, amount: number): Promise<PayloadAndTx<PayloadType, TransactionType>>
    requestSignatureToMPC(wallet: Wallet | Account, contractId: string, path: string, payloadAndTx: PayloadAndTx<PayloadType, TransactionType>, sender: string): Promise<TransactionType>
    reconstructSignature(walletArgs: WalletArgsType, tx: TransactionType): Promise<string>
    relayTransaction(tx: TransactionType, setStatus: Dispatch<string>, successCb: (txHash: string, setStatus: Dispatch<string>) => void)
    getBalance(accountId: string): Promise<Number>
}

// TODO make this for Ethereum only
export interface EthereumWalletResult {
    big_r: any,
    s: any,
    recovery_id: any
}

export interface BitcoinWalletResult {
    big_r: any
    big_s: any
}

export interface ChainProps {
    setStatus: Dispatch<string>
    nearAccount: Account
    walletArgs: any
}

export interface PayloadAndTx<PayloadType, TransactionType> {
    payload: PayloadType,
    tx: TransactionType
}

export const BlockchainComponentGenerator = (c: Chain<any, any, any>, derivationPath: string, successCb: (txHash: string, setState: Dispatch<string>) => void) => {
    return ({setStatus, nearAccount, walletArgs} : ChainProps) => {
        const {wallet, signedAccountId} = useContext(NearContext);
        const [senderAddress, setSenderAddress] = useState("");
        const [receiverAddress, setReceiverAddress] = useState("");

        const [loading, setLoading] = useState(false);
        const [step, setStep] = useState("request");
        const [signedTransaction, setSignedTransaction] = useState(null);

        const derivationPath = "-1";

        const [action, setAction] = useState("deposit");
        const [depositAmount, setDepositAmount] = useState(0.01);

        useEffect(() => {
            setEthAddress()

            if (walletArgs != null) {
                const senderAddress = localStorage.getItem("sender");
                const receiverAddress = localStorage.getItem("receiver");
                const amount = parseFloat(localStorage.getItem("amount"));

                console.log("sender", senderAddress, "receiver", receiverAddress, "amount", amount);
                c.createPayload(senderAddress, receiverAddress, amount).then((res) => {
                    console.log("payload", res, "wallet args", walletArgs);
                    c.reconstructSignature(walletArgs, res.tx).then((res) => {
                        setSignedTransaction(res);
                        setStatus(`✅ Signed payload ready to be relayed to the Ethereum network`);
                        setStep("relay");
                        console.log("signed tx", res);
                    })
                });
            }

            async function setEthAddress() {
                setStatus('Querying your address and balance');
                setSenderAddress(`Deriving address from path ${derivationPath}...`);

                if (signedAccountId && derivationPath) {
                    const { derivedEthNEAR } = await c.deriveAddress(signedAccountId, derivationPath);
                    console.log("signed account id", signedAccountId, "derivation path", derivationPath, "address", derivedEthNEAR);
                    setSenderAddress(derivedEthNEAR);

                    const balance = await c.getBalance(derivedEthNEAR);
                    setStatus(`Your Ethereum address is: ${derivedEthNEAR}, balance: ${balance} ETH`);
                }
            }
        }, [signedAccountId, derivationPath, walletArgs]);

        // it can't be the same wallet for sending money for a deposit and a withdraw...
        async function deposit() {
            const {derivedEthNEAR, _} = await c.deriveAddress(nearAccount.accountId, derivationPath);
            console.log("Derived", derivedEthNEAR);
            console.log("wallet", wallet, "sender address", senderAddress, "deposit", depositAmount);

            await sendMoney(wallet, senderAddress, derivedEthNEAR, depositAmount);
            console.log("doneee :)");

        }

        async function withdraw() {
            const allowed = await callContract(nearAccount, derivationPath, FAUCET_CONTRACT, "ETHEREUM");
            if (!allowed || allowed) {
                setStatus(`❌ Error: not allowed to withdraw from faucet - make sure to wait 24 hours between calls`);
            }

            const {derivedEthNEAR, _} = c.deriveAddress(nearAccount, derivationPath);
            await sendMoney(nearAccount, derivedEthNEAR, senderAddress, drop);
        }

        async function sendMoney(wallet: Wallet | Account, senderAddress: string, receiverAddress: string, amount: number) {
            setStatus('🏗️ Creating transaction');
            const { tx, payload } = await c.createPayload(senderAddress, receiverAddress, amount);
            console.log("first payload", payload);
            console.log("setting", "sender", senderAddress, "receiver", receiverAddress, "amount", amount);
            // set these items in the local storage
            localStorage.setItem("sender", senderAddress);
            localStorage.setItem("receiver", receiverAddress);
            localStorage.setItem("amount", amount.toString());

            setStatus(`🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`);
            try {
                const signedTransaction = await c.requestSignatureToMPC(wallet, MPC_CONTRACT, derivationPath, {payload, tx}, senderAddress);
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
                console.log("relay error", e);
                setStatus(`❌ Error: ${e.message} Reason: ${e.reason}`);
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