import { NearContext } from './context';

import { useEffect, useState } from "react";
import Navbar from "./components/Navbar"
import { Wallet } from "./services/near-wallet";
import { EthereumView } from "./components/Ethereum";
import { BitcoinView } from "./components/Bitcoin";
import {nearAccountFromEnv} from "./web3/utils";
import {Account} from "near-api-js";
import { useSearchParams } from 'react-router-dom';
import {EthereumWalletResult} from "./components/Chain";
import React from 'react';

// CONSTANTS
export const MPC_CONTRACT = 'v1.signer-prod.testnet';
export const FAUCET_CONTRACT = 'faucetofnear.testnet';

// NEAR WALLET
const wallet = new Wallet({
    networkId: 'testnet',
    createAccessKeyFor: MPC_CONTRACT,
});
// const faucet_wallet = new Wallet({ network: 'testnet', createAccessKeyFor: FAUCET_CONTRACT });
export const drop = 0.1;

function App() {
  const [signedAccountId, setSignedAccountId] = useState('');
  const [status, setStatus] = useState("Please login to request a signature");
  const [chain, setChain] = useState('eth');
  const [nearAccount, setNearAccount] = useState<Account>(null);
  const [paused, setPaused] = useState(false);
  const [searchParams] = useSearchParams();
    const [walletResult, setWalletResult] = useState(null);

    // if we have transaction hashes in the url, then we want to call the function that gets big r and big s
    useEffect(() => {
        wallet.startUp(setSignedAccountId).then(() => {
            const paramValue = searchParams.get('transactionHashes');
            console.log('Query parameter value:', paramValue);

            // Take action based on query parameters
            if (paramValue) {
                wallet.getTransactionResult(paramValue).then((res) => {
                    setWalletResult(res);
                });
            }
        });

        nearAccountFromEnv().then(async ({account}) => {
          setNearAccount(account);
          // setPause(account);
        })


          // async function setPause(account: Account) {
          //   try {
          //       const res: FinalExecutionOutcome = await account.functionCall({
          //           contractId: FAUCET_CONTRACT,
          //           methodName: "paused",
          //           gas: new BN('250000000000000'),
          //           attachedDeposit: new BN("1"),
          //       })
          //       const {status}: ExecutionStatus = res.receipts_outcome[0].outcome.status
          //       const successValue = Buffer.from(status, 'base64').toString('utf-8');
          //       setPaused(successValue === "true");
          //   } catch (e) {
          //       setPaused(true);
          //       setStatus(e)
          //   }
          // }


    console.log("signed Account id", signedAccountId);
  }, []);


    return (
        <NearContext.Provider value={{ wallet, signedAccountId }}>
          <Navbar />
          <div className="container">
            <h4> 🔗 NEAR Multi Chain </h4>
            <p className="small">
              Safely control accounts on other chains through the NEAR MPC service. Learn more in the <a href="https://docs.near.org/abstraction/chain-signatures"> <b>documentation</b></a>.
            </p>
              {
                  (nearAccount !== null && nearAccount.accountId === signedAccountId) && <input type="button" id="pause" value={paused ? "unpause" : "pause"} onClick={function () {
                      setPaused(!paused);
                  }}></input>
              }

            {
                !paused ?
                <div style={{ width: '50%', minWidth: '400px' }}>
                  <div className="input-group input-group-sm mt-3 mb-3">
                    <input className="form-control text-center" type="text" value={`MPC Contract: ${MPC_CONTRACT}`} disabled />
                  </div>

                  <div className="input-group input-group-sm my-2 mb-4">
                    <span className="text-primary input-group-text" id="chain">Chain</span>
                    <select className="form-select" aria-describedby="chain" value={chain} onChange={e => setChain(e.target.value)} >
                      <option value="eth"> Ξ Ethereum </option>
                      <option value="btc"> ₿ BTC </option>
                    </select>
                  </div>

                  {chain === 'eth' && <EthereumView nearAccount={nearAccount} setStatus={setStatus} walletArgs={walletResult}/>}
                  {chain === 'btc' && <BitcoinView nearAccount={nearAccount} setStatus={setStatus} walletArgs={walletResult}/>}
                    <div className="mt-3 small text-center">
                        {status}
                    </div>
                </div> :
                    <div style={{ width: '50%', minWidth: '400px' }}>
                        <span>Faucet paused by owner</span>
                    </div>
            }

          </div>
        </NearContext.Provider>
    )
}

export default App
