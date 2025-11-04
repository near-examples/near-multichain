import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/debounce";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { SIGNET_CONTRACT } from "../config";
import { chainAdapters } from "chainsig.js";
import { Connection as SolanaConnection } from "@solana/web3.js";
import { bigIntToDecimal } from "../utils/bigIntToDecimal";
import { decimalToBigInt } from "../utils/decimalToBigInt";
import { StatusSetter } from "../types/StatusSetter";

const connection = new SolanaConnection("https://api.devnet.solana.com");

const Solana = new chainAdapters.solana.Solana({
  solanaConnection: connection,
  contract: SIGNET_CONTRACT,
});

export const SolanaView: React.FC<StatusSetter> = ({ setStatus }) => {
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  const [receiverAddress, setReceiverAddress] = useState<string>(
    "G58AYKiiNy7wwjPAeBAQWTM6S1kJwP3MQ3wRWWhhSJxA"
  );
  const [transferAmount, setTransferAmount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<"request" | "relay">("request");
  const [signedTransaction, setSignedTransaction] = useState<string | null>(null);
  const [senderAddress, setSenderAddress] = useState<string>("");
  const [derivationPath, setDerivationPath] = useState<string>("solana-1");
  const debouncedDerivationPath = useDebounce(derivationPath, 500);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivationPath]);

  useEffect(() => {
    if (!signedAccountId) return;

    const setSolanaAddress = async () => {
      setStatus("Querying your address and balance");
      setSenderAddress(`Deriving address from path ${debouncedDerivationPath}...`);

      const { publicKey } = await Solana.deriveAddressAndPublicKey(
        signedAccountId,
        debouncedDerivationPath
      );
      setSenderAddress(publicKey);

      const balance = await Solana.getBalance(publicKey);
      setStatus(
        `Your Solana address is: ${publicKey}, balance: ${bigIntToDecimal(
          balance.balance,
          balance.decimals
        )} SOL`
      );
    };

    setSolanaAddress();
  }, [signedAccountId, debouncedDerivationPath, setStatus]);

  const handleChainSignature = async () => {
    if (!signedAccountId) return;
    setStatus("🏗️ Creating transaction");

    const {
      transaction: { transaction },
    } = await Solana.prepareTransactionForSigning({
      from: senderAddress,
      to: receiverAddress,
      amount: decimalToBigInt(transferAmount, 9),
    });

    setStatus("🕒 Asking MPC to sign the transaction...");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: [transaction.serializeMessage()],
        path: debouncedDerivationPath,
        keyType: "Eddsa",
        signerAccount: {
          accountId: signedAccountId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signAndSendTransactions: signAndSendTransactions as any,
        },
      });

      const finalizedTransaction = Solana.finalizeTransactionSigning({
        transaction,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rsvSignatures: rsvSignatures[0] as any,
        senderAddress,
      });

      setSignedTransaction(finalizedTransaction);
      setStatus("✅ Signed payload ready to be relayed to the Solana network");
      setCurrentStep("relay");
    } catch (error) {
      console.error(error);
      setStatus(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
    }
  };

  const handleRelayTransaction = async () => {
    if (!signedTransaction) {
      setStatus("❌ Error: No signed transaction available");
      return;
    }

    setIsLoading(true);
    setStatus("🔗 Relaying transaction to the Solana network...");

    try {
      const transactionHash = await Solana.broadcastTx(signedTransaction);
      setStatus(
        <a
          href={`https://explorer.solana.com/tx/${transactionHash.hash}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
        >
          ✅ Successfully Broadcasted
        </a>
      );
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    setCurrentStep("request");
    setIsLoading(false);
  };

  const handleUIChainSignature = async () => {
    setIsLoading(true);
    await handleChainSignature();
    setIsLoading(false);
  };

  return (
    <>
      <div className="alert alert-info text-center">
        You are working with <strong>DevNet</strong>.
        <br />
        Faucet:{" "}
        <a href="https://faucet.solana.com/" target="_blank" rel="noopener noreferrer">
          faucet.solana.com
        </a>
      </div>

      <div className="row my-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">Path:</label>
        <div className="col-sm-10">
          <input
            type="text"
            className="form-control form-control-sm"
            value={derivationPath}
            onChange={(e) => setDerivationPath(e.target.value)}
            disabled={isLoading}
          />
          <div className="form-text">{senderAddress}</div>
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
        <label className="col-sm-2 col-form-label col-form-label-sm">Amount:</label>
        <div className="col-sm-10">
          <div className="input-group">
            <input
              type="number"
              className="form-control form-control-sm"
              value={transferAmount}
              onChange={(e) => setTransferAmount(Number(e.target.value))}
              step={0.1}
              min={0}
              disabled={isLoading}
            />
            <span className="input-group-text bg-primary text-white fw-bold">SOL</span>
          </div>
        </div>
      </div>

      <div className="text-center mt-3">
        {currentStep === "request" && (
          <button className="btn btn-primary" onClick={handleUIChainSignature} disabled={isLoading}>
            Request Signature
          </button>
        )}
        {currentStep === "relay" && (
          <button className="btn btn-success" onClick={handleRelayTransaction} disabled={isLoading}>
            Relay Transaction
          </button>
        )}
      </div>
    </>
  );
};
