import { providers } from 'near-api-js';
import { retryWithDelay } from './utils'

let isSigning = false;

export async function sign(payload, path, wallet) {
  if (isSigning) {
    console.warn('Sign function is already running.');
    return;
  }
  isSigning = true;

  const contractId = 'v1.signer-prod.testnet'
  if (!wallet) {
    console.error('Wallet is not initialized');
    return;
  }

  const args = {
    request: {
      payload,
      path,
      key_version: 0,
    },
  };
  const attachedDeposit = '500000000000000000000000'

  const result = await wallet.callMethod({
    contractId,
    method: 'sign',
    args,
    gas: '250000000000000', // 250 Tgas
    deposit: attachedDeposit,
  });

  return result
}

// Updated getTransactionResult function using retryWithDelay
export const getTransactionResult = async (txHash) => {
  const provider = new providers.JsonRpcProvider({ url: 'http://rpc.mainnet.near.org' });

  // Define the function to retrieve the transaction result
  const fetchTransactionResult = async () => {
    const transaction = await provider.txStatus(txHash, 'unnused');
    return providers.getTransactionLastResult(transaction);
  };

  // Use the retry helper to attempt fetching the transaction result
  return await retryWithDelay(fetchTransactionResult);
};
