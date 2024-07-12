import { useState } from "react";

import PropTypes from 'prop-types';
import { forwardRef } from "react";
import { useImperativeHandle } from "react";

export const TransferForm = forwardRef(({ props: { Eth, senderAddress, loading } }, ref) => {
  const [receiver, setReceiver] = useState("0x427F9620Be0fe8Db2d840E2b6145D1CF2975bcaD");
  const [amount, setAmount] = useState(0.005);

  useImperativeHandle(ref, () => ({
    async createPayload() {
      const { transaction, payload } = await Eth.createPayload(senderAddress, receiver, amount, undefined);
      return { transaction, payload };
    },
    async afterRelay() { }
  }));

  return (
    <>
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">To:</label>
        <div className="col-sm-10">
          <input type="text" className="form-control form-control-sm" value={receiver} onChange={(e) => setReceiver(e.target.value)} disabled={loading} />
        </div>
      </div>
      <div className="row mb-3">
        <label className="col-sm-2 col-form-label col-form-label-sm">Amount:</label>
        <div className="col-sm-10">
          <input type="number" className="form-control form-control-sm" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" disabled={loading} />
          <div className="form-text"> Ethereum units </div>
        </div>
      </div>
    </>
  )
});

TransferForm.propTypes = {
  props: PropTypes.shape({
    senderAddress: PropTypes.string.isRequired,
    loading: PropTypes.bool.isRequired,
    Eth: PropTypes.shape({
      createPayload: PropTypes.func.isRequired
    }).isRequired
  }).isRequired
};

TransferForm.displayName = 'TransferForm';