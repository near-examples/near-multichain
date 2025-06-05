import PropTypes from "prop-types";

import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/debounce";
import { SIGNET_CONTRACT } from "../config";
import { chainAdapters } from "chainsig.js";
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { bigIntToDecimal } from "../utils/bigIntToDecimal";

const rpcUrl = getFullnodeUrl('testnet')
const suiClient = new SuiClient({ url: rpcUrl })

const Sui = new chainAdapters.sui.SUI({
  client: suiClient,
  contract: SIGNET_CONTRACT,
  rpcUrl: rpcUrl,
})

export function SuiView({ props: { setStatus } }) {
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  const [receiver, setReceiver] = useState("G58AYKiiNy7wwjPAeBAQWTM6S1kJwP3MQ3wRWWhhSJxA");
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("");

  const [derivation, setDerivation] = useState("sui-1");
  const derivationPath = useDebounce(derivation, 500);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivation]);

  useEffect(() => {
    setSolAddress();

    async function setSolAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(`Deriving address from path ${derivationPath}...`);

      const { publicKey } = await Sui.deriveAddressAndPublicKey(signedAccountId, derivationPath);

      setSenderAddress(publicKey);

      const balance = await Sui.getBalance(publicKey);

      setStatus(
        `Your Sui address is:${publicKey}, balance: ${bigIntToDecimal(balance.balance, balance.decimals)} sol`
      );
    }
  }, [signedAccountId, derivationPath, setStatus]);

  async function chainSignature() {
    setStatus("🏗️ Creating transaction");
    
    const tx = new Transaction()

    const [coin] = tx.splitCoins(tx.gas, [100])

    tx.transferObjects(
      [coin],
      senderAddress
    )
    tx.setSender(receiver)

    const { hashesToSign, transaction } = await Sui.prepareTransactionForSigning(tx)


    setStatus(
      "🕒 Asking MPC to sign the transaction, this might take a while..."
    );

    try {
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: [hashesToSign],
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

      const txSerialized = Sui.finalizeTransactionSigning({
        transaction,
        rsvSignatures: rsvSignatures[0],
        senderAddress
      })

      setStatus("✅ Signed payload ready to be relayed to the Sui network");
      setSignedTransaction(txSerialized);
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
      "🔗 Relaying transaction to the Sui network... this might take a while"
    );

    try {

      const txHash = await Sui.broadcastTx(signedTransaction);

      setStatus(
        <>
          <a
            href={`https://suiscan.xyz/testnet/tx/${txHash.hash}`}
            target="_blank"
          >
            {" "}
            ✅ Successfully Broadcasted{" "}
          </a>
        </>
      );
    } catch (e) {
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
      You are working with <strong>DevTest</strong>.
      <br />
      You can get funds from the faucet:
      <a
        href="https://faucet.sui.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="alert-link"
      >
        faucet.sui.com/
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
        <div className="form-text"> sui units </div>
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

SuiView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
  }).isRequired,
};
