import { useState, useEffect } from "react";

import PropTypes from "prop-types";
import { forwardRef } from "react";
import { useImperativeHandle } from "react";

const abi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_num",
        type: "uint256",
      },
    ],
    name: "set",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "get",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "num",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export const FunctionCallForm = forwardRef(
  ({ props: { Evm, contractAddress, senderAddress, loading } }, ref) => {
    const [number, setNumber] = useState(1000);
    const [currentNumber, setCurrentNumber] = useState("");

    async function getNumber() {
      const result = await Evm.getContractViewFunction(
        contractAddress,
        abi,
        "get"
      );
      setCurrentNumber(String(result));
    }

    useEffect(() => {
      getNumber();
    }, []);

    useImperativeHandle(ref, () => ({
      async createTransaction() {
        const data = Evm.createTransactionData(contractAddress, abi, "set", [
          number,
        ]);
        const { transaction } = await Evm.createTransaction({
          sender: senderAddress,
          receiver: contractAddress,
          amount: 0,
          data,
        });
        return { transaction };
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
    Evm: PropTypes.shape({
      createTransaction: PropTypes.func.isRequired,
      createTransactionData: PropTypes.func.isRequired,
      getContractViewFunction: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

FunctionCallForm.displayName = "FunctionCallForm";
