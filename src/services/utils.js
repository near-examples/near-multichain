//  Extracts transaction hashes from the URL query string.
export function getTransactionHashes() {
  const queryParams = new URLSearchParams(window.location.search);
  const txHash = queryParams.get("transactionHashes");
  return txHash ? txHash.split(",") : [];
}

export const fetchJson = async (url, params = {}, noWarnings = false) => {
  let res;
  try {
    res = await fetch(url, params);
    if (res.status !== 200) {
      if (noWarnings) return;
      console.log("res error");
      console.log(res);
      throw res;
    }
    return res.json();
  } catch (e) {
    if (noWarnings) return;
    console.log("fetchJson error", JSON.stringify(e));
  }
};

export const convertBitcoin = (value, toUnit) => {
  if (toUnit === "btc") {
    // Convert satoshis to bitcoins and return as a string with fixed precision
    return (value / 100000000).toFixed(8).toString();
  } else if (toUnit === "sats") {
    // Convert bitcoins to satoshis and return as a string
    return (value * 100000000).toString();
  } else {
    throw new Error(
      'Invalid unit specified. Use "btc" for bitcoins or "sats" for satoshis.'
    );
  }
};

// Helper function to pause execution for a given number of milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry helper function
export const retryWithDelay = async (fn, attempts = 10, delay = 5000) => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed: ${error}`);
      if (i < attempts - 1) {
        await sleep(delay);
      } else {
        throw new Error(`Failed after ${attempts} attempts`);
      }
    }
  }
};
