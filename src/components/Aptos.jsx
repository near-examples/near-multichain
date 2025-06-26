import PropTypes from "prop-types";

import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/debounce";
import { SIGNET_CONTRACT } from "../config";
import { chainAdapters } from "chainsig.js";
import { bigIntToDecimal } from "../utils/bigIntToDecimal";
import { decimalToBigInt } from "../utils/decimalToBigInt";
import { Aptos as AptosClient, AptosConfig, Network } from '@aptos-labs/ts-sdk'

const aptosClient = new AptosClient(
    new AptosConfig({
        network: Network.TESTNET,
    })
)

const Aptos = new chainAdapters.aptos.Aptos({
    client: aptosClient,
    contract: SIGNET_CONTRACT,
})

export function AptosView({ props: { setStatus } }) {
    const { signedAccountId, signAndSendTransactions } = useWalletSelector();

    const [receiver, setReceiver] = useState("0x3b0c3efaa16f5c7c53d3ca9c12622c90542ff36485f7f713ba8e76756a3fbbea");
    const [amount, setAmount] = useState(1);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState("request");
    const [signedTransaction, setSignedTransaction] = useState(null);
    const [senderAddress, setSenderAddress] = useState("");
    const [senderPK, setSenderPK] = useState("");

    const [derivation, setDerivation] = useState("aptos-1");
    const derivationPath = useDebounce(derivation, 500);

    useEffect(() => {
        setSenderAddress("Waiting for you to stop typing...");
    }, [derivation]);

    useEffect(() => {
        setAptosAddress();

        async function setAptosAddress() {
            setStatus("Querying your address and balance");
            setSenderAddress(`Deriving address from path ${derivationPath}...`);

            const { address,publicKey } = await Aptos.deriveAddressAndPublicKey(signedAccountId, derivationPath);

            setSenderAddress(address);
            setSenderPK(publicKey);

            const balance = await Aptos.getBalance(address);

            setStatus(
                `Your Aptos address is: ${address}, balance: ${bigIntToDecimal(balance.balance, balance.decimals)} APT`
            );
        }

    }, [signedAccountId, derivationPath, setStatus]);

    async function chainSignature() {
        setStatus("🏗️ Creating transaction");

        const transactionPayload = {
            function: '0x1::aptos_account::transfer',
            functionArguments: [
                receiver,
                decimalToBigInt(amount, 8),
            ],
        };

        const transaction = await aptosClient.transaction.build.simple({
            sender: senderAddress,
            data: transactionPayload,
        })

        const { hashesToSign } = await Aptos.prepareTransactionForSigning(transaction)
        setStatus(
            "🕒 Asking MPC to sign the transaction, this might take a while..."
        );

        try {
            const rsvSignatures = await SIGNET_CONTRACT.sign({
                payloads: hashesToSign,
                path: derivationPath,
                keyType: "Eddsa",
                signerAccount: {
                    accountId: signedAccountId,
                    signAndSendTransactions
                }
            });

            if (!rsvSignatures[0] || !rsvSignatures[0].signature) {
                throw new Error("Failed to sign transaction");
            }

            const txSerialized = Aptos.finalizeTransactionSigning({
                transaction,
                rsvSignatures: rsvSignatures[0],
                publicKey: senderPK
            });

            setSignedTransaction(txSerialized);
            setStatus("✅ Signed payload ready to be relayed to the Aptos network");
            setStep("relay");
        } catch (e) {
            console.log(e);
            setStatus(`❌ Error: ${e.message}`);
            setLoading(false);
        }
    }

    async function relayTransaction() {
        setLoading(true);
        setStatus(
            "🔗 Relaying transaction to the Aptos network..."
        );

        try {
            const txHash = await Aptos.broadcastTx(signedTransaction);

            setStatus(
                <>
                    <a
                        href={`https://explorer.aptoslabs.com/txn/${txHash.hash}?network=testnet`}
                        target="_blank"
                    >
                        {" "}
                        ✅ Successfully Broadcasted{" "}
                    </a>
                </>
            );
        } catch (e) {
            if (e.message.includes("TRANSACTION_EXPIRED")) {
                setStatus("⏰ Transaction expired, creating a new one...");
                setStep("request");
                setLoading(false);
                return;
            }
            setStatus(`❌ Error: ${e.message}`);
        }

        setStep("request");
        setLoading(false);
    }

    const UIChainSignature = async () => {
        setLoading(true);
        await chainSignature();
        setLoading(false);
    };

    return (<>
        <div className="alert alert-info text-center" role="alert">
            You are working with <strong>Aptos Testnet</strong>.
            <br />
            You can get funds from the faucet:
            <a
                href="https://aptos.dev/network/faucet"
                target="_blank"
                rel="noopener noreferrer"
                className="alert-link"
            >
                aptos.dev/network/faucet
            </a>
        </div>
        <div className="row my-3">
            <label className="col-sm-2 col-form-label col-form-label-sm">
                Path:
            </label>
            <div className="col-sm-10">
                <input
                    type="text"
                    className="form-control form-control-sm"
                    value={derivation}
                    onChange={(e) => setDerivation(e.target.value)}
                    disabled={loading}
                />
                <div className="form-text" id="eth-sender">
                    {" "}
                    {senderAddress}{" "}
                </div>
            </div>
        </div>
        <div className="row mb-3">
            <label className="col-sm-2 col-form-label col-form-label-sm">To:</label>
            <div className="col-sm-10">
                <input
                    type="text"
                    className="form-control form-control-sm"
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value)}
                    disabled={loading}
                />
            </div>
        </div>
        <div className="row mb-3">
            <label className="col-sm-2 col-form-label col-form-label-sm">
                Amount:
            </label>
            <div className="col-sm-10">
                <input
                    type="number"
                    className="form-control form-control-sm"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.1"
                    min="0"
                    disabled={loading}
                />
                <div className="form-text"> APT units </div>
            </div>
        </div>

        <div className="text-center mt-3">
            {step === "request" && (
                <button
                    className="btn btn-primary text-center"
                    onClick={UIChainSignature}
                    disabled={loading}
                >
                    {" "}
                    Request Signature{" "}
                </button>
            )}
            {step === "relay" && (
                <button
                    className="btn btn-success text-center"
                    onClick={relayTransaction}
                    disabled={loading}
                >
                    {" "}
                    Relay Transaction{" "}
                </button>
            )}
        </div>
    </>)
}

AptosView.propTypes = {
    props: PropTypes.shape({
        setStatus: PropTypes.func.isRequired,
    }).isRequired,
};
