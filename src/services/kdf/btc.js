import { base_decode } from 'near-api-js/lib/utils/serialize';
import { ec as EC } from 'elliptic';
import { sha3_256 } from 'js-sha3';
import hash from 'hash.js';
import bs58check from 'bs58check';
import { bech32 } from 'bech32'
import { MPC_KEY } from './mpc';

export const rootPublicKey = 'secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3';

export function najPublicKeyStrToCompressedPoint(najPublicKeyStr) {
  const ec = new EC('secp256k1');
  
  // Decode the key from base58, then convert to a hex string
  const decodedKey = base_decode(najPublicKeyStr.split(':')[1]);
  
  // Check if the key is already in uncompressed format
  if (decodedKey.length === 64) {
    // If it's a raw 64-byte key, we must assume it's uncompressed and manually prepend '04' (uncompressed prefix)
    const uncompressedKey = '04' + Buffer.from(decodedKey).toString('hex');
    
    // Create a key pair from the uncompressed key
    const keyPoint = ec.keyFromPublic(uncompressedKey, 'hex').getPublic();
    
    // Return the compressed public key as a hex string
    return keyPoint.encodeCompressed('hex');
  } else {
    throw new Error('Unexpected key length. Expected uncompressed key format.');
  }
}

export async function uncompressedHexPointToSegwitAddress(
  uncompressedHexPoint,
  networkPrefix
) {
  const publicKeyBytes = Uint8Array.from(Buffer.from(uncompressedHexPoint, 'hex'));
  const sha256HashOutput = await crypto.subtle.digest('SHA-256', publicKeyBytes);

  const ripemd160 = hash.ripemd160().update(Buffer.from(sha256HashOutput)).digest();

  const witnessVersion = 0x00; // for P2PWPKH
  const words = bech32.toWords(Buffer.from(ripemd160));
  words.unshift(witnessVersion);
  const address = bech32.encode(networkPrefix, words);

  return address;
}

export async function deriveChildPublicKey(
  parentCompressedPublicKeyHex,
  signerId,
  path = ''
) {
  const ec = new EC('secp256k1');
  const scalarHex = sha3_256(
    `near-mpc-recovery v0.1.0 epsilon derivation:${signerId},${path}`
  );

  // Decode compressed public key
  const keyPoint = ec.keyFromPublic(parentCompressedPublicKeyHex, 'hex').getPublic();

  // Multiply the scalar by the generator point G
  const scalarTimesG = ec.g.mul(scalarHex);

  // Add the result to the old public key point
  const newPublicKeyPoint = keyPoint.add(scalarTimesG);

  // Return the new compressed public key
  return newPublicKeyPoint.encodeCompressed('hex');
}

export async function uncompressedHexPointToBtcAddress(
  uncompressedHexPoint,
  networkByte
) {
  // Step 1: SHA-256 hashing of the public key
  const publicKeyBytes = Uint8Array.from(Buffer.from(uncompressedHexPoint, 'hex'));
  const sha256HashOutput = await crypto.subtle.digest('SHA-256', publicKeyBytes);

  // Step 2: RIPEMD-160 hashing on the result of SHA-256
  const ripemd160 = hash.ripemd160().update(Buffer.from(sha256HashOutput)).digest();

  // Step 3: Adding network byte (0x00 for Bitcoin Mainnet, 0x6f for Testnet)
  const networkByteAndRipemd160 = Buffer.concat([networkByte, Buffer.from(ripemd160)]);

  // Step 4: Base58Check encoding
  return bs58check.encode(networkByteAndRipemd160);
}

export async function generateBtcAddress({
  accountId,
  path = '',
  isTestnet = true,
  addressType = 'segwit'
}) {
  const childPublicKey = await deriveChildPublicKey(
    najPublicKeyStrToCompressedPoint(MPC_KEY),  // Use the compressed key
    accountId,
    path
  );

  let address;

  if (addressType === 'legacy') {
    const networkByte = Buffer.from([isTestnet ? 0x6f : 0x00]); // 0x00 for mainnet, 0x6f for testnet
    address = await uncompressedHexPointToBtcAddress(childPublicKey, networkByte);
  } else if (addressType === 'segwit') {
    const networkPrefix = isTestnet ? 'tb' : 'bc';
    address = await uncompressedHexPointToSegwitAddress(childPublicKey, networkPrefix);
  } else {
    throw new Error(`Unsupported address type: ${addressType}`);
  }

  return {
    address,
    publicKey: childPublicKey
  };
}