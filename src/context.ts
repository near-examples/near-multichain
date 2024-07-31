import { createContext } from 'react';
import { Wallet } from "./services/near-wallet";

/**
 * @typedef NearContext
 * @property {import('./services/near-wallet.js').Wallet} wallet Current wallet
 * @property {string} signedAccountId The AccountId of the signed user
 */

/** @type {import ('react').Context<NearContext>} */
export const NearContext = createContext({
  wallet: Wallet,
  signedAccountId: '',
});