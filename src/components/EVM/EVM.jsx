import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";

import { useDebounce } from "../../hooks/debounce";
import { TransferForm } from "./Transfer";
import { FunctionCallForm } from "./FunctionCall";
import Web3 from "web3";

import { SIGNET_CONTRACT, MPC_CONTRACT } from "../../config";
import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { chainAdapters } from "chainsig.js";
import { createPublicClient, http } from "viem";
import { bigIntToDecimal } from "../../utils/bigIntToDecimal";

export function EVMView({
  props: {
    setStatus,
    network: { network, token, rpcUrl, explorerUrl, contractAddress },
  },
}) {
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("request");
  const [senderLabel, setSenderLabel] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [balance, setBalance] = useState("");
  const [action, setAction] = useState("transfer");
  const [derivationPath, setDerivationPath] = useState(
    `${network.replace(/\s/g, "").toLowerCase()}-1`,
  );
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [gasPriceInGwei, setGasPriceInGwei] = useState("");
  const [txCost, setTxCost] = useState("");

  const debouncedDerivationPath = useDebounce(derivationPath, 1200);
  const childRef = useRef();
  const web3 = new Web3(rpcUrl);

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  const Evm = new chainAdapters.evm.EVM({
    publicClient,
    contract: SIGNET_CONTRACT,
  });

  useEffect(() => {
    async function fetchEthereumGasPrice() {
      try {
        // Fetch gas price in Wei
        const gasPriceInWei = await web3.eth.getGasPrice();

        // Convert gas price from Wei to Gwei
        const gasPriceInGwei = web3.utils.fromWei(gasPriceInWei, "gwei");

        // Gas limit for a standard ETH transfer
        const gasLimit = 21000;

        // Calculate transaction cost in ETH (gwei * gasLimit) / 1e9
        const txCost = (gasPriceInGwei * gasLimit) / 1000000000;

        // Format both gas price and transaction cost to 7 decimal places
        const formattedGasPriceInGwei = parseFloat(gasPriceInGwei).toFixed(7);
        const formattedTxCost = parseFloat(txCost).toFixed(7);

        console.log(
          `Current Sepolia Gas Price: ${formattedGasPriceInGwei} Gwei`,
        );
        console.log(`Estimated Transaction Cost: ${formattedTxCost} ${token}`);

        setTxCost(formattedTxCost);
        setGasPriceInGwei(formattedGasPriceInGwei);
      } catch (error) {
        console.error("Error fetching gas price:", error);
      }
    }

    fetchEthereumGasPrice();
  }, []);

  // Handle changes to derivation path and query Ethereum address and balance
  useEffect(() => {
    resetAddressState();
    fetchEthereumAddress();
  }, [debouncedDerivationPath, signedAccountId]);

  const resetAddressState = () => {
    setSenderLabel("Waiting for you to stop typing...");
    setSenderAddress(null);
    setStatus("");
    setBalance(""); // Reset balance when derivation path changes
    setCurrentStep("request");
  };

  const fetchEthereumAddress = async () => {
    const { address } = await Evm.deriveAddressAndPublicKey(
      signedAccountId,
      debouncedDerivationPath,
    );
    setSenderAddress(address);
    setSenderLabel(address);
    const balance = await Evm.getBalance(address);
    setBalance(bigIntToDecimal(balance.balance, balance.decimals));
  };

  async function chainSignature() {
    setStatus("🏗️ Creating transaction");

    const { transaction, hashesToSign } =
      await childRef.current.createTransaction();

    setStatus(
      `🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`,
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

      const finalizedTransaction = Evm.finalizeTransactionSigning({
        transaction,
        rsvSignatures,
      });

      setSignedTransaction(finalizedTransaction);

      setStatus(
        `✅ Signed payload ready to be relayed to the Ethereum network`,
      );
      setCurrentStep("relay");
    } catch (e) {
      console.log(e);
      setStatus(`❌ Error: ${e.message}`);
      setIsLoading(false);
    }
  }

  async function relayTransaction() {
    setIsLoading(true);
    setStatus(
      "🔗 Relaying transaction to the Ethereum network... this might take a while",
    );

    try {
      const transactionHash = await Evm.broadcastTx(signedTransaction);
      setStatus(
        <>
          <a href={`${explorerUrl}${transactionHash.hash}`} target="_blank">
            {" "}
            ✅ Successful{" "}
          </a>
        </>,
      );
      childRef.current.afterRelay();
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
    }

    setCurrentStep("request");
    setIsLoading(false);
  }

  const UIChainSignature = async () => {
    setIsLoading(true);
    await chainSignature();
    setIsLoading(false);
  };

  return (
    <div>
      {/* Form Inputs */}

      <div className="input-group input-group-sm my-2 mb-2">
        <span className="input-group-text bg-primary text-white" id="chain">
          PATH
        </span>
        <input
          type="text"
          className="form-control form-control-sm"
          value={derivationPath}
          onChange={(e) => setDerivationPath(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* ADDRESS & BALANCE */}
      <div className="card">
        <div className="row mb-0">
          <label className="col-sm-2 col-form-label text-end">Address:</label>
          <div className="col-sm-10 fs-5">
            <div className="form-text" id="eth-sender">
              {senderLabel}
            </div>
          </div>
        </div>
        <div className="row mb-0">
          <label className="col-sm-2 col-form-label text-end">Balance:</label>
          <div className="col-sm-10 fs-5">
            <div className="form-text text-muted ">
              {balance ? (
                `${balance} ${token}`
              ) : (
                <span className="text-warning">Fetching balance...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="input-group input-group-sm my-2 mb-4">
        <span className="input-group-text bg-info text-white" id="chain">
          ACTION
        </span>
        <select
          className="form-select"
          aria-describedby="chain"
          onChange={(e) => setAction(e.target.value)}
          disabled={isLoading}
        >
          <option value="transfer">Ξ Transfer</option>
          <option value="function-call">Ξ Call Counter</option>
        </select>
      </div>

      {action === "transfer" ? (
        <TransferForm
          ref={childRef}
          props={{ Evm, senderAddress, isLoading, token }}
        />
      ) : (
        <FunctionCallForm
          ref={childRef}
          props={{
            contractAddress,
            senderAddress,
            rpcUrl,
            web3,
            isLoading,
            Evm,
          }}
        />
      )}

      <div className="text-center d-flex justify-content-center">
        <div className="table-responsive " style={{ maxWidth: "400px" }}>
          <table className="table table-hover text-center w-auto">
            <caption className="caption-top text-center">
              Sepolia Gas Prices
            </caption>
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
                <td>{token}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Execute Buttons */}
      <div className="d-grid gap-2">
        {currentStep === "request" && (
          <button
            className="btn btn-outline-success text-center btn-lg"
            onClick={UIChainSignature}
            disabled={isLoading}
          >
            Request Signature
          </button>
        )}
        {currentStep === "relay" && (
          <button
            className="btn btn-success text-center"
            onClick={relayTransaction}
            disabled={isLoading}
          >
            Relay Transaction
          </button>
        )}
      </div>
    </div>
  );
}

EVMView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
    network: PropTypes.shape({
      network: PropTypes.string.isRequired,
      token: PropTypes.string.isRequired,
      rpcUrl: PropTypes.string.isRequired,
      explorerUrl: PropTypes.string.isRequired,
      contractAddress: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
