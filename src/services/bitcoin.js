import * as ethers from 'ethers';
import { fetchJson } from './utils';
import * as bitcoinJs from 'bitcoinjs-lib';
import { generateBtcAddress } from './kdf/btc';
import { MPC_CONTRACT } from './kdf/mpc';

export class Bitcoin {
  name = 'Bitcoin';
  currency = 'sats';

  constructor(networkId) {
    this.networkId = networkId;
    this.name = `Bitcoin ${networkId === 'testnet' ? 'Testnet' : 'Mainnet'}`;
    this.explorer = `https://blockstream.info/${networkId === 'testnet' ? 'testnet' : ''}`;
  }

  deriveAddress = async (accountId, derivation_path) => {
    const { address, publicKey } = await generateBtcAddress({
      accountId,
      path: derivation_path,
      isTestnet: true,
      addressType: 'segwit'
    });
    return { address, publicKey };
  }

  getUtxos = async ({ address }) => {
    const bitcoinRpc = `https://blockstream.info/${this.networkId === 'testnet' ? 'testnet' : ''}/api`;
    try {
      const utxos = await fetchJson(`${bitcoinRpc}/address/${address}/utxo`);
      return utxos;
    } catch (e) { console.log('e', e) }
  }

  getBalance = async ({ address }) => {
    const utxos = await this.getUtxos({ address });
    let balance = utxos.reduce((acc, utxo) => acc + utxo.value, 0);
    return balance;
  }

  createTransaction = async ({ from: address, to, amount }) => {
    let utxos = await this.getUtxos({ address });
    if (!utxos) return

    // Use the utxo with the highest value
    utxos.sort((a, b) => b.value - a.value);
    utxos = [utxos[0]];

    const psbt = await constructPsbt(address, utxos, to, amount, this.networkId)
    if (!psbt) return

    return { utxos, psbt };
  }

  requestSignatureToMPC = async ({
    wallet,
    path,
    psbt,
    utxos,
    publicKey,
    attachedDeposit = 1,
  }) => {
    const keyPair = {
      publicKey: Buffer.from(publicKey, 'hex'),
      sign: async (transactionHash) => {
        const utxo = utxos[0]; // The UTXO being spent
        const value = utxo.value; // The value in satoshis of the UTXO being spent

        if (isNaN(value)) {
          throw new Error(`Invalid value for UTXO at index ${transactionHash}: ${utxo.value}`);
        }

        const payload = Object.values(ethers.getBytes(transactionHash));

        // Sign the payload using MPC
        const args = { request: { payload, path, key_version: 0, } };

        const { big_r, s } = await wallet.callMethod({
          contractId: MPC_CONTRACT,
          method: 'sign',
          args,
          gas: '250000000000000', // 250 Tgas
          deposit: attachedDeposit,
        });

        // Reconstruct the signature
        const rHex = big_r.affine_point.slice(2); // Remove the "03" prefix
        let sHex = s.scalar;

        // Pad s if necessary
        if (sHex.length < 64) {
          sHex = sHex.padStart(64, '0');
        }

        const rBuf = Buffer.from(rHex, 'hex');
        const sBuf = Buffer.from(sHex, 'hex');

        // Combine r and s
        return Buffer.concat([rBuf, sBuf]);
      },
    };

    // Sign each input manually
    await Promise.all(
      utxos.map(async (_, index) => {
        try {
          await psbt.signInputAsync(index, keyPair);
          console.log(`Input ${index} signed successfully`);
        } catch (e) {
          console.warn(`Error signing input ${index}:`, e);
        }
      })
    );

    psbt.finalizeAllInputs(); // Finalize the PSBT

    return psbt;  // Return the generated signature
  }

  reconstructSignedTransaction = async ({
    psbt,
    utxos,
    publicKey,
    signature,
  }) => {
    const keyPair = {
      publicKey: Buffer.from(publicKey, "hex"),
      sign: async (transactionHash) => {
        const utxo = utxos[0]; // The UTXO being spent
        const value = utxo.value; // The value in satoshis of the UTXO being spent

        if (isNaN(value)) {
          throw new Error(
            `Invalid value for UTXO at index ${transactionHash}: ${utxo.value}`
          );
        }

        const { big_r, s } = signature;

        // Reconstruct the signature
        const rHex = big_r.affine_point.slice(2); // Remove the "03" prefix
        let sHex = s.scalar;

        // Pad s if necessary
        if (sHex.length < 64) {
          sHex = sHex.padStart(64, "0");
        }

        const rBuf = Buffer.from(rHex, "hex");
        const sBuf = Buffer.from(sHex, "hex");

        // Combine r and s
        return Buffer.concat([rBuf, sBuf]);
      },
    };

    // Sign each input manually
    await Promise.all(
      utxos.map(async (_, index) => {
        try {
          await psbt.signInputAsync(index, keyPair);
          console.log(`Input ${index} signed successfully`);
        } catch (e) {
          console.warn(`Error signing input ${index}:`, e);
        }
      })
    );

    psbt.finalizeAllInputs(); // Finalize the PSBT

    return psbt; // Return the generated signature
  };

  reconstructSignedTransactionFromSessionStorage = async (signature) => {
    const { from, to, amount, utxos, publicKey } = JSON.parse(
      sessionStorage.getItem("btc_transaction")
    );

    const psbt = await constructPsbt(from, utxos, to, amount, this.networkId);

    return this.reconstructSignedTransaction({
      psbt,
      utxos,
      signature,
      publicKey,
    });
  };

  broadcastTX = async (signedTransaction) => {
    // broadcast tx
    const bitcoinRpc = `https://blockstream.info/${this.networkId === 'testnet' ? 'testnet' : ''}/api`;
    const res = await fetch(`${bitcoinRpc}/tx`, {
      method: 'POST',
      body: signedTransaction.extractTransaction().toHex(),
    });
    if (res.status === 200) {
      const hash = await res.text();
      return hash
    } else {
      throw Error(res);
    }
  }
}

async function getFeeRate(networkId, blocks = 6) {
  const bitcoinRpc = `https://blockstream.info/${networkId === 'testnet' ? 'testnet' : ''}/api`;
  const rate = await fetchJson(`${bitcoinRpc}/fee-estimates`);
  return rate[blocks].toFixed(0);
}

async function constructPsbt(
  address,
  utxos,
  to,
  amount,
  networkId,
) {

  if (!address) return console.log('must provide a sending address');
  const sats = parseInt(amount);

  // Check balance (TODO include fee in check)
  if (utxos[0].value < sats) {
    return console.log('insufficient funds');
  }

  const psbt = new bitcoinJs.Psbt({ network: networkId === 'testnet' ? bitcoinJs.networks.testnet : bitcoinJs.networks.bitcoin });

  let totalInput = 0;

  await Promise.all(
    utxos.map(async (utxo) => {
      totalInput += utxo.value;

      const transaction = await fetchTransaction(networkId, utxo.txid);
      let inputOptions;

      const scriptHex = transaction.outs[utxo.vout].script.toString('hex');
      console.log(`UTXO script type: ${scriptHex}`);

      if (scriptHex.startsWith('76a914')) {
        console.log('legacy');
        const bitcoinRpc = `https://blockstream.info/${networkId === 'testnet' ? 'testnet' : ''}/api`;
        const nonWitnessUtxo = await fetch(`${bitcoinRpc}/tx/${utxo.txid}/hex`).then(result => result.text())

        console.log('nonWitnessUtxo hex:', nonWitnessUtxo)
        // Legacy P2PKH input (non-SegWit)
        inputOptions = {
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(nonWitnessUtxo, 'hex'), // Provide the full transaction hex
          // sequence: 4294967295, // Enables RBF
        };
      } else if (scriptHex.startsWith('0014')) {
        console.log('segwit');

        inputOptions = {
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: transaction.outs[utxo.vout].script,
            value: utxo.value,  // Amount in satoshis
          },
        };
      } else if (scriptHex.startsWith('0020') || scriptHex.startsWith('5120')) {
        console.log('taproot');

        // Taproot (P2TR) input
        inputOptions = {
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: transaction.outs[utxo.vout].script,
            value: utxo.value,
          },
          tapInternalKey: 'taprootInternalPubKey' // Add your Taproot internal public key here
        };
      } else {
        throw new Error('Unknown script type');
      }

      // Add the input to the PSBT
      psbt.addInput(inputOptions);
    })
  );

  // Add output to the recipient
  psbt.addOutput({
    address: to,
    value: sats,
  });

  // Calculate fee (replace with real fee estimation)
  const feeRate = await getFeeRate(networkId);
  const estimatedSize = utxos.length * 148 + 2 * 34 + 10;
  const fee = (estimatedSize * feeRate).toFixed(0);
  const change = totalInput - sats - fee;

  // Add change output if necessary
  if (change > 0) {
    psbt.addOutput({
      address: address,
      value: Math.floor(change),
    });
  }

  return psbt;
};

async function fetchTransaction(networkId, transactionId) {
  const bitcoinRpc = `https://blockstream.info/${networkId === 'testnet' ? 'testnet' : ''}/api`;

  const data = await fetchJson(`${bitcoinRpc}/tx/${transactionId}`);
  const tx = new bitcoinJs.Transaction();

  if (!data || !tx) throw new Error('Failed to fetch transaction')
  tx.version = data.version;
  tx.locktime = data.locktime;

  data.vin.forEach((vin) => {
    const txHash = Buffer.from(vin.txid, 'hex').reverse();
    const vout = vin.vout;
    const sequence = vin.sequence;
    const scriptSig = vin.scriptsig
      ? Buffer.from(vin.scriptsig, 'hex')
      : undefined;
    tx.addInput(txHash, vout, sequence, scriptSig);
  });

  data.vout.forEach((vout) => {
    const value = vout.value;
    const scriptPubKey = Buffer.from(vout.scriptpubkey, 'hex');
    tx.addOutput(scriptPubKey, value);
  });

  data.vin.forEach((vin, index) => {
    if (vin.witness && vin.witness.length > 0) {
      const witness = vin.witness.map((w) => Buffer.from(w, 'hex'));
      tx.setWitness(index, witness);
    }
  });

  return tx;
}
