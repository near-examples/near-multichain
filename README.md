# NEAR Multichain Examples w/ Chain Signatures

![alpha badge](https://img.shields.io/badge/status-alpha-red)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-green)](https://github.com/near-examples/near-multichain/pulls)
[![Chain Signatures Docs](https://img.shields.io/badge/Chain_Signatures_Docs-blue)](https://docs.near.org/concepts/abstraction/chain-signatures)
[![Dev Support](https://img.shields.io/badge/DEV_SUPPORT-red)](https://t.me/chain_abstraction)

An example on signing and executing transactions across multiple blockchain protocols from one NEAR account

---

## Requirements

- `npm` or `yarn`
- NEAR `testnet` account using [MyNEARWallet](https://mynearwallet.com/)

## Installation

```bash
npm install # or yarn
npm run dev # or yarn dev
```

> [!CAUTION]
> To use Chain Signatures on mainnet, use these config variables:
```javascript
export const NetworkId = 'mainnet';
export const MPC_CONTRACT = 'v1.signer';
export const MPC_KEY = 'secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya';
```
