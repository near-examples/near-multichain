import { base_decode } from 'near-api-js/lib/utils/serialize';
import { ec as EC } from 'elliptic';
import { keccak256 } from "viem";import hash from 'hash.js';
import { sha3_256 } from 'js-sha3'
import { MPC_KEY } from './mpc';

export async function generateEthAddress({ accountId, derivation_path }) {
  const publicKey = await deriveChildPublicKey(najPublicKeyStrToUncompressedHexPoint(), accountId, derivation_path);
  const address = await uncompressedHexPointToEvmAddress(publicKey);
  return { publicKey: Buffer.from(publicKey, 'hex'), address };
}

export function najPublicKeyStrToUncompressedHexPoint() {
  const res = '04' + Buffer.from(base_decode(MPC_KEY.split(':')[1])).toString('hex');
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