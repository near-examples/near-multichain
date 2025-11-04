import { useState, forwardRef, useImperativeHandle } from "react";
import Web3 from "web3";

export interface TransferFormHandle {
  createTransaction: () => Promise<any>;
  afterRelay: () => Promise<void>;
}

interface TransferFormProps {
  Evm: any; // Use proper EVM type from chainsig if available
  senderAddress: string;
  isLoading: boolean;
  token: string;
}

export const TransferForm = forwardRef<TransferFormHandle, TransferFormProps>(
  ({ Evm, senderAddress, isLoading, token }, ref) => {
    const [receiverAddress, setReceiverAddress] = useState(
      "0x72284EceE80A34BbC4c65d8A468B7771552a421b"
    );
    const [transferAmount, setTransferAmount] = useState("0.005");

    useImperativeHandle(ref, () => ({
      async createTransaction() {
        return await Evm.prepareTransactionForSigning({
          from: senderAddress as `0x${string}`,
          to: receiverAddress as `0x${string}`,
          value: BigInt(Web3.utils.toWei(transferAmount, "ether")),
        });
      },
      async afterRelay() {},
    }));

    return (
      <div>
        <input value={receiverAddress} onChange={e => setReceiverAddress(e.target.value)} disabled={isLoading} />
        <input value={transferAmount} type="number" onChange={e => setTransferAmount(e.target.value)} step={0.001} min={0.001} disabled={isLoading} />
        <span>{token}</span>
      </div>
    );
  }
);

TransferForm.displayName = "TransferForm";
