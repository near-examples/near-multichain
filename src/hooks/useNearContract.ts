import { useMemo } from "react";
import { chainAdapters, contracts } from "chainsig.js";

import { useWalletSelector } from "@near-wallet-selector/react-hook";
import { Connection } from '@solana/web3.js'
import { MPC_CONTRACT, NetworkId } from "../config";

export const useNearContract = () => {

  const { signedAccountId } = useWalletSelector();

  const nearContract = useMemo(() => {
    if (!signedAccountId) return undefined;
    return new contracts.near.ChainSignatureContract({
      networkId: NetworkId,
      contractId: MPC_CONTRACT,
      accountId: signedAccountId,
    });

  }, [
    signedAccountId,
  ]);

  const solana = useMemo(() => {
    if (!signedAccountId || !nearContract) return undefined;
    const connection = new Connection('https://api.devnet.solana.com');

    return new chainAdapters.solana.Solana({ connection, contract: nearContract });
  }, [
    signedAccountId,
    nearContract
  ]);

  return { solana ,nearContract};
};

export default useNearContract;
