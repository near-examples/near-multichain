import PropTypes from "prop-types";

import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/debounce";
import { SIGNET_CONTRACT } from "../config";
import { chainAdapters } from "chainsig.js";
import { decimalToBigInt } from "../utils/decimalToBigInt";
import { bigIntToDecimal } from "../utils/bigIntToDecimal";

const Xrp = new chainAdapters.xrp.XRP({
  rpcUrl: "wss://s.altnet.rippletest.net:51233/",
  network: "testnet",
  contract: SIGNET_CONTRACT
})

export function XRPView({ props: { setStatus } }) {
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  const [receiver, setReceiver] = useState("rnUbjwGJzDWh66xoavXnXBt4YWdGmeyE6Z");
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("");

  const [derivation, setDerivation] = useState("xrp-1");
  const [senderPK, setSenderPK] = useState("");
  const derivationPath = useDebounce(derivation, 500);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivation]);

  useEffect(() => {
    setXrpAddress();

    async function setXrpAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(`Deriving address from path ${derivationPath}...`);

      const { publicKey, address } = await Xrp.deriveAddressAndPublicKey(signedAccountId, derivationPath);

      setSenderAddress(address);
      setSenderPK(publicKey);
      const balance = await Xrp.getBalance(address);
      
      setStatus(
        `Your XRP address is: ${address} balance: ${bigIntToDecimal(balance.balance, balance.decimals)} XRP`
      );
    }
  }, [signedAccountId, derivationPath, setStatus]);

  async function chainSignature() {
    setStatus("🏗️ Creating transaction");

    const { transaction, hashesToSign } = await Xrp.prepareTransactionForSigning({
      from: senderAddress,
      to: receiver,
      amount: decimalToBigInt(amount, 6).toString(),
      publicKey: senderPK,
    });
    
    setStatus(
      "🕒 Asking MPC to sign the transaction, this might take a while..."
    );

    try {
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: hashesToSign,
        path: derivationPath,
        keyType: "Ecdsa",
        signerAccount: { 
          accountId: signedAccountId,
          signAndSendTransactions 
        }
      });

      if (!rsvSignatures[0]) {
        throw new Error("Failed to sign transaction");
      }
      
      const txSerialized = Xrp.finalizeTransactionSigning({
        transaction,
        rsvSignatures,
      })

      setStatus("✅ Signed payload ready to be relayed to the XRP network");
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
      "🔗 Relaying transaction to the XRP network... this might take a while"
    );

    try {
        console.log(signedTransaction);
        
      const txHash = await Xrp.broadcastTx(signedTransaction);

      setStatus(
        <>
          <a
            href={`https://testnet.xrpl.org/transactions/${txHash.hash}`}
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
      You are working with <strong>Testnet</strong>.
      <br />
      You can get funds from the faucet:
      <a
        href="https://xrpl.org/resources/dev-tools/xrp-faucets"
        target="_blank"
        rel="noopener noreferrer"
        className="alert-link"
      >
        xrpl.org/resources/dev-tools/xrp-faucets
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
        <div className="form-text"> XRP units </div>
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

XRPView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
  }).isRequired,
};
