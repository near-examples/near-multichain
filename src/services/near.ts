import BN from "bn.js";
import {Account} from "near-api-js";
import {parseNearAmount} from "@near-js/utils";
import {FinalExecutionOutcome} from "@near-wallet-selector/core";
import {ExecutionStatus} from "@near-js/types";
import {ChangeFunctionCallOptions} from "@near-js/accounts/lib/interface"

export async function callContract(nearAccount: Account, derivation_path: string, mpc_contract: string, chain: string) {
    try {
        const rustPayload = {
            chain: chain,
        }
        let params: ChangeFunctionCallOptions  = {
            contractId: mpc_contract,
            methodName: 'request_tokens',
            args: rustPayload,
            gas: BigInt('250000000000000'),
            attachedDeposit: BigInt(parseNearAmount("0.01")),
        };
        const res: FinalExecutionOutcome = await nearAccount.functionCall(params);

        if (res.receipts_outcome.length === 0) {
            throw new Error("no receipt outcomes");
        }
        const executionStatus = res.receipts_outcome[0].outcome.status as ExecutionStatus;
        const successValue = Buffer.from(executionStatus.SuccessValue,
            'base64').toString('utf-8');
        return successValue === 'true';
    } catch (e) {
        let message = `error signing: ${e.message}`;
        throw new Error(message);
    }
}
