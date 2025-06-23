/**
 * ETHEREUM TRANSFER COMPONENT
 * 
 * This component demonstrates the simplest type of EVM transaction: transferring
 * ETH from one address to another. While conceptually simple, ETH transfers
 * showcase fundamental EVM concepts that apply to all transaction types.
 * 
 * KEY CONCEPTS DEMONSTRATED:
 * - Basic value transfer mechanics in EVM
 * - Wei/Gwei/ETH unit conversions (Ethereum's decimal system)
 * - Transaction structure for simple transfers
 * - Gas estimation for the most basic operation (21,000 gas)
 * - Address validation and user input handling
 * 
 * TRANSFER VS CONTRACT CALLS:
 * - Transfers: Move ETH between addresses (fixed 21k gas)
 * - Contract calls: Execute code + optionally transfer ETH (variable gas)
 * - Transfers: No data field required
 * - Contract calls: Require encoded function data
 * 
 * WHY TRANSFERS MATTER:
 * - Foundation for understanding all EVM transactions
 * - Most predictable gas cost (always 21,000 units)
 * - Simplest way to test wallet connectivity and account balance
 * - Building block for more complex multi-step operations
 */

import { useState } from "react";

import PropTypes from "prop-types";
import { forwardRef } from "react";
import { useImperativeHandle } from "react";
import Web3 from "web3";

export const TransferForm = forwardRef(
  ({ props: { Evm, senderAddress, loading } }, ref) => {
    
    /**
     * TRANSFER FORM STATE MANAGEMENT
     * 
     * We maintain minimal state for ETH transfers:
     * - receiver: Destination Ethereum address (42-character hex string starting with 0x)
     * - amount: Transfer amount in ETH (will be converted to Wei for transaction)
     * 
     * Default values provide a working example that users can modify.
     */
    const [receiver, setReceiver] = useState(
      "0x72284EceE80A34BbC4c65d8A468B7771552a421b"  // Valid Ethereum address for testing
    );
    const [amount, setAmount] = useState("0.005");              // Small amount to avoid expensive mistakes

    /**
     * IMPERATIVE HANDLE FOR PARENT COMPONENT COMMUNICATION
     * 
     * The parent EVMView component calls these methods via ref to:
     * - Create transactions when user clicks "Request Signature"
     * - Handle post-broadcast cleanup when needed
     * 
     * This pattern allows the parent to control the transaction flow while
     * keeping transaction-specific logic in the appropriate child component.
     */
    useImperativeHandle(ref, () => ({
      /**
       * CREATE ETHEREUM TRANSFER TRANSACTION
       * 
       * This method creates the transaction object for a simple ETH transfer.
       * The process involves:
       * 1. Convert ETH amount to Wei (smallest ETH unit)
       * 2. Create transaction with sender, receiver, and value
       * 3. Let the EVM adapter handle nonce, gas price, and other details
       */
      async createTransaction() {
        return await Evm.prepareTransactionForSigning({
          from: senderAddress,                                    // Sender's Ethereum address
          to: receiver,                                          // Recipient's Ethereum address
          /**
           * VALUE CONVERSION: ETH TO WEI
           * 
           * Ethereum uses Wei as its base unit:
           * - 1 ETH = 1,000,000,000,000,000,000 Wei (10^18)
           * - 1 Gwei = 1,000,000,000 Wei (10^9) - commonly used for gas prices
           * - 1 Finney = 1,000,000,000,000,000 Wei (10^15)
           * 
           * Web3.js provides utility functions to convert between units,
           * ensuring precise arithmetic with large numbers.
           */
          value: BigInt(Web3.utils.toWei(amount, "ether")),      // Convert ETH string to Wei BigInt
        });
      },
      
      /**
       * POST-TRANSACTION CALLBACK
       * 
       * For simple transfers, no special cleanup is needed after broadcasting.
       * This method exists to maintain consistency with other transaction types
       * (like contract calls) that might need to refresh UI state.
       */
      async afterRelay() {
        // No specific actions needed for ETH transfers
        // The parent component will handle UI state reset
      },
    }));

    /**
     * COMPONENT RENDER
     * 
     * The UI provides a clean, simple interface for ETH transfers:
     * - Recipient address input with validation styling
     * - Amount input with ETH unit indicator
     * - Responsive layout that works on mobile devices
     * - Disabled state during transaction processing
     */
    return (
      <>
        {/* RECIPIENT ADDRESS INPUT */}
        <div className="row mb-3">
          <label className="col-sm-2 col-form-label text-end">To:</label>
          <div className="col-sm-10">
            <input
              type="text"
              className="form-control"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              disabled={loading}
              placeholder="0x... (Ethereum address)"
              /**
               * ADDRESS INPUT VALIDATION
               * 
               * In a production app, you'd want to add:
               * - Real-time address validation (checksum, length)
               * - ENS name resolution (example.eth -> 0x...)
               * - Address book/recent addresses
               * - QR code scanning for mobile users
               */
            />
          </div>
        </div>

        {/* TRANSFER AMOUNT INPUT */}
        <div className="row mb-3">
          <div>
            <div className="row mb-3">
              <label className="col-sm-2 col-form-label text-end">
                Amount:
              </label>
              <div className="col-sm-10">
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.001"          // Allow precise decimal input
                    min="0.001"          // Prevent dust amounts that might fail
                    disabled={loading}
                    placeholder="0.000"
                    /**
                     * AMOUNT INPUT CONSIDERATIONS
                     * 
                     * For production applications, consider:
                     * - Maximum amount validation (don't exceed balance)
                     * - Minimum amount requirements (avoid dust)
                     * - Gas cost deduction from available balance
                     * - Multiple unit support (ETH, Gwei, Wei)
                     * - USD/fiat conversion display
                     */
                  />
                  <span className="input-group-text bg-warning text-white">
                    ETH
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TRANSFER INFORMATION DISPLAY */}
        <div className="alert alert-light border">
          <small className="text-muted">
            <strong>💡 Transaction Details:</strong><br/>
            • <strong>Type:</strong> Simple ETH Transfer<br/>
            • <strong>Gas Cost:</strong> Exactly 21,000 units (fixed for all transfers)<br/>
            • <strong>Data:</strong> None required (pure value transfer)<br/>
            • <strong>Finality:</strong> ~12-20 seconds on Ethereum mainnet<br/>
            <br/>
            <strong>⚠️ Remember:</strong> You'll need ETH for gas fees in addition to the transfer amount.
          </small>
        </div>
      </>
    );
  }
);

// PropTypes for development-time type checking and documentation
TransferForm.propTypes = {
  props: PropTypes.shape({
    senderAddress: PropTypes.string,              // Sender's Ethereum address
    loading: PropTypes.bool.isRequired,          // Loading state from parent
    Evm: PropTypes.shape({                       // EVM adapter instance
      prepareTransactionForSigning: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

// Display name for React DevTools debugging
TransferForm.displayName = "TransferForm";
