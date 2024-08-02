import BN from "bn.js";

export async function callContract(nearAccount, derivation_path, mpc_contract, chain) {

    const payload = {
        chain: chain
    }
    const payloadBuffer = Buffer.from(payload);
    const args = {
        request: {
            payload: {
                "chain": chain,
            },
            path: derivation_path,
            key_version: 0,
        },
    }

    const params = {
        request: {
            contractId: mpc_contract,
            methodName: 'request_tokens',
            args: args,
            gas: new BN('300000000000000'),
            attachedDeposit: new BN("1")
        }
    }

    try {
        const res = await nearAccount.functionCall(params);
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
