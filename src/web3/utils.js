import { keyStores, KeyPair, connect, Account, Near } from "near-api-js";
import { TESTNET_CONFIG } from "./config.js";

export const nearAccountFromEnv = async () => {
    const privateKey = import.meta.env.VITE_NEAR_ACCOUNT_PRIVATE_KEY;
    const keyPair = KeyPair.fromString(privateKey);
    return nearAccountFromKeyPair({
        keyPair,
        accountId: import.meta.env.VITE_NEAR_ACCOUNT_ID
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
