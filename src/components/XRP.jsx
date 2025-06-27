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
  contract: SIGNET_CONTRACT,
});

export function XRPView({ props: { setStatus } }) {
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  const [receiverAddress, setReceiverAddress] = useState(
    "rnUbjwGJzDWh66xoavXnXBt4YWdGmeyE6Z",
  );
  const [transferAmount, setTransferAmount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("");

  const [derivationPath, setDerivationPath] = useState("xrp-1");
  const [senderPublicKey, setSenderPublicKey] = useState("");
  const debouncedDerivationPath = useDebounce(derivationPath, 500);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivationPath]);

  useEffect(() => {
    setXrpAddress();

    async function setXrpAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(
        `Deriving address from path ${debouncedDerivationPath}...`,
      );

      const { address, publicKey } = await Xrp.deriveAddressAndPublicKey(
        signedAccountId,
        debouncedDerivationPath,
      );

      setSenderAddress(address);
      setSenderPublicKey(publicKey);
      const balance = await Xrp.getBalance(address);

      setStatus(
        `Your XRP address is: ${address} balance: ${bigIntToDecimal(balance.balance, balance.decimals)} XRP`,
      );
    }
  }, [signedAccountId, debouncedDerivationPath, setStatus]);

  async function handleChainSignature() {
    setStatus("🏗️ Creating transaction");

    const { transaction, hashesToSign } =
      await Xrp.prepareTransactionForSigning({
        from: senderAddress,
        to: receiverAddress,
        amount: decimalToBigInt(transferAmount, 6).toString(),
        publicKey: senderPublicKey,
      });

    setStatus(
      "🕒 Asking MPC to sign the transaction, this might take a while...",
    );

    try {
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: hashesToSign,
        path: debouncedDerivationPath,
        keyType: "Ecdsa",
        signerAccount: {
          accountId: signedAccountId,
          signAndSendTransactions,
        },
      });

      if (!rsvSignatures[0]) {
        throw new Error("Failed to sign transaction");
      }

      const finalizedTransaction = Xrp.finalizeTransactionSigning({
        transaction,
        rsvSignatures,
      });

      setStatus("✅ Signed payload ready to be relayed to the XRP network");
      setSignedTransaction(finalizedTransaction);
      setCurrentStep("relay");
    } catch (error) {
      console.log(error);
      setStatus(`❌ Error: ${error.message}`);
      setIsLoading(false);
    }
  }

  async function handleRelayTransaction() {
    setIsLoading(true);
    setStatus(
      "🔗 Relaying transaction to the XRP network... this might take a while",
    );

    try {
      console.log(signedTransaction);

      const transactionHash = await Xrp.broadcastTx(signedTransaction);

      setStatus(
        <>
          <a
            href={`https://testnet.xrpl.org/transactions/${transactionHash.hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {" "}
            ✅ Successfully Broadcasted{" "}
          </a>
        </>,
      );
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    }

    setCurrentStep("request");
    setIsLoading(false);
  }

  const handleUIChainSignature = async () => {
    setIsLoading(true);
    await handleChainSignature();
    setIsLoading(false);
  };

  return (
    <>
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
            value={derivationPath}
            onChange={(e) => setDerivationPath(e.target.value)}
            disabled={isLoading}
          />
          <div className="form-text" id="xrp-sender">
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
            value={receiverAddress}
            onChange={(e) => setReceiverAddress(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">
          Amount:
        </label>
        <div className="col-sm-10">
          <div className="input-group">
            <input
              type="number"
              className="form-control form-control-sm"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              step="0.1"
              min="0"
              disabled={isLoading}
            />
            <span className="input-group-text bg-primary text-white fw-bold">
              XRP
            </span>
          </div>
        </div>
      </div>

      <div className="text-center mt-3">
        {currentStep === "request" && (
          <button
            className="btn btn-primary text-center"
            onClick={handleUIChainSignature}
            disabled={isLoading}
          >
            {" "}
            Request Signature{" "}
          </button>
        )}
        {currentStep === "relay" && (
          <button
            className="btn btn-success text-center"
            onClick={handleRelayTransaction}
            disabled={isLoading}
          >
            {" "}
            Relay Transaction{" "}
          </button>
        )}
      </div>
    </>
  );
}

XRPView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
  }).isRequired,
};
