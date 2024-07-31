import BN from "bn.js";

export async function callContract(nearAccount, mpc_contract, chain) {
    const args = {
        chain: chain,
    };

    try {
        const res = await nearAccount.functionCall({
            contractId: mpc_contract,
            methodName: 'request_tokens',
            args: args,
            gas: new BN('300000000000000'),
        });

        if (res.receipts_outcome.length === 0) {
            throw new Error("no receipt outcomes");
        }
        const successValue = Buffer.from(res.receipts_outcome[0].outcome.status.SuccessValue,
            'base64').toString('utf-8');
        return successValue === 'true';
    } catch (e) {
        let message = `error signing: ${e.message}`;
        throw new Error(message);
    }
}
