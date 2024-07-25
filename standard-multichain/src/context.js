import { createContext } from 'react';

/**
 * @typedef NearContext
 * @property {import('./services/near-wallet').Wallet} wallet Current wallet
 * @property {string} signedAccountId The AccountId of the signed user
 */

/** @type {import ('react').Context<NearContext>} */
export const NearContext = createContext({
  wallet: undefined,
  signedAccountId: ''
});