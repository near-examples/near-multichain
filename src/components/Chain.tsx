import {Wallet} from "../services/near-wallet";
import React, {Dispatch, useContext, useEffect, useState} from "react";
import {NearContext} from "../context";
import {callContract} from "../services/near";
import {drop, FAUCET_CONTRACT, MPC_CONTRACT} from "../App";
import {Account} from "near-api-js";
import { ec as EC } from 'elliptic';
import {FeeMarketEIP1559Transaction} from "@ethereumjs/tx";
import {Hex, keccak256} from "viem";
import {hexDataSlice} from "@ethersproject/bytes";

export interface Address {
    publicKey: Buffer,
    derivedEthNEAR: string
}

export interface Chain<PayloadType, TransactionType, WalletArgsType> {
    deriveAddress(accountId, derivation_path): Promise<Address>
    createPayload(sender: string, receiver: string, amount: number): Promise<PayloadAndTx<PayloadType, TransactionType>>
    requestSignatureToMPC(wallet: Wallet | Account, contractId: string, path: string, payloadAndTx: PayloadAndTx<PayloadType, TransactionType>, sender: string): Promise<TransactionType>
    reconstructSignature(walletArgs: WalletArgsType, tx: TransactionType): Promise<TransactionType>
    relayTransaction(tx: TransactionType, setStatus: Dispatch<string>, successCb: (txHash: string, setStatus: Dispatch<string>) => void)
    getBalance(accountId: string): Promise<Number>
    serializeTx(tx: TransactionType): string
    deserializeTx(str: string): TransactionType
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
                const txLocalMemory = localStorage.getItem("transaction");

                console.log("sender", senderAddress, "receiver", receiverAddress, "amount", amount);
                const tx = c.deserializeTx(txLocalMemory);
                // c.createPayload(senderAddress, receiverAddress, amount).then((res) => {
                //     console.log("payload", res, "wallet args", walletArgs);
                c.reconstructSignature(walletArgs, tx).then((sigRes) => {
                    setSignedTransaction(sigRes);
                    setStatus(`✅ Signed payload ready to be relayed to the Ethereum network`);
                    setStep("relay");
                })
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

            const {derivedEthNEAR, _} = c.deriveAddress(nearAccount.accountId, derivationPath);
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
            localStorage.setItem("transaction", c.serializeTx(tx));

            setStatus(`🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`);
            try {
                await c.requestSignatureToMPC(wallet, MPC_CONTRACT, derivationPath, {payload, tx}, senderAddress);
                // setSignedTransaction(signedTransaction);
                // setStatus(`✅ Signed payload ready to be relayed to the Ethereum network`);
                // setStep('relay');
            } catch (e) {
                setStatus(`❌ Error: ${e.message}`);
                setLoading(false);
            }
        }

        async function relayTransaction() {
            setLoading(true);
            setStatus(`🔗 Relaying transaction ${signedTransaction} to the Ethereum network... this might take a while`);

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

// export function recoverPublicKey(txHash: string, signature: string): string {
//     const ec = new EC('secp256k1');
//
//     // Remove the "0x" prefix if present
//     if (txHash.startsWith('0x')) {
//         txHash = txHash.slice(2);
//     }
//     if (signature.startsWith('0x')) {
//         signature = signature.slice(2);
//     }
//
//     // Ethereum signature format is r (32 bytes) + s (32 bytes) + v (1 byte)
//     const r = signature.slice(0, 64);
//     const s = signature.slice(64, 128);
//     const v = parseInt(signature.slice(128, 130), 16);
//
//     // Adjust v to be 0 or 1 (recovery param)
//     const recoveryParam = v >= 27 ? v - 27 : v;
//
//     // Convert to Buffer objects
//     const msgHashBuffer = Buffer.from(txHash, 'hex');
//     const sig = {
//         r: Buffer.from(r, 'hex'),
//         s: Buffer.from(s, 'hex'),
//     };
//
//     // Recover the public key
//     const recoveredKey = ec.recoverPubKey(msgHashBuffer, sig, recoveryParam);
//
//     // Encode the public key in uncompressed format (including the leading "04")
//     return '0x' + recoveredKey.encode('hex', false);
// }
export function hexToUint8Array(hexString: string): Uint8Array {
    if (hexString.startsWith('0x')) {
        hexString = hexString.slice(2);
    }
    const len = hexString.length;
    const uint8Array = new Uint8Array(len / 2);
    for (let i = 0; i < len; i += 2) {
        uint8Array[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return uint8Array;
}

// Convert Uint8Array to hex
export function uint8ArrayToHex(uint8Array: Uint8Array): string {
    return '0x' + Array.from(uint8Array)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}


export function getPubKey(tx: FeeMarketEIP1559Transaction) {
    const uncompressedPublicKeyHex = '0x' + uint8ArrayToHex(tx.getSenderPublicKey());

// Hash the public key using Keccak-256
    const publicKeyHash = keccak256(uncompressedPublicKeyHex as Hex);

// Take the last 20 bytes of the hash to get the Ethereum address
    const ethereumAddress = hexDataSlice(publicKeyHash, 12);

    console.log('Ethereum Address:', ethereumAddress);
}
