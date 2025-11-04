import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Web3 from "web3";
import { createPublicClient, http } from "viem";
import { chainAdapters } from "chainsig.js";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import type { Transaction, FinalExecutionOutcome } from "@near-wallet-selector/core";
import { bigIntToDecimal } from "../../utils/bigIntToDecimal";
import { TransferForm, TransferFormHandle } from "./Transfer";
import { FunctionCallForm, FunctionCallFormHandle } from "./FunctionCall";
import { SIGNET_CONTRACT, MPC_CONTRACT } from "../../config";

interface NetworkProps {
  network: string;
  token: string;
  rpcUrl: string;
  explorerUrl: string;
  contractAddress: string;
}

interface EVMViewProps {
  setStatus: (status: string | JSX.Element) => void;
  network: NetworkProps;
}

export function EVMView({ setStatus, network }: EVMViewProps) {
  const { signedAccountId, signAndSendTransactions: walletSignAndSendTransactions } = useWalletSelector();

  const signAndSendTransactions = async ({
    transactions,
  }: {
    transactions: Transaction[];
  }): Promise<FinalExecutionOutcome[]> => {
    return walletSignAndSendTransactions({ transactions });
  };

  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<"request" | "relay">("request");
  const [senderLabel, setSenderLabel] = useState("");
  const [senderAddress, setSenderAddress] = useState<string>("");
  const [balance, setBalance] = useState<string>("");
  const [action, setAction] = useState<"transfer" | "function-call">("transfer");
  const [derivationPath, setDerivationPath] = useState(
    `${network.network.replace(/\s/g, "").toLowerCase()}-1`
  );
  const [signedTransaction, setSignedTransaction] = useState<string | null>(null);
  const [gasPriceInGwei, setGasPriceInGwei] = useState<string>("");
  const [txCost, setTxCost] = useState<string>("");

  const childRef = useRef<TransferFormHandle & FunctionCallFormHandle>(null);
  const web3 = new Web3(network.rpcUrl);

  const publicClient = createPublicClient({ transport: http(network.rpcUrl) });
  
  const Evm = useMemo(() => 
    new chainAdapters.evm.EVM({ publicClient, contract: SIGNET_CONTRACT }),
    [publicClient]
  );

  // Fetch gas price
  useEffect(() => {
    async function fetchGasPrice() {
      try {
        const gasPriceInWei = await web3.eth.getGasPrice();
        const gasPriceGwei = web3.utils.fromWei(gasPriceInWei, "gwei");
        const gasLimit = 21000;
        const txCost = (Number(gasPriceGwei) * gasLimit) / 1e9;

        setGasPriceInGwei(Number(gasPriceGwei).toFixed(7));
        setTxCost(txCost.toFixed(7));
      } catch (err) {
        console.error(err);
      }
    }

    fetchGasPrice();
  }, [web3.eth, web3.utils]);

  const resetAddressState = useCallback(() => {
    setSenderLabel("Waiting for you to stop typing...");
    setSenderAddress("");
    setStatus("");
    setBalance("");
    setCurrentStep("request");
  }, [setStatus]);

  const fetchEthereumAddress = useCallback(async () => {
    const result = await Evm.deriveAddressAndPublicKey(
      signedAccountId!,
      derivationPath
    );
    const address = result.address;
    setSenderAddress(address);
    setSenderLabel(address);

    const balanceValue = (await Evm.getBalance(address)) as { balance: bigint; decimals: number };
    setBalance(bigIntToDecimal(balanceValue.balance, balanceValue.decimals));
  }, [Evm, signedAccountId, derivationPath]);

  // Fetch Ethereum address and balance
  useEffect(() => {
    resetAddressState();
    fetchEthereumAddress();
  }, [derivationPath, signedAccountId, resetAddressState, fetchEthereumAddress]);

  const chainSignature = async () => {
    setStatus("🏗️ Creating transaction");
    const { transaction, hashesToSign } = await childRef.current!.createTransaction();

    setStatus(`🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`);

    try {
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: hashesToSign,
        path: derivationPath,
        keyType: "Ecdsa",
        signerAccount: {
          accountId: signedAccountId!,
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           signAndSendTransactions: signAndSendTransactions as any,
        },
      });

      const finalizedTransaction = Evm.finalizeTransactionSigning({
        transaction,
        rsvSignatures,
      });

      setSignedTransaction(finalizedTransaction);
      setStatus(`✅ Signed payload ready to be relayed to the Ethereum network`);
      setCurrentStep("relay");
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`❌ Error: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  const relayTransaction = async () => {
    setIsLoading(true);
    setStatus("🔗 Relaying transaction to the Ethereum network... this might take a while");
    try {
      if (!signedTransaction) {
        throw new Error("No signed transaction available");
      }
      const txHash = await Evm.broadcastTx(signedTransaction);
      setStatus(
        <a href={`${network.explorerUrl}${txHash.hash}`} target="_blank" rel="noreferrer">
          ✅ Successful
        </a>
      );
      childRef.current!.afterRelay();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`❌ Error: ${errorMessage}`);
    }
    setCurrentStep("request");
    setIsLoading(false);
  };

  const UIChainSignature = async () => {
    setIsLoading(true);
    await chainSignature();
    setIsLoading(false);
  };

  return (
    <div>
      {/* PATH input */}
      <div className="input-group input-group-sm my-2 mb-2">
        <span className="input-group-text bg-primary text-white">PATH</span>
        <input
          type="text"
          className="form-control form-control-sm"
          value={derivationPath}
          onChange={(e) => setDerivationPath(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* Address & Balance */}
      <div className="card">
        <div className="row mb-0">
          <label className="col-sm-2 col-form-label text-end">Address:</label>
          <div className="col-sm-10 fs-5">
            <div className="form-text">{senderLabel}</div>
          </div>
        </div>
        <div className="row mb-0">
          <label className="col-sm-2 col-form-label text-end">Balance:</label>
          <div className="col-sm-10 fs-5">
            <div className="form-text text-muted">
              {balance ? `${balance} ${network.token}` : <span className="text-warning">Fetching balance...</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Action selector */}
      <div className="input-group input-group-sm my-2 mb-4">
        <span className="input-group-text bg-info text-white">ACTION</span>
        <select
          className="form-select"
          value={action}
          onChange={(e) => setAction(e.target.value as "transfer" | "function-call")}
          disabled={isLoading}
        >
          <option value="transfer">Ξ Transfer</option>
          <option value="function-call">Ξ Call Counter</option>
        </select>
      </div>

      {/* Forms */}
      {action === "transfer" ? (
        <TransferForm
          ref={childRef as React.RefObject<TransferFormHandle>}
          Evm={Evm}
          senderAddress={senderAddress}
          isLoading={isLoading}
          token={network.token}
        />
      ) : (
        <FunctionCallForm
          ref={childRef as React.RefObject<FunctionCallFormHandle>}
          contractAddress={network.contractAddress}
          senderAddress={senderAddress}
          rpcUrl={network.rpcUrl}
          isLoading={isLoading}
          Evm={Evm}
        />
      )}

      {/* Gas Table */}
      <div className="text-center d-flex justify-content-center">
        <div className="table-responsive" style={{ maxWidth: 400 }}>
          <table className="table table-hover text-center w-auto">
            <caption className="caption-top text-center">Sepolia Gas Prices</caption>
            <thead>
              <tr className="table-light">
                <th scope="col">Price</th>
                <th scope="col">Unit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{gasPriceInGwei}</td>
                <td>GWEI</td>
              </tr>
              <tr>
                <td>{txCost}</td>
                <td>{network.token}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Buttons */}
      <div className="d-grid gap-2">
        {currentStep === "request" && (
          <button className="btn btn-outline-success btn-lg" onClick={UIChainSignature} disabled={isLoading}>
            Request Signature
          </button>
        )}
        {currentStep === "relay" && (
          <button className="btn btn-success" onClick={relayTransaction} disabled={isLoading}>
            Relay Transaction
          </button>
        )}
      </div>
    </div>
  );
}
