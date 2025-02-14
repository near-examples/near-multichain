import { useState, useEffect } from "react";

import PropTypes from "prop-types";
import { forwardRef } from "react";
import { useImperativeHandle } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import { FeeMarketEIP1559Transaction } from "@ethereumjs/tx";
import { ABI } from "../../config";


export const FunctionCallForm = forwardRef(
  ({ props: { contractAddress, senderAddress, loading, rpcUrl, web3 } }, ref) => {
    const [number, setNumber] = useState(1000);
    const [currentNumber, setCurrentNumber] = useState("");

    const provider = new JsonRpcProvider(rpcUrl);
    const contract = new Contract(contractAddress, ABI, provider);

    const getNumber = async () => {

      const result = await contract.get()
      setCurrentNumber(String(result));
    }

    useEffect(() => {
      getNumber();
    }, []);

    useImperativeHandle(ref, () => ({
      async createTransaction() {

        const data = contract.interface.encodeFunctionData("set", [
          number,
        ]);
        const nonce = await web3.eth.getTransactionCount(senderAddress);

        const block = await web3.eth.getBlock("latest");
        const maxPriorityFeePerGas = await web3.eth.getMaxPriorityFeePerGas();
        const maxFeePerGas = block.baseFeePerGas * 2n + maxPriorityFeePerGas;

        const { chainId } = await provider.getNetwork();

        const transactionData = {
          nonce,
          gasLimit: 50_000,
          maxFeePerGas,
          maxPriorityFeePerGas,
          to: contractAddress,
          data,
          value: BigInt(0),
          chainId,
        };

        const transaction = FeeMarketEIP1559Transaction.fromTxData(
          transactionData,
          {}
        );

        // Store in sessionStorage for later
        sessionStorage.setItem("transaction", transaction.serialize());

        return { transaction, mpcPayloads: null };
      },

      signedTransaction({ big_r, s, recovery_id }, transaction) {

        const r = Buffer.from(big_r.affine_point.substring(2), "hex");
        const S = Buffer.from(s.scalar, "hex");
        const v = recovery_id;

        const signedTx = transaction.addSignature(v, r, S);

        if (signedTx.getValidationErrors().length > 0)
          throw new Error("Transaction validation errors");
        if (!signedTx.verifySignature()) throw new Error("Signature is not valid");

        return `0x${Buffer.from(signedTx.serialize()).toString('hex')}`;
      },
      async afterRelay() {
        getNumber();
      },
    }));

    return (
      <>
        <div className="row mb-3">
          <label className="col-sm-2 col-form-label col-form-label-sm">
            Counter:
          </label>
          <div className="col-sm-10">
            <input
              type="text"
              className="form-control form-control-sm"
              value={contractAddress}
              disabled
            />
            <div className="form-text">Contract address</div>
          </div>
        </div>
        <div className="row mb-3">
          <label className="col-sm-2 col-form-label col-form-label-sm">
            Number:
          </label>
          <div className="col-sm-10">
            <input
              type="number"
              className="form-control form-control-sm"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              step="1"
              disabled={loading}
            />
            <div className="form-text">
              {" "}
              The number to save, current value: <b> {currentNumber} </b>{" "}
            </div>
          </div>
        </div>
      </>
    );
  }
);

FunctionCallForm.propTypes = {
  props: PropTypes.shape({
    senderAddress: PropTypes.string.isRequired,
    contractAddress: PropTypes.string.isRequired,
    loading: PropTypes.bool.isRequired,
    rpcUrl: PropTypes.string.isRequired,
    web3: PropTypes.object.isRequired,
  }).isRequired,
};

FunctionCallForm.displayName = "FunctionCallForm";
