/**
 * SMART CONTRACT FUNCTION CALL COMPONENT
 * 
 * This component demonstrates how to interact with smart contracts on EVM-compatible
 * blockchains using NEAR's MPC service. Unlike simple ETH transfers, smart contract
 * interactions require:
 * - ABI (Application Binary Interface) encoding for function calls
 * - Gas estimation based on contract complexity
 * - State reading and writing operations
 * - Event emission and monitoring
 * 
 * KEY CONCEPTS DEMONSTRATED:
 * - Contract ABI interaction and function encoding
 * - State reading vs state changing operations (view vs payable functions)
 * - Gas estimation for contract calls
 * - Dynamic UI updates based on contract state
 * - Error handling for contract execution failures
 * 
 * SMART CONTRACT FUNDAMENTALS:
 * - Contracts have addresses like regular accounts
 * - Functions can be read-only (view) or state-changing (payable/non-payable)
 * - Each function call costs gas based on computational complexity
 * - Contract state persists between function calls
 * - Events provide a way to log contract activity
 */

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { forwardRef, useImperativeHandle } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import { ABI } from "../../config";

/**
 * SIMPLE COUNTER CONTRACT ABI
 * 
 * Application Binary Interface (ABI) defines how to interact with a smart contract.
 * It specifies:
 * - Function names and parameters
 * - Input/output types
 * - Function visibility (public, private, etc.)
 * - State mutability (view, pure, payable, non-payable)
 * 
 * This simple counter contract has two functions:
 * - number(): A view function that returns the current counter value (costs no gas to call)
 * - increment(): A state-changing function that increases the counter by 1 (costs gas)
 */
const abi = [
  {
    "inputs": [],           // No input parameters required
    "name": "number",       // Function name
    "outputs": [            // Returns one value
      {
        "internalType": "uint256",  // Internal Solidity type
        "name": "",                 // No named return value
        "type": "uint256"          // External interface type (unsigned 256-bit integer)
      }
    ],
    "stateMutability": "view",     // Read-only function (doesn't change state)
    "type": "function"
  },
  {
    "inputs": [],                  // No input parameters required
    "name": "increment",           // Function name
    "outputs": [],                 // No return value
    "stateMutability": "nonpayable", // Changes state but doesn't require ETH payment
    "type": "function"
  }
];

export const FunctionCallForm = forwardRef(
  ({ props: { contractAddress, senderAddress, rpcUrl, web3, loading, Evm } }, ref) => {
    
    // COMPONENT STATE FOR CONTRACT INTERACTION
    const [contractValue, setContractValue] = useState("");     // Current counter value from contract
    const [loadingContract, setLoadingContract] = useState(false); // Loading state for contract calls

    /**
     * CONTRACT INSTANCE CREATION
     * 
     * Web3.js creates a contract instance that provides:
     * - Type-safe function calling
     * - Automatic ABI encoding/decoding
     * - Gas estimation capabilities
     * - Event filtering and monitoring
     * 
     * The contract instance acts as a JavaScript proxy to the on-chain contract.
     */
    const contract = new web3.eth.Contract(abi, contractAddress);

    /**
     * IMPERATIVE HANDLE FOR PARENT COMPONENT
     * 
     * This hook exposes methods to the parent component (EVMView) via ref.
     * It follows the React pattern for child-to-parent communication when
     * the parent needs to trigger specific child component actions.
     */
    useImperativeHandle(ref, () => ({
      /**
       * CREATE TRANSACTION FOR SMART CONTRACT CALL
       * 
       * This method prepares a transaction to call the increment() function.
       * Unlike simple transfers, contract calls require:
       * - Function signature encoding (first 4 bytes of function hash)
       * - Parameter encoding (if the function takes parameters)
       * - Gas estimation based on contract complexity
       */
      async createTransaction() {
        return await Evm.prepareTransactionForSigning({
          from: senderAddress,     // Transaction sender (must have sufficient ETH for gas)
          to: contractAddress,     // Contract address (not a regular account)
          value: 0n,              // No ETH being sent (non-payable function)
          /**
           * FUNCTION CALL DATA ENCODING
           * 
           * The 'data' field contains the encoded function call:
           * - First 4 bytes: Function selector (hash of function signature)
           * - Remaining bytes: Encoded parameters (none in this case)
           * 
           * Web3.js handles this encoding automatically using the ABI.
           */
          data: contract.methods.increment().encodeABI(),
        });
      },
      
      /**
       * POST-TRANSACTION CALLBACK
       * 
       * After successfully relaying a transaction, we refresh the contract
       * state to show the updated counter value. This demonstrates how
       * UI should stay in sync with contract state changes.
       */
      async afterRelay() {
        await queryContract();  // Refresh contract state
      },
    }));

    /**
     * CONTRACT STATE QUERYING
     * 
     * This function demonstrates how to read contract state using view functions.
     * View functions:
     * - Don't cost gas to call (they don't modify state)
     * - Can be called without signing transactions
     * - Return values immediately
     * - Don't generate transaction hashes
     */
    const queryContract = async () => {
      setLoadingContract(true);
      
      try {
        /**
         * CALLING A VIEW FUNCTION
         * 
         * The call() method executes a read-only function:
         * - No transaction is created
         * - No gas is consumed
         * - Result is returned immediately
         * - No wallet signature required
         * 
         * This is different from send() which would create a transaction.
         */
        const result = await contract.methods.number().call();
        
        /**
         * RESULT PROCESSING
         * 
         * Smart contract functions return values in their raw format.
         * For uint256, this is typically a big integer that needs conversion
         * to a regular JavaScript number for display.
         */
        setContractValue(result.toString()); // Convert BigInt to string for display
        
      } catch (error) {
        console.error("Error calling contract:", error);
        setContractValue("Error reading contract");
      }
      
      setLoadingContract(false);
    };

    /**
     * INITIAL CONTRACT STATE LOADING
     * 
     * When the component mounts or the contract address changes,
     * we automatically fetch the current contract state to show
     * users the current counter value.
     */
    useEffect(() => {
      if (contractAddress && contract) {
        queryContract();
      }
    }, [contractAddress]); // Re-run when contract address changes

    /**
     * COMPONENT RENDER
     * 
     * The UI provides:
     * - Current contract state display (counter value)
     * - Manual refresh button for contract state
     * - Information about the upcoming function call
     * - Visual feedback during contract operations
     */
    return (
      <>
        {/* CONTRACT STATE DISPLAY CARD */}
        <div className="card mb-3 border-warning">
          <div className="card-header bg-warning text-white">
            <h6 className="card-title mb-0">📋 Smart Contract State</h6>
          </div>
          <div className="card-body">
            <div className="row align-items-center">
              <div className="col-sm-6">
                <strong>Counter Value:</strong>
              </div>
              <div className="col-sm-4">
                <span className="badge bg-primary fs-6">
                  {loadingContract ? (
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  ) : (
                    contractValue || "Not loaded"
                  )}
                </span>
              </div>
              <div className="col-sm-2">
                {/* MANUAL REFRESH BUTTON */}
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={queryContract}
                  disabled={loadingContract || loading}
                  title="Refresh contract state"
                >
                  🔄
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FUNCTION CALL INFORMATION */}
        <div className="alert alert-info">
          <div className="row">
            <div className="col-sm-4">
              <strong>📞 Function Call:</strong>
            </div>
            <div className="col-sm-8">
              <code>increment()</code>
            </div>
          </div>
          <div className="row">
            <div className="col-sm-4">
              <strong>📄 Contract:</strong>
            </div>
            <div className="col-sm-8">
              <small className="text-muted font-monospace">
                {contractAddress}
              </small>
            </div>
          </div>
          <div className="row">
            <div className="col-sm-4">
              <strong>⚡ Gas Usage:</strong>
            </div>
            <div className="col-sm-8">
              <small className="text-muted">
                ~43,000 gas (estimated for increment operation)
              </small>
            </div>
          </div>
          <div className="row">
            <div className="col-sm-4">
              <strong>🎯 Action:</strong>
            </div>
            <div className="col-sm-8">
              <small className="text-muted">
                Increases the counter value by 1
              </small>
            </div>
          </div>
        </div>

        {/* OPERATION EXPLANATION */}
        <div className="alert alert-secondary">
          <small>
            <strong>💡 What happens when you sign:</strong><br/>
            1. A transaction will be created to call <code>increment()</code><br/>
            2. The MPC service will sign the transaction using ECDSA<br/>
            3. The transaction will be broadcast to the Ethereum network<br/>
            4. Miners will execute the function and update the contract state<br/>
            5. The counter value will increase by 1 (refresh to see the change)
          </small>
        </div>
      </>
    );
  }
);

// PropTypes for development-time type checking and documentation
FunctionCallForm.propTypes = {
  props: PropTypes.shape({
    contractAddress: PropTypes.string.isRequired,
    senderAddress: PropTypes.string.isRequired,
    rpcUrl: PropTypes.string.isRequired,
    web3: PropTypes.object.isRequired,
    loading: PropTypes.bool.isRequired,
    Evm: PropTypes.object.isRequired,
  }).isRequired,
};

// Display name for React DevTools
FunctionCallForm.displayName = "FunctionCallForm";
