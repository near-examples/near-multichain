import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/debounce";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { SIGNET_CONTRACT } from "../config";
import { chainAdapters } from "chainsig.js";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { bigIntToDecimal } from "../utils/bigIntToDecimal";
import { decimalToBigInt } from "../utils/decimalToBigInt";
import { StatusSetter } from "../types/StatusSetter";

const rpcUrl = getFullnodeUrl("testnet");
const suiClient = new SuiClient({ url: rpcUrl });
const Sui = new chainAdapters.sui.SUI({
  client: suiClient,
  contract: SIGNET_CONTRACT,
  rpcUrl,
});

export const SuiView: React.FC<StatusSetter> = ({ setStatus }) => {
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  const [receiverAddress, setReceiverAddress] = useState(
    "0x202fc1c421cbd6d84d632d62de50b90c1cf5564c36422a1cd00b5448b9e3d29f"
  );
  const [transferAmount, setTransferAmount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<"request" | "relay">("request");
  const [signedTransaction, setSignedTransaction] = useState<string | null>(null);
  const [senderAddress, setSenderAddress] = useState("");
  const [senderPublicKey, setSenderPublicKey] = useState("");

  const [derivationPath, setDerivationPath] = useState("sui-1");
  const debouncedDerivationPath = useDebounce(derivationPath, 500);

  useEffect(() => {
    setSenderAddress("Waiting for you to stop typing...");
  }, [derivationPath]);

  useEffect(() => {
    if (!signedAccountId) return;

    async function setSuiAddress() {
      setStatus("Querying your address and balance");
      setSenderAddress(`Deriving address from path ${debouncedDerivationPath}...`);

      const { address, publicKey } = await Sui.deriveAddressAndPublicKey(
        signedAccountId as string,
        debouncedDerivationPath
      );

      setSenderAddress(address);
      setSenderPublicKey(publicKey);

      const balance = await Sui.getBalance(address);
      setStatus(
        `Your Sui address is: ${address}, balance: ${bigIntToDecimal(balance.balance, balance.decimals)} SUI`
      );
    }

    setSuiAddress();
  }, [signedAccountId, debouncedDerivationPath, setStatus]);

  const handleChainSignature = async () => {
    if (!signedAccountId) return;

    setStatus("🏗️ Creating transaction");

    const transactionSui = new Transaction();
    const [coin] = transactionSui.splitCoins(transactionSui.gas, [
      decimalToBigInt(transferAmount, 9),
    ]);
    transactionSui.transferObjects([coin], receiverAddress);
    transactionSui.setSender(senderAddress);

    const { hashesToSign, transaction } = await Sui.prepareTransactionForSigning(transactionSui);

    setStatus("🕒 Asking MPC to sign the transaction...");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: hashesToSign,
        path: debouncedDerivationPath,
        keyType: "Eddsa",
        signerAccount: {
          accountId: signedAccountId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signAndSendTransactions: async (transactions: { transactions: any[] }) => {
            const txs = transactions.transactions.map((tx) => ({
              ...tx,
              signerId: tx.signerId || signedAccountId,
            }));
            return signAndSendTransactions({ transactions: txs });
          },
        },
      });

      const finalizedTransaction = Sui.finalizeTransactionSigning({
        transaction,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rsvSignatures: rsvSignatures[0] as any,
        publicKey: senderPublicKey,
      });

      setSignedTransaction(finalizedTransaction);
      setStatus("✅ Signed payload ready to be relayed to the Sui network");
      setCurrentStep("relay");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setStatus(`❌ Error: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  const handleRelayTransaction = async () => {
    if (!signedTransaction) {
      setStatus("❌ Error: No signed transaction available");
      return;
    }

    setIsLoading(true);
    setStatus("🔗 Relaying transaction to the Sui network...");

    try {
      const transactionHash = await Sui.broadcastTx(signedTransaction);
      setStatus(
        <a
          href={`https://suiscan.xyz/testnet/tx/${transactionHash.hash}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          ✅ Successfully Broadcasted
        </a>
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setStatus(`❌ Error: ${errorMessage}`);
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
        You are working with <strong>Testnet</strong>.
        <br />
        Faucet:
        <a href="https://faucet.sui.io/" target="_blank" rel="noopener noreferrer">
          faucet.sui.io
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
            <span className="input-group-text bg-primary text-white fw-bold">SUI</span>
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
