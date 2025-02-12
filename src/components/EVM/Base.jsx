import { useState, useEffect, useContext, useRef } from "react";
import PropTypes from "prop-types";

import { NearContext } from "../../context";
import { useDebounce } from "../../hooks/debounce";
import { getTransactionHashes } from "../../services/utils";
import { TransferForm } from "./Transfer";
import { FunctionCallForm } from "./FunctionCall";
import { EthereumVM } from "../../services/evm";

const Evm = new EthereumVM("https://base-sepolia.drpc.org");

const contractAddress = "0xCd3b988b216790C598d9AB85Eee189e446CE526D";

const transactions = getTransactionHashes();

export function BaseView({ props: { setStatus, MPC_CONTRACT } }) {
  const { wallet, signedAccountId } = useContext(NearContext);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(transactions ? "relay" : "request");
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [senderLabel, setSenderLabel] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [balance, setBalance] = useState(""); // Add balance state
  const [action, setAction] = useState("transfer");
  const [derivation, setDerivation] = useState(
    sessionStorage.getItem("derivation") || "ethereum-1"
  );
  const [reloaded, setReloaded] = useState(transactions.length);

  const [gasPriceInGwei, setGasPriceInGwei] = useState("");
  const [txCost, setTxCost] = useState("");

  const derivationPath = useDebounce(derivation, 1200);
  const childRef = useRef();

  useEffect(() => {
    async function fetchEthereumGasPrice() {
      try {
        // Fetch gas price in Wei
        const gasPriceInWei = await Evm.web3.eth.getGasPrice();

        // Convert gas price from Wei to Gwei
        const gasPriceInGwei = Evm.web3.utils.fromWei(gasPriceInWei, "gwei");

        // Gas limit for a standard ETH transfer
        const gasLimit = 21000;

        // Calculate transaction cost in ETH (gwei * gasLimit) / 1e9
        const txCost = (gasPriceInGwei * gasLimit) / 1000000000;

        // Format both gas price and transaction cost to 7 decimal places
        const formattedGasPriceInGwei = parseFloat(gasPriceInGwei).toFixed(7);
        const formattedTxCost = parseFloat(txCost).toFixed(7);

        console.log(
          `Current Sepolia Gas Price: ${formattedGasPriceInGwei} Gwei`
        );
        console.log(`Estimated Transaction Cost: ${formattedTxCost} ETH`);

        setTxCost(formattedTxCost);
        setGasPriceInGwei(formattedGasPriceInGwei);
      } catch (error) {
        console.error("Error fetching gas price:", error);
      }
    }

    fetchEthereumGasPrice();
  }, []);

  // Handle signing transaction when the page is reloaded and senderAddress is set
  useEffect(() => {
    if (reloaded && senderAddress) {
      signTransaction();
    }

    async function signTransaction() {
      const { big_r, s, recovery_id } = await wallet.getTransactionResult(
        transactions[0]
      );
      const signedTransaction = await Evm.reconstructSignedTXFromLocalSession(
        big_r,
        s,
        recovery_id,
        senderAddress
      );

      setSignedTransaction(signedTransaction);
      setStatus(
        "✅ Signed payload ready to be relayed to the Base network"
      );
      setStep("relay");

      setReloaded(false);
      removeUrlParams();
    }
  }, [senderAddress, reloaded, wallet, setStatus]);

  // Handle changes to derivation path and query Base address and balance
  useEffect(() => {
    resetAddressState();
    fetchEthereumAddress();
  }, [derivationPath, signedAccountId]);

  const resetAddressState = () => {
    setSenderLabel("Waiting for you to stop typing...");
    setSenderAddress(null);
    setStatus("");
    setBalance(""); // Reset balance when derivation path changes
    setStep("request");
  };

  const fetchEthereumAddress = async () => {
    const { address } = await Evm.deriveAddress(
      signedAccountId,
      derivationPath
    );
    setSenderAddress(address);
    setSenderLabel(address);

    if (!reloaded) {
      const balance = await Evm.getBalance(address);
      setBalance(balance); // Update balance state
    }
  };
  
  async function chainSignature() {
    setStatus("🏗️ Creating transaction");

    const { transaction } = await childRef.current.createTransaction();

    setStatus(
      `🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`
    );
    try {
      // to reconstruct on reload
      sessionStorage.setItem("derivation", derivationPath);

      const { big_r, s, recovery_id } = await Evm.requestSignatureToMPC({
        wallet,
        path: derivationPath,
        transaction,
      });
      const signedTransaction = await Evm.reconstructSignedTransaction(
        big_r,
        s,
        recovery_id,
        transaction
      );

      setSignedTransaction(signedTransaction);
      setStatus(
        `✅ Signed payload ready to be relayed to the Base network`
      );
      setStep("relay");
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
      setLoading(false);
    }
  }

  async function relayTransaction() {
    setLoading(true);
    setStatus(
      "🔗 Relaying transaction to the Base network... this might take a while"
    );

    try {
      const txHash = await Evm.broadcastTX(signedTransaction);
      setStatus(
        <>
          <a href={`https://base-sepolia.blockscout.com/tx/${txHash}`} target="_blank">
            {" "}
            ✅ Successful{" "}
          </a>
        </>
      );
      childRef.current.afterRelay();
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

  function removeUrlParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete("transactionHashes");
    window.history.replaceState({}, document.title, url);
  }

  return (
    <>
      {/* Form Inputs */}
      <div className="row mb-0">
        <label className="col-sm-2 col-form-label"></label>
        <div className="col-sm-10"></div>
      </div>

      <div className="input-group input-group-sm my-2 mb-2">
        <span className="input-group-text bg-primary text-white" id="chain">
          PATH
        </span>
        <input
          type="text"
          className="form-control form-control-sm"
          value={derivation}
          onChange={(e) => setDerivation(e.target.value)}
          disabled={loading}
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
                `${balance} ETH`
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
          disabled={loading}
        >
          <option value="transfer">Ξ Transfer</option>
          <option value="function-call">Ξ Call Counter</option>
        </select>
      </div>

      {action === "transfer" ? (
        <TransferForm ref={childRef} props={{ Evm, senderAddress, loading }} />
      ) : (
        <FunctionCallForm
          ref={childRef}
          props={{ Evm, contractAddress, senderAddress, loading }}
        />
      )}

      <div className="text-center mt-4 d-flex justify-content-center">
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
                <td>ETH</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Execute Buttons */}
      <div className="d-grid gap-2">
        {step === "request" && (
          <button
            className="btn btn-outline-success text-center btn-lg"
            onClick={UIChainSignature}
            disabled={loading}
          >
            Request Signature
          </button>
        )}
        {step === "relay" && (
          <button
            className="btn btn-success text-center"
            onClick={relayTransaction}
            disabled={loading}
          >
            Relay Transaction
          </button>
        )}
      </div>
    </>
  );
}

BaseView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
    MPC_CONTRACT: PropTypes.string.isRequired,
  }).isRequired,
};
