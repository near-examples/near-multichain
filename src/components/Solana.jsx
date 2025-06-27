import PropTypes from "prop-types";

import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/debounce";
import { SIGNET_CONTRACT } from "../config";
import { chainAdapters } from "chainsig.js";
import { Connection as SolanaConnection } from "@solana/web3.js";
import { bigIntToDecimal } from "../utils/bigIntToDecimal";
import { decimalToBigInt } from "../utils/decimalToBigInt";

const connection = new SolanaConnection("https://api.devnet.solana.com");

const Solana = new chainAdapters.solana.Solana({
  solanaConnection: connection,
  contract: SIGNET_CONTRACT,
});

export function SolanaView({ props: { setStatus } }) {
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  const [receiverAddress, setReceiverAddress] = useState(
    "G58AYKiiNy7wwjPAeBAQWTM6S1kJwP3MQ3wRWWhhSJxA",
  );
  const [transferAmount, setTransferAmount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("");

  const [derivationPath, setDerivationPath] = useState("solana-1");
  const debouncedDerivationPath = useDebounce(derivationPath, 500);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivationPath]);

  useEffect(() => {
    setSolanaAddress();

    async function setSolanaAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(
        `Deriving address from path ${debouncedDerivationPath}...`,
      );

      const { publicKey } = await Solana.deriveAddressAndPublicKey(
        signedAccountId,
        debouncedDerivationPath,
      );

      setSenderAddress(publicKey);

      const balance = await Solana.getBalance(publicKey);

      setStatus(
        `Your Solana address is: ${publicKey}, balance: ${bigIntToDecimal(balance.balance, balance.decimals)} SOL`,
      );
    }
  }, [signedAccountId, debouncedDerivationPath, setStatus]);

  async function handleChainSignature() {
    setStatus("🏗️ Creating transaction");

    const {
      transaction: { transaction },
    } = await Solana.prepareTransactionForSigning({
      from: senderAddress,
      to: receiverAddress,
      amount: decimalToBigInt(transferAmount, 9),
    });

    setStatus(
      "🕒 Asking MPC to sign the transaction, this might take a while...",
    );

    try {
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: [transaction.serializeMessage()],
        path: debouncedDerivationPath,
        keyType: "Eddsa",
        signerAccount: {
          accountId: signedAccountId,
          signAndSendTransactions,
        },
      });

      if (!rsvSignatures[0] || !rsvSignatures[0].signature) {
        throw new Error("Failed to sign transaction");
      }

      const finalizedTransaction = Solana.finalizeTransactionSigning({
        transaction,
        rsvSignatures: rsvSignatures[0],
        senderAddress,
      });

      setStatus("✅ Signed payload ready to be relayed to the Solana network");
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
      "🔗 Relaying transaction to the Solana network... this might take a while",
    );

    try {
      const transactionHash = await Solana.broadcastTx(signedTransaction);

      setStatus(
        <>
          <a
            href={`https://explorer.solana.com/tx/${transactionHash.hash}?cluster=devnet`}
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
        You are working with <strong>DevNet</strong>.
        <br />
        You can get funds from the faucet:
        <a
          href="https://faucet.solana.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="alert-link"
        >
          faucet.solana.com/
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
          <div className="form-text" id="sol-sender">
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
              SOL
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

SolanaView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
  }).isRequired,
};
