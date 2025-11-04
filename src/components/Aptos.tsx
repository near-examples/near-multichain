import { useEffect, useState } from "react";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { SIGNET_CONTRACT } from "../config";
import { chainAdapters } from "chainsig.js";
import { useDebounce } from "../hooks/debounce";
import { bigIntToDecimal } from "../utils/bigIntToDecimal";
import { decimalToBigInt } from "../utils/decimalToBigInt";
import { Aptos as AptosClient, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { StatusSetter } from "../types/StatusSetter";

const aptosClient = new AptosClient(
  new AptosConfig({
    network: Network.TESTNET,
  }),
);

const Aptos = new chainAdapters.aptos.Aptos({
  client: aptosClient,
  contract: SIGNET_CONTRACT,
});

export function AptosView({ setStatus }: StatusSetter) {
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  const [receiverAddress, setReceiverAddress] = useState<string>(
    "0x3b0c3efaa16f5c7c53d3ca9c12622c90542ff36485f7f713ba8e76756a3fbbea",
  );
  const [transferAmount, setTransferAmount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<"request" | "relay">("request");
  const [signedTransaction, setSignedTransaction] = useState<string | null>(null);
  const [senderAddress, setSenderAddress] = useState<string>("");
  const [senderPublicKey, setSenderPublicKey] = useState<string>("");

  const [derivationPath, setDerivationPath] = useState<string>("aptos-1");
  const debouncedDerivationPath = useDebounce(derivationPath, 500);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivationPath]);

  useEffect(() => {
    if (!signedAccountId) return;
    setAptosAddress();

    async function setAptosAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(`Deriving address from path ${debouncedDerivationPath}...`);

      const { address, publicKey } = await Aptos.deriveAddressAndPublicKey(
        signedAccountId as string,
        debouncedDerivationPath,
      );

      setSenderAddress(address);
      setSenderPublicKey(publicKey);

      const balance = await Aptos.getBalance(address);

      setStatus(
        `Your Aptos address is: ${address}, balance: ${bigIntToDecimal(balance.balance, balance.decimals)} APT`,
      );
    }
  }, [signedAccountId, debouncedDerivationPath, setStatus]);

  async function handleChainSignature() {
    if (!senderAddress) {
      setStatus("❌ Sender address not ready yet");
      return;
    }

    setStatus("🏗️ Creating transaction");

    const transaction = await aptosClient.transaction.build.simple({
      sender: senderAddress,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [receiverAddress, decimalToBigInt(transferAmount, 8)],
      },
    });

    const { hashesToSign } = await Aptos.prepareTransactionForSigning(transaction);
    setStatus("🕒 Asking MPC to sign the transaction, this might take a while...");

    try {
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: hashesToSign,
        path: debouncedDerivationPath,
        keyType: "Eddsa",
        signerAccount: {
          accountId: signedAccountId!,
          // @ts-expect-error - Type incompatibility between wallet selector and chainsig.js
          signAndSendTransactions,
        },
      });

      // ✅ force-cast RSVSignature to expected Aptos SDK Signature
      const finalizedTransaction = Aptos.finalizeTransactionSigning({
        transaction,
        rsvSignatures: {
          scheme: "ed25519",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signature: (rsvSignatures[0] as any).signature ?? "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        },
        publicKey: senderPublicKey,
      });

      setSignedTransaction(finalizedTransaction);
      setStatus("✅ Signed payload ready to be relayed to the Aptos network");
      setCurrentStep("relay");
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setStatus(`❌ Error: ${errorMessage}`);
      setIsLoading(false);
    }
  }

  async function handleRelayTransaction() {
    setIsLoading(true);
    setStatus("🔗 Relaying transaction to the Aptos network...");

    try {
      if (!signedTransaction) {
        throw new Error("No signed transaction available");
      }
      
      const transactionHash = await Aptos.broadcastTx(signedTransaction);

      setStatus(
        <>
          <a
            href={`https://explorer.aptoslabs.com/txn/${transactionHash.hash}?network=testnet`}
            target="_blank"
            rel="noopener noreferrer"
          >
            ✅ Successfully Broadcasted
          </a>
        </>,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("TRANSACTION_EXPIRED")) {
        setStatus("⏰ Transaction expired, creating a new one...");
        setCurrentStep("request");
        setIsLoading(false);
        return;
      }
      setStatus(`❌ Error: ${errorMessage}`);
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
        You are working with <strong>Aptos Testnet</strong>.
        <br />
        You can get funds from the faucet:{" "}
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
        <label className="col-sm-2 col-form-label col-form-label-sm">Path:</label>
        <div className="col-sm-10">
          <input
            type="text"
            className="form-control form-control-sm"
            value={derivationPath}
            onChange={(e) => setDerivationPath(e.target.value)}
            disabled={isLoading}
          />
          <div className="form-text" id="apt-sender">
            {senderAddress}
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
        <label className="col-sm-2 col-form-label col-form-label-sm">Amount:</label>
        <div className="col-sm-10">
          <div className="input-group">
            <input
              type="number"
              className="form-control form-control-sm"
              value={transferAmount}
              onChange={(e) => setTransferAmount(Number(e.target.value))}
              step="0.1"
              min="0"
              disabled={isLoading}
            />
            <span className="input-group-text bg-primary text-white fw-bold">APT</span>
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
            Request Signature
          </button>
        )}
        {currentStep === "relay" && (
          <button
            className="btn btn-success text-center"
            onClick={handleRelayTransaction}
            disabled={isLoading}
          >
            Relay Transaction
          </button>
        )}
      </div>
    </>
  );
}
