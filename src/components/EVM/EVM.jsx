/**
 * ETHEREUM VIRTUAL MACHINE (EVM) TRANSACTION COMPONENT
 * 
 * This component demonstrates how to use NEAR Protocol's Multi-Party Computation (MPC)
 * service to interact with EVM-compatible blockchains (Ethereum, Polygon, BSC, etc.).
 * Unlike Bitcoin's UTXO model or Solana's simple account model, EVM supports:
 * - Smart contracts with complex state
 * - Gas-based transaction pricing
 * - Multiple transaction types (transfers, contract calls)
 * 
 * KEY CONCEPTS DEMONSTRATED:
 * - EVM address derivation from NEAR accounts
 * - Gas price estimation and transaction cost calculation
 * - Two-phase transaction execution (sign → broadcast)
 * - Dynamic form switching between transfers and contract calls
 * - Real-time balance monitoring
 * - Integration with Web3 libraries (web3.js and viem)
 * 
 * EVM ARCHITECTURE HIGHLIGHTS:
 * - Account-based model with nonces (prevents replay attacks)
 * - Gas system for computational resource management
 * - Smart contract interaction via encoded function calls
 * - Deterministic address generation from public keys
 */

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
  props: { setStatus, rpcUrl, contractAddress, explorerUrl },
}) {
  // NEAR Wallet Integration for MPC signing
  const { signedAccountId, signAndSendTransactions } = useWalletSelector();

  // COMPONENT STATE MANAGEMENT
  const [loading, setLoading] = useState(false);               // Global loading state
  const [step, setStep] = useState("request");                 // Transaction flow: "request" → "relay"
  const [senderLabel, setSenderLabel] = useState("");          // Display label for sender address
  const [senderAddress, setSenderAddress] = useState("");      // Derived EVM address
  const [balance, setBalance] = useState("");                  // ETH balance for current address
  const [action, setAction] = useState("transfer");            // Current action: "transfer" or "function-call"
  const [derivation, setDerivation] = useState("ethereum-1");  // Derivation path for address generation
  const [signedTransaction, setSignedTransaction] = useState(null); // Holds signed transaction
  const [gasPriceInGwei, setGasPriceInGwei] = useState("");   // Current network gas price
  const [txCost, setTxCost] = useState("");                   // Estimated transaction cost

  /**
   * DEBOUNCED DERIVATION PATH
   * 
   * Using a longer debounce (1200ms) for EVM because:
   * - Address derivation involves more computation
   * - Balance queries can be slower on congested networks
   * - We want to avoid overwhelming the RPC endpoints
   */
  const derivationPath = useDebounce(derivation, 1200);
  
  /**
   * CHILD COMPONENT REFERENCE
   * 
   * This ref allows us to call methods on the currently active form
   * (TransferForm or FunctionCallForm) to create transactions.
   * This pattern enables dynamic switching between different transaction types
   * while maintaining a consistent parent interface.
   */
  const childRef = useRef();
  
  /**
   * WEB3 AND VIEM CLIENT SETUP
   * 
   * We use both Web3.js and Viem for different purposes:
   * - Web3.js: Gas price estimation, unit conversions, utilities
   * - Viem: Modern TypeScript-first client for blockchain interactions
   * 
   * This demonstrates how different libraries can complement each other
   * in a Web3 application stack.
   */
  const web3 = new Web3(rpcUrl);

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  /**
   * EVM CHAIN ADAPTER INITIALIZATION
   * 
   * The EVM adapter handles Ethereum-compatible blockchain operations:
   * - Address derivation using secp256k1 curve (same as Bitcoin but different usage)
   * - Transaction construction with proper nonce management
   * - Gas estimation and fee calculation
   * - Smart contract interaction encoding
   */
  const Evm = (new chainAdapters.evm.EVM({
    publicClient,           // Viem client for blockchain interactions
    contract: SIGNET_CONTRACT // NEAR MPC contract for ECDSA signing
  }));

  /**
   * GAS PRICE MONITORING AND COST ESTIMATION
   * 
   * This effect runs once on component mount to fetch current network conditions.
   * Understanding gas is crucial for EVM interactions because:
   * - Gas prices fluctuate based on network demand
   * - Users need to know transaction costs upfront
   * - Failed transactions still consume gas
   * - Different operations have different gas requirements
   */
  useEffect(() => {
    async function fetchEthereumGasPrice() {
      try {
        /**
         * GAS PRICE RETRIEVAL
         * 
         * Gas price is returned in Wei (smallest ETH unit: 1 ETH = 10^18 Wei)
         * We convert to Gwei (1 Gwei = 10^9 Wei) for human readability
         * since gas prices are typically quoted in Gwei.
         */
        // Fetch gas price in Wei
        const gasPriceInWei = await web3.eth.getGasPrice();

        // Convert gas price from Wei to Gwei
        const gasPriceInGwei = web3.utils.fromWei(gasPriceInWei, "gwei");

        /**
         * TRANSACTION COST ESTIMATION
         * 
         * For a simple ETH transfer:
         * - Gas limit: 21,000 units (fixed for basic transfers)
         * - Total cost = gas price × gas limit
         * 
         * For contract calls, gas limits vary based on contract complexity.
         */
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

  /**
   * ADDRESS DERIVATION AND BALANCE MONITORING
   * 
   * This effect runs whenever the derivation path or account changes.
   * It demonstrates the complete EVM address lifecycle:
   * 1. Reset UI state
   * 2. Derive new address from NEAR account + path
   * 3. Fetch balance from blockchain
   * 4. Update UI with results
   */
  // Handle changes to derivation path and query Ethereum address and balance
  useEffect(() => {
    resetAddressState();
    fetchEthereumAddress();
  }, [derivationPath, signedAccountId]);

  /**
   * UI STATE RESET HELPER
   * 
   * When switching derivation paths, we need to clear previous state
   * to avoid showing stale information to users.
   */
  const resetAddressState = () => {
    setSenderLabel("Waiting for you to stop typing...");
    setSenderAddress(null);
    setStatus("");
    setBalance(""); // Reset balance when derivation path changes
    setStep("request");
  };

  /**
   * EVM ADDRESS DERIVATION AND BALANCE FETCHING
   * 
   * This function showcases how MPC works with EVM:
   * 1. Generate deterministic address from NEAR account + derivation path
   * 2. Query the EVM network for current balance
   * 3. Update UI with address and balance information
   */
  const fetchEthereumAddress = async () => {
    /**
     * ADDRESS DERIVATION PROCESS
     * 
     * The MPC service generates an Ethereum address by:
     * - Creating a secp256k1 public key from NEAR account + derivation path
     * - Hashing the public key with Keccak-256
     * - Taking the last 20 bytes as the Ethereum address
     * 
     * This follows Ethereum's standard address generation algorithm.
     */
    const { address } = await Evm.deriveAddressAndPublicKey(
      signedAccountId,
      derivationPath
    );
    setSenderAddress(address);
    setSenderLabel(address);
    
    /**
     * BALANCE QUERY
     * 
     * EVM networks store account balances in the blockchain state.
     * The balance is returned in Wei and converted to ETH for display.
     */
    const balance = await Evm.getBalance(address);
    setBalance(bigIntToDecimal(balance.balance, balance.decimals));
  };

  /**
   * TRANSACTION CREATION AND SIGNING PROCESS
   * 
   * This function orchestrates the complete EVM transaction flow:
   * 1. Create transaction via child component (Transfer or FunctionCall)
   * 2. Generate transaction hash for signing
   * 3. Request MPC signature using ECDSA
   * 4. Finalize transaction with signature
   */
  async function chainSignature() {
    setStatus("🏗️ Creating transaction");

    /**
     * DYNAMIC TRANSACTION CREATION
     * 
     * We use the ref pattern to call the appropriate child component's
     * createTransaction method. This allows us to support different
     * transaction types (transfers, contract calls) with the same flow.
     */
    const { transaction, hashesToSign } = await childRef.current.createTransaction();

    setStatus(
      `🕒 Asking ${MPC_CONTRACT} to sign the transaction, this might take a while`
    );

    try {

      /**
       * MPC SIGNING WITH ECDSA
       * 
       * EVM uses ECDSA signatures (same as Bitcoin) but in a different format:
       * - Bitcoin: DER-encoded signatures
       * - Ethereum: Raw r, s, v values for efficient verification
       * 
       * The v value includes chain ID to prevent cross-chain replay attacks.
       */
      const rsvSignatures = await SIGNET_CONTRACT.sign({
        payloads: hashesToSign,      // Transaction hash(es) to sign
        path: derivationPath,        // Derivation path for key generation
        keyType: "Ecdsa",           // ECDSA signature scheme (same as Bitcoin)
        signerAccount: { 
          accountId: signedAccountId,
          signAndSendTransactions 
        }
      });
      
      /**
       * TRANSACTION FINALIZATION
       * 
       * With the ECDSA signature, we can now:
       * - Attach the signature (r, s, v) to the transaction
       * - Serialize the complete transaction for broadcasting
       * - Prepare it for submission to EVM validators
       */
      const txSerialized = Evm.finalizeTransactionSigning({
        transaction,
        rsvSignatures,
      })

      setSignedTransaction(txSerialized);

      setStatus(
        `✅ Signed payload ready to be relayed to the Ethereum network`
      );
      setStep("relay");
    } catch (e) {
      console.log(e);
      setStatus(`❌ Error: ${e.message}`);
      setLoading(false);
    }
  }

  /**
   * TRANSACTION BROADCASTING TO EVM NETWORK
   * 
   * Once we have a signed transaction, we broadcast it to EVM validators.
   * EVM networks typically have faster confirmation than Bitcoin but
   * slower than Solana, with confirmation times varying by network congestion.
   */
  async function relayTransaction() {
    setLoading(true);
    setStatus(
      "🔗 Relaying transaction to the Ethereum network... this might take a while"
    );

    try {
      /**
       * BROADCAST TO EVM VALIDATORS
       * 
       * The signed transaction is sent to EVM validators who will:
       * - Validate transaction format and signature
       * - Check sender balance and nonce
       * - Execute the transaction (transfer or contract call)
       * - Include it in the next block
       * - Confirm the transaction (typically 12-20 seconds on Ethereum)
       */
      const txHash = await Evm.broadcastTx(signedTransaction);
      setStatus(
        <>
          <a href={`${explorerUrl}${txHash.hash}`} target="_blank">
            {" "}
            ✅ Successful{" "}
          </a>
        </>
      );
      
      /**
       * POST-TRANSACTION CLEANUP
       * 
       * After successful broadcast, we call the child component's
       * afterRelay method to handle any post-transaction updates
       * (like refreshing contract state).
       */
      childRef.current.afterRelay();
    } catch (e) {
      setStatus(`❌ Error: ${e.message}`);
    }

    // Reset UI state for next transaction
    setStep("request");
    setLoading(false);
  }

  /**
   * UI HANDLER FOR SIGNATURE INITIATION
   * 
   * Wrapper function to manage loading state during signature process.
   */
  const UIChainSignature = async () => {
    setLoading(true);
    await chainSignature();
    setLoading(false);
  };

  /**
   * COMPONENT RENDER
   * 
   * The UI provides:
   * - Derivation path input for address generation
   * - Real-time address and balance display
   * - Action selector (transfer vs contract call)
   * - Dynamic form rendering based on selected action
   * - Gas price information table
   * - Two-step execution buttons (sign → relay)
   */
  return (
    <>
      {/* EMPTY ROW FOR SPACING */}
      <div className="row mb-0">
        <label className="col-sm-2 col-form-label"></label>
        <div className="col-sm-10"></div>
      </div>

      {/* DERIVATION PATH INPUT */}
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

      {/* ADDRESS & BALANCE DISPLAY CARD */}
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

      {/* ACTION SELECTOR - TRANSFER VS CONTRACT CALL */}
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

      {/* DYNAMIC FORM RENDERING BASED ON SELECTED ACTION */}
      {action === "transfer" ? (
        <TransferForm ref={childRef} props={{ Evm, senderAddress, loading }} />
      ) : (
        <FunctionCallForm
          ref={childRef}
          props={{ contractAddress, senderAddress, rpcUrl, web3, loading, Evm }}
        />
      )}

      {/* GAS PRICE INFORMATION TABLE */}
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

      {/* EXECUTION BUTTONS - TWO-STEP PROCESS */}
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

// PropTypes for development-time type checking and documentation
EVMView.propTypes = {
  props: PropTypes.shape({
    setStatus: PropTypes.func.isRequired,
    rpcUrl: PropTypes.string.isRequired,
    contractAddress: PropTypes.string.isRequired,
    explorerUrl: PropTypes.string.isRequired,
  }).isRequired,
};
