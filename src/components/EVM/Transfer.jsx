import { useState } from "react";

import PropTypes from "prop-types";
import { forwardRef } from "react";
import { useImperativeHandle } from "react";
import Web3 from "web3";

export const TransferForm = forwardRef(
  ({ props: { Evm, senderAddress, isLoading, token } }, ref) => {
    const [receiverAddress, setReceiverAddress] = useState(
      "0x72284EceE80A34BbC4c65d8A468B7771552a421b",
    );
    const [transferAmount, setTransferAmount] = useState("0.005");

    useImperativeHandle(ref, () => ({
      async createTransaction() {
        return await Evm.prepareTransactionForSigning({
          from: senderAddress,
          to: receiverAddress,
          value: BigInt(Web3.utils.toWei(transferAmount, "ether")),
        });
      },
      async afterRelay() {},
    }));

    return (
      <>
        <div className="row mb-3">
          <label className="col-sm-2 col-form-label text-end">To:</label>
          <div className="col-sm-10">
            <input
              type="text"
              className="form-control"
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>
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
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    step="0.001"
                    min="0.001"
                    disabled={isLoading}
                  />
                  <span className="input-group-text bg-warning text-white">
                    {token}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  },
);

TransferForm.propTypes = {
  props: PropTypes.shape({
    senderAddress: PropTypes.string,
    isLoading: PropTypes.bool.isRequired,
    token: PropTypes.string.isRequired,
    Evm: PropTypes.shape({
      prepareTransactionForSigning: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

TransferForm.displayName = "TransferForm";
