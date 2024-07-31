import { keyStores, KeyPair, connect, Account, Near } from "near-api-js";
import { TESTNET_CONFIG } from "./config";

// env utils
export const nearAccountFromEnv = async (): Promise<{ account: Account, near: Near }> => {
    const keyPair = KeyPair.fromString(process.env.NEAR_ACCOUNT_PRIVATE_KEY!);
    return nearAccountFromKeyPair({
        keyPair,
        accountId: process.env.NEAR_ACCOUNT_ID!
});
};

export const nearAccountFromKeyPair = async (config: {
    keyPair: KeyPair;
    accountId: string;
}): Promise<{ account: Account, near: Near }> => {
    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey("testnet", config.accountId, config.keyPair);
    const near = await connect({
        ...TESTNET_CONFIG,
        keyStore,
    });
    const account = await near.account(config.accountId);
    return { account, near };
};
