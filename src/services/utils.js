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
