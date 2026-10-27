import { useCallback, useEffect, useMemo, useState } from 'react';
import { NearConnector } from '@hot-labs/near-connect';
import { JsonRpcProvider } from 'near-api-js';
import PropTypes from 'prop-types';
import { NetworkId } from '../config';

import { NearContext } from './use-near-wallet';
const rpcUrl = NetworkId === 'mainnet' ? 'https://free.rpc.fastnear.com' : 'https://test.rpc.fastnear.com';

export function NearProvider({ children }) {
  const connector = useMemo(() => new NearConnector({
    network: NetworkId,
    providers: { [NetworkId]: [rpcUrl] },
  }), []);
  const provider = useMemo(() => new JsonRpcProvider({ url: rpcUrl }), []);
  const [signedAccountId, setSignedAccountId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const signedIn = ({ accounts }) => {
      if (active) setSignedAccountId(accounts[0]?.accountId ?? '');
    };
    const signedOut = () => { if (active) setSignedAccountId(''); };
    connector.on('wallet:signIn', signedIn);
    connector.on('wallet:signOut', signedOut);
    connector.getConnectedWallet().then((connected) => {
      if (active) setSignedAccountId(connected?.accounts[0]?.accountId ?? '');
    }).catch(signedOut).finally(() => { if (active) setIsLoading(false); });
    return () => {
      active = false;
      connector.off('wallet:signIn', signedIn);
      connector.off('wallet:signOut', signedOut);
    };
  }, [connector]);

  const signIn = useCallback(() => connector.connect(), [connector]);
  const signOut = useCallback(() => connector.disconnect(), [connector]);
  // chainsig.js delegates signing through this callback. Preserve the wallet's
  // result array so the adapter can extract the MPC contract's signatures.
  const signAndSendTransactions = useCallback(async ({ transactions }) => {
    const wallet = await connector.wallet();
    return wallet.signAndSendTransactions({ transactions });
  }, [connector]);
  const viewFunction = useCallback((params) => provider.callFunction(params), [provider]);

  return <NearContext.Provider value={{ signedAccountId, isLoading, signIn, signOut, signAndSendTransactions, viewFunction }}>
    {children}
  </NearContext.Provider>;
}
NearProvider.propTypes = { children: PropTypes.node.isRequired };
