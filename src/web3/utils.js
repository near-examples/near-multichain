import { keyStores, KeyPair, connect, Account, Near } from "near-api-js";
import { TESTNET_CONFIG } from "./config.js";

export const nearAccountFromEnv = async () => {
    const keyPair = KeyPair.fromString(process.env.REACT_APP_NEAR_ACCOUNT_PRIVATE_KEY);
    return nearAccountFromKeyPair({
        keyPair,
        accountId: process.env.REACT_APP_NEAR_ACCOUNT_ID
    });
};

const nearAccountFromKeyPair = async (config) => {
    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey("testnet", config.accountId, config.keyPair);
    const near = await connect({
        ...TESTNET_CONFIG,
        keyStore,
    });
    const account = await near.account(config.accountId);
    return { account, near };
};
