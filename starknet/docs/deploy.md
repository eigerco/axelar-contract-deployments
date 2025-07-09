# Contract Deployment Commands

This file contains example commands for deploying contracts on Starknet. Contract deployment creates an instance of a declared contract at a specific address.

## Prerequisites

Make sure you have:
- A funded account on testnet
- Contract already declared (class hash available in config)
- Valid account credentials
- For mainnet: Ledger hardware wallet

## Environment Setup

```bash
# Set your test environment
export STARKNET_ENV=testnet

# Set your test account (for online transactions)
export STARKNET_PRIVATE_KEY=0x1234...
export STARKNET_ACCOUNT_ADDRESS=0x5678...
```

## Command Options

### Required Options
- `--env`: Environment (testnet, mainnet)
- `--contractConfigName`: Contract configuration name (must exist in config)
- `--accountAddress`: Account address for deployment

### Optional Options
- `--constructorCalldata`: Constructor arguments as JSON array (default: '[]')
- `--salt`: Salt for deterministic deployment address
- `--privateKey`: Private key (required for online, not for offline)
- `--offline`: Generate unsigned transaction file
- `--estimate`: Estimate gas and display CLI arguments
- `--nonce`: Account nonce (required for offline)
- `--yes`: Skip confirmation prompts

### Gas Options (Offline Only)
- `--l1GasMaxAmount`: Maximum L1 gas amount
- `--l1GasMaxPricePerUnit`: Maximum L1 gas price per unit
- `--l2GasMaxAmount`: Maximum L2 gas amount
- `--l2GasMaxPricePerUnit`: Maximum L2 gas price per unit
- `--l1DataMaxAmount`: Maximum L1 data amount
- `--l1DataMaxPricePerUnit`: Maximum L1 data price per unit

## Deployment Workflow

### For Testnet (Online)

1. **Ensure contract is declared**:
   ```bash
   # Contract must be declared first
   npx ts-node starknet/declare-contract.ts --contractConfigName MyContract ...
   ```

2. **Deploy the contract**:
   ```bash
   npx ts-node starknet/deploy-contract.ts \
     --env testnet \
     --contractConfigName MyContract \
     --constructorCalldata '["0xparam1", "0xparam2"]' \
     --salt 0x123 \
     --privateKey $STARKNET_PRIVATE_KEY \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

### For Mainnet (Offline)

1. **Estimate gas on online machine**:
   ```bash
   npx ts-node starknet/deploy-contract.ts \
     --env mainnet \
     --contractConfigName MyContract \
     --constructorCalldata '["0xparam1"]' \
     --salt 0x123 \
     --estimate \
     --privateKey $STARKNET_PRIVATE_KEY \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

2. **Copy gas parameters from output**:
   ```
   --l1GasMaxAmount 50000 --l1GasMaxPricePerUnit 100000000000 --l2GasMaxAmount 1000000 --l2GasMaxPricePerUnit 1000000000
   ```

3. **Generate unsigned transaction on offline machine**:
   ```bash
   npx ts-node starknet/deploy-contract.ts \
     --env mainnet \
     --contractConfigName MyContract \
     --constructorCalldata '["0xparam1"]' \
     --salt 0x123 \
     --offline \
     --nonce 5 \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS \
     --l1GasMaxAmount 50000 \
     --l1GasMaxPricePerUnit 100000000000 \
     --l2GasMaxAmount 1000000 \
     --l2GasMaxPricePerUnit 1000000000
   ```

4. **Follow offline signing workflow** (see main offline.md)

## Constructor Calldata Format

Constructor arguments must be Cairo serialized and provided as a JSON array string:
- Empty constructor: `'[]'`
- Single parameter: `'["0x1234"]'`
- Multiple parameters: `'["0x1234", "0x5678", "0x0", ...]'`

## Deterministic Addresses

Using a salt allows for deterministic contract addresses:
- Same salt + same constructor args = same address
- Salt can be any valid hex value

## Output

Successful deployment will show:
- Contract Address: The deployed contract address
- Transaction Hash: The deployment transaction hash
- Axelar JSON configuration update with deployment details

## Common Issues

**"Class hash not found in config"**
- Solution: Ensure contract is declared first using declare-contract.ts

**"Invalid constructor calldata"**
- Solution: Verify JSON array format and parameter types

**"Nonce is required for offline transaction"**
- Solution: Add --nonce flag with current account nonce

**"Salt already used"**
- Solution: Use a different salt value for unique address

## Notes

- Contract must be declared before deployment
- Salt is optional but recommended for deterministic addresses
- Constructor calldata must match contract's constructor signature
- Deployment saves contract address to config for future reference
- For mainnet, it's required to use offline workflow with hardware wallets
