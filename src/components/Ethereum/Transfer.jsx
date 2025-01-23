import { useState } from "react";

import PropTypes from "prop-types";
import { forwardRef } from "react";
import { useImperativeHandle } from "react";

export const TransferForm = forwardRef(
  ({ props: { Eth, senderAddress, loading } }, ref) => {
    const [receiver, setReceiver] = useState(
      "0x427F9620Be0fe8Db2d840E2b6145D1CF2975bcaD"
    );
    const [amount, setAmount] = useState(0.005);

    useImperativeHandle(ref, () => ({
      async createTransaction() {
        return await Eth.createTransaction({
          sender: senderAddress,
          receiver: receiver,
          amount: amount,
          data: undefined,
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
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              disabled={loading}
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.01"
                    disabled={loading}
                  />
                  <span className="input-group-text bg-warning text-white">
                    ETH
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
);

TransferForm.propTypes = {
  props: PropTypes.shape({
    senderAddress: PropTypes.string.isRequired,
    loading: PropTypes.bool.isRequired,
    Eth: PropTypes.shape({
      createTransaction: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

TransferForm.displayName = "TransferForm";
