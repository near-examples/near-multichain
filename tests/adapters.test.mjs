import test from 'node:test';
import assert from 'node:assert/strict';
import { chainAdapters } from 'chainsig.js';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { Keypair } from '@solana/web3.js';

test('published Aptos adapter accepts the configured client/contract object', () => {
  const client = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  const adapter = new chainAdapters.aptos.Aptos({ client, contract: {} });
  assert.equal(typeof adapter.prepareTransactionForSigning, 'function');
  assert.equal(typeof adapter.finalizeTransactionSigning, 'function');
});

test('Solana adapter supplies the exact Ed25519 message bytes for MPC signing', async () => {
  const adapter = new chainAdapters.solana.Solana({
    solanaConnection: { getLatestBlockhash: async () => ({ blockhash: '11111111111111111111111111111111' }) },
    contract: {},
  });
  const from = Keypair.generate().publicKey.toBase58();
  const to = Keypair.generate().publicKey.toBase58();
  const { transaction: { transaction }, hashesToSign } = await adapter.prepareTransactionForSigning({ from, to, amount: 1n });
  assert.equal(hashesToSign.length, 1);
  assert.deepEqual(hashesToSign[0], Array.from(transaction.serializeMessage()));
  assert.equal(transaction.feePayer.toBase58(), from);
});
