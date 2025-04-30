import PropTypes from "prop-types";

import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/debounce";
import { SIGNET_CONTRACT, MPC_CONTRACT } from "../config";
import { chainAdapters } from "chainsig.js";
import { Connection as SolanaConnection } from '@solana/web3.js'
import { bigIntToDecimal } from "../utils/bigIntToDecimal";
import { decimalToBigInt } from "../utils/decimalToBigInt";

function uint8ArrayToHex(uint8Array) {
  return Array.from(uint8Array)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

const connection = new SolanaConnection("https://api.devnet.solana.com");
const solana = new chainAdapters.solana.Solana({
  solanaConnection: connection,
  contract: SIGNET_CONTRACT
}) 

export function SolanaView({ props: { setStatus } }) {
  const { callFunction, signedAccountId } = useWalletSelector();
 
  const [receiver, setReceiver] = useState("G58AYKiiNy7wwjPAeBAQWTM6S1kJwP3MQ3wRWWhhSJxA");
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderAddress, setSenderAddress] = useState("");

  const [derivation, setDerivation] = useState("solana-1");
  const derivationPath = useDebounce(derivation, 500);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivation]);

  useEffect(() => {
    setSolAddress();

    async function setSolAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(`Deriving address from path ${derivationPath}...`);

      const { publicKey } = await solana.deriveAddressAndPublicKey(signedAccountId, derivationPath);

      setSenderAddress(publicKey);

      const balance = await solana.getBalance(publicKey);

      setStatus(
        `Your Solana address is:${publicKey}, balance: ${bigIntToDecimal(balance.balance,balance.decimals)} sol`
      );
    }
  }, [signedAccountId, derivationPath, setStatus]);

    async function chainSignature() {
      setStatus("🏗️ Creating transaction");
      
      const { transaction:{transaction} } = await solana.prepareTransactionForSigning({
        from: senderAddress,
        to: receiver,
        amount: decimalToBigInt(amount, 9),
      })

      setStatus(
        "🕒 Asking MPC to sign the transaction, this might take a while..."
      );

      try {
        const rsvSignatures = await callFunction({
          contractId: MPC_CONTRACT,
          method: "sign",
          args: {
            request: {
              payload_v2: { "Eddsa": uint8ArrayToHex(transaction.serializeMessage()) },
              path: derivationPath,
              domain_id: 1,
            },
          },
          gas: "250000000000000", // 250 Tgas
          deposit: 1,
        });

        if (!rsvSignatures || !rsvSignatures.signature) {
          throw new Error("Failed to sign transaction");
        }

        const txSerialized = solana.finalizeTransactionSigning({    
          transaction,
          rsvSignatures,
          senderAddress
        })
        await solana.broadcastTx(txSerialized);

        setStatus("✅ Signed payload ready to be relayed to the Solana network");
        setSignedTransaction(transaction.serialize().toString('base64'));
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
        "🔗 Relaying transaction to the Solana network... this might take a while"
      );
  
      try {
  
        const txHash = await solana.broadcastTx(signedTransaction);

        setStatus(
          <>
            <a
              href={`https://explorer.solana.com/tx/${txHash.hash}?cluster=devnet`}
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

  return (    <>
    <div className="alert alert-info text-center" role="alert">
      You are working with <strong>DevTest</strong>.
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
        <div className="form-text"> solana units </div>
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

SolanaView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
  }).isRequired,
};
