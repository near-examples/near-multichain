export const uint8ArrayToHex = (uint8Array) => {
  return Array.from(uint8Array)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}