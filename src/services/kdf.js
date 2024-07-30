import { base_decode } from 'near-api-js/lib/utils/serialize';
import { ec as EC } from 'elliptic';
import { keccak256 } from "viem";import hash from 'hash.js';
import bs58check from 'bs58check';
import { sha3_256 } from 'js-sha3'

const rootPublicKey = 'secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3';

export function najPublicKeyStrToUncompressedHexPoint() {
  const res = '04' + Buffer.from(base_decode(rootPublicKey.split(':')[1])).toString('hex');
  return res;
}

export async function deriveChildPublicKey(
  parentUncompressedPublicKeyHex,
  signerId,
  path = ''
) {
  const ec = new EC("secp256k1");
  const scalarHex = sha3_256(
    `near-mpc-recovery v0.1.0 epsilon derivation:${signerId},${path}`
  );

  const x = parentUncompressedPublicKeyHex.substring(2, 66);
  const y = parentUncompressedPublicKeyHex.substring(66);

  // Create a point object from X and Y coordinates
  const oldPublicKeyPoint = ec.curve.point(x, y);

  // Multiply the scalar by the generator point G
  const scalarTimesG = ec.g.mul(scalarHex);

  // Add the result to the old public key point
  const newPublicKeyPoint = oldPublicKeyPoint.add(scalarTimesG);
  const newX = newPublicKeyPoint.getX().toString("hex").padStart(64, "0");
  const newY = newPublicKeyPoint.getY().toString("hex").padStart(64, "0");
  return "04" + newX + newY;
}

export function uncompressedHexPointToEvmAddress(uncompressedHexPoint) {
  const addressHash = keccak256(`0x${uncompressedHexPoint.slice(2)}`);

  // Ethereum address is last 20 bytes of hash (40 characters), prefixed with 0x
  return ("0x" + addressHash.substring(addressHash.length - 40));
}

export async function uncompressedHexPointToBtcAddress(publicKeyHex, network) {
  // Step 1: SHA-256 hashing of the public key
  const publicKeyBytes = Uint8Array.from(Buffer.from(publicKeyHex, 'hex'));

  const sha256HashOutput = await crypto.subtle.digest(
    'SHA-256',
    publicKeyBytes
  );

  // Step 2: RIPEMD-160 hashing on the result of SHA-256
  const ripemd160 = hash
    .ripemd160()
    .update(Buffer.from(sha256HashOutput))
    .digest();

  // Step 3: Adding network byte (0x00 for Bitcoin Mainnet)
  const network_byte = network === 'bitcoin' ? 0x00 : 0x6f;
  const networkByte = Buffer.from([network_byte]);
  const networkByteAndRipemd160 = Buffer.concat([
    networkByte,
    Buffer.from(ripemd160)
  ]);

  // Step 4: Base58Check encoding
  const address = bs58check.encode(networkByteAndRipemd160);

  return address;
}