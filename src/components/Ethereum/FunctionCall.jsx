import { useState, useEffect, useMemo } from "react";

import PropTypes from "prop-types";
import { forwardRef } from "react";
import { useImperativeHandle } from "react";
import Web3 from "web3";
import { Contract, JsonRpcProvider } from "ethers";

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

const contractAddress = "0xe2a01146FFfC8432497ae49A7a6cBa5B9Abd71A3";

export const FunctionCallForm = forwardRef(
  ({ props: { Evm, senderAddress, loading } }, ref) => {
    const [number, setNumber] = useState(1000);
    const [currentNumber, setCurrentNumber] = useState("");
    const contract = useMemo(() => {
      const provider = new JsonRpcProvider("https://sepolia.drpc.org", 11155111);

      return new Contract(contractAddress, abi, provider);
    }, []);

    async function getNumber() {
      const result = await contract["get"]();
      setCurrentNumber(String(result));
    }

    useEffect(() => {
      getNumber();
    }, []);

    useImperativeHandle(ref, () => ({
      async createTransaction() {
        const data = contract.interface.encodeFunctionData("set", [number]);

        return await Evm.getMPCPayloadAndTransaction({
          from: senderAddress,
          to: contractAddress,
          data: data,
          value: Web3.utils.toWei(0, "ether"),
        });
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
    loading: PropTypes.bool.isRequired,
    Evm: PropTypes.shape({
      getMPCPayloadAndTransaction: PropTypes.func.isRequired,
    }).isRequired,
  }).isRequired,
};

FunctionCallForm.displayName = "EthereumContractView";
