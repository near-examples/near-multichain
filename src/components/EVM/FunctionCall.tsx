import { useState, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import { chainAdapters } from "chainsig.js";
import { ABI } from "../../config";

export interface FunctionCallFormHandle {
  createTransaction: () => Promise<{ transaction: unknown; hashesToSign: unknown[] }>;
  afterRelay: () => void;
}

interface FunctionCallFormProps {
  Evm: chainAdapters.evm.EVM;
  senderAddress: string;
  contractAddress: string;
  rpcUrl: string;
  isLoading: boolean;
}

export const FunctionCallForm = forwardRef<FunctionCallFormHandle, FunctionCallFormProps>(
  ({ Evm, senderAddress, contractAddress, rpcUrl, isLoading }, ref) => {
    const [number, setNumber] = useState(1000);
    const [currentNumber, setCurrentNumber] = useState("");

    const provider = useMemo(() => new JsonRpcProvider(rpcUrl), [rpcUrl]);
    const contract = useMemo(() => new Contract(contractAddress, ABI, provider), [contractAddress, provider]);

    const getNumber = useCallback(async () => {
      const result = await contract.get();
      setCurrentNumber(String(result));
    }, [contract]);

    useEffect(() => {
      getNumber();
    }, [getNumber]);

    useImperativeHandle(ref, () => ({
      async createTransaction() {
        const data = contract.interface.encodeFunctionData("set", [number]);
        return await Evm.prepareTransactionForSigning({
          from: senderAddress as `0x${string}`,
          to: contractAddress as `0x${string}`,
          data: data as `0x${string}`,
        });
      },
      async afterRelay() {
        getNumber();
      },
    }));

    return (
      <div>
        <input value={number} type="number" onChange={(e) => setNumber(Number(e.target.value))} disabled={isLoading} />
        <div>Current: {currentNumber}</div>
      </div>
    );
  }
);

FunctionCallForm.displayName = "FunctionCallForm";
