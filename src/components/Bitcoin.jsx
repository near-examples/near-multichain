import { useState, useEffect } from "react";

import { useDebounce } from "../hooks/debounce";
import PropTypes from "prop-types";
import { SIGNET_CONTRACT, NetworkId } from "../config";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { chainAdapters } from "chainsig.js";
import { bigIntToDecimal } from "../utils/bigIntToDecimal";

const btcRpcAdapter = new chainAdapters.btc.BTCRpcAdapters.Mempool(
  "https://mempool.space/testnet4/api",
);

const Bitcoin = new chainAdapters.btc.Bitcoin({
  network: NetworkId,
  btcRpcAdapter,
  contract: SIGNET_CONTRACT,
});

export function BitcoinView({ props: { setStatus } }) {
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  const [receiverAddress, setReceiverAddress] = useState(
    "tb1qzm5r6xhee7upsa9avdmpp32r6g5e87tsrwjahu",
  );
  const [transferAmount, setTransferAmount] = useState(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("");
  const [senderPublicKey, setSenderPublicKey] = useState("");

  const [derivationPath, setDerivationPath] = useState("bitcoin-1");
  const debouncedDerivationPath = useDebounce(derivationPath, 500);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivationPath]);

  useEffect(() => {
    setBtcAddress();

    async function setBtcAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(
        `Deriving address from path ${debouncedDerivationPath}...`,
      );

      const { address, publicKey } = await Bitcoin.deriveAddressAndPublicKey(
        signedAccountId,
        debouncedDerivationPath,
      );
      setSenderAddress(address);
      setSenderPublicKey(publicKey);

      const balance = await Bitcoin.getBalance(address);

      const bitcoinBalance = bigIntToDecimal(balance.balance, balance.decimals);

      const satoshiAmount = chainAdapters.btc.Bitcoin.toSatoshi(bitcoinBalance);

      setStatus(
        `Your Bitcoin address is: ${address}, balance: ${satoshiAmount} satoshi`,
      );
    }
  }, [signedAccountId, debouncedDerivationPath, setStatus]);

  async function handleChainSignature() {
    setStatus("🏗️ Creating transaction");

    const { transaction, hashesToSign } =
      await Bitcoin.prepareTransactionForSigning({
        publicKey: senderPublicKey,
        from: senderAddress,
        to: receiverAddress,
        value: transferAmount.toString(),
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

      if (!rsvSignatures) {
        throw new Error("No signature received");
      }

      const finalizedTransaction = Bitcoin.finalizeTransactionSigning({
        transaction,
        rsvSignatures,
      });

      setStatus("✅ Signed payload ready to be relayed to the Bitcoin network");
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
      "🔗 Relaying transaction to the Bitcoin network... this might take a while",
    );

    try {
      const transactionHash = await Bitcoin.broadcastTx(signedTransaction);

      setStatus(
        <>
          <a
            href={`https://mempool.space/es/testnet4/tx/${transactionHash.hash}`}
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
        You are working with <strong>Testnet 4</strong>.
        <br />
        You can get funds from the faucet:
        <a
          href="https://mempool.space/testnet4/faucet"
          target="_blank"
          rel="noopener noreferrer"
          className="alert-link"
        >
          mempool.space/testnet4/mining
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
          <div className="form-text" id="btc-sender">
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
              step="1"
              disabled={isLoading}
            />
            <span className="input-group-text bg-primary text-white fw-bold">
              SAT
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

BitcoinView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
  }).isRequired,
};
