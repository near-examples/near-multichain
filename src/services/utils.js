//  Extracts transaction hashes from the URL query string.
export function getTransactionHashes() {
    const queryParams = new URLSearchParams(window.location.search);
    const txHash = queryParams.get('transactionHashes');
    return txHash ? txHash.split(',') : [];
  }

  