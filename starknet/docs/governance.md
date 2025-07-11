# Governance Test Commands

This document contains example commands for testing the Axelar Governance contract on Starknet.

## Prerequisites

- Node.js and npm installed
- Environment configuration file (e.g., `testnet.json`, `devnet.json`)
- Private key and account address for write operations
- Governance contract deployed and configured in the environment

## Environment Variables

Set your account information through environment variables:

```bash
# For gas estimation (online)
export ENV=testnet
export STARKNET_PRIVATE_KEY=0x...
export STARKNET_ACCOUNT_ADDRESS=0x...

# For offline signing
# No network access required
# Ledger must be connected
```

## Command Options

```
Usage: governance [options] [command]

Interact with Axelar Governance on Starknet

Options:
  -V, --version                                                                                   output the version number
  -h, --help                                                                                      display help for command

Commands:
  governance-chain [options]                                                                      Get the governance chain name
  governance-address [options]                                                                    Get the governance address
  get-proposal-eta [options] <target> <entryPointSelector> <callData> <nativeValue>               Get the ETA of a proposal
  get-time-lock [options] <hash>                                                                  Get the time lock for a given hash
  is-operator-proposal-approved [options] <target> <entryPointSelector> <callData> <nativeValue>  Check if an operator proposal is approved
  execute-proposal [options] <target> <entryPointSelector> <callData> <nativeValue>               Execute a governance proposal
  execute-operator-proposal [options] <target> <entryPointSelector> <callData> <nativeValue>      Execute an operator proposal
  withdraw [options] <recipient> <amount>                                                         Withdraw native tokens from the governance contract
  transfer-operatorship [options] <newOperator>                                                   Transfer governance operatorship
  help [command]                                                                                  display help for command
```

## Read-Only Commands

### Get Governance Chain

Returns the name of the governance chain.

```bash
npx ts-node governance.ts governance-chain --env testnet
```

### Get Governance Address

Returns the address of the governance address.

```bash
npx ts-node governance.ts governance-address --env testnet
```

### Get Proposal ETA

Returns the ETA of a proposal.

```bash
# Example with sample values
npx ts-node governance.ts get-proposal-eta \
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" \
  "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e" \
  '["0x123", "0x456"]' \
  "1000000000000000000" \
  --env testnet
```

### Get Time Lock

Returns the timestamp after which a timelock can be executed.

```bash
# Example with a hash
npx ts-node governance.ts get-time-lock \
  "0x1234" \
  --env testnet
```

### Check if Operator Proposal is Approved

Returns whether an operator proposal is approved based on its parameters.

```bash
# Example checking if a specific proposal is approved
npx ts-node governance.ts is-operator-proposal-approved \
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" \
  "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e" \
  '["0x123", "0x456"]' \
  "0" \
  --env testnet
```

## Write Commands

All write commands support:
- `--offline` flag for offline transaction generation
- `--estimate` flag for gas estimation
- Regular online execution (default)

### Execute Proposal

Executes a governance proposal.

```bash
# Online execution
npx ts-node governance.ts execute-proposal \
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" \
  "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e" \
  '["0x123", "0x456"]' \
  "0" \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --env testnet

# Gas estimation
npx ts-node governance.ts execute-proposal \
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" \
  "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e" \
  '["0x123", "0x456"]' \
  "0" \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --env testnet \
  --estimate

# Offline transaction generation
npx ts-node governance.ts execute-proposal \
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" \
  "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e" \
  '["0x123", "0x456"]' \
  "0" \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --env testnet \
  --offline
```

### Execute Operator Proposal

Executes an operator proposal.

```bash
# Online execution
npx ts-node governance.ts execute-operator-proposal \
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" \
  "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e" \
  '["0x123", "0x456"]' \
  "0" \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --env testnet
```

### Withdraw

Withdraws native tokens from the governance contract.

```bash
# Withdraw 1 ETH to a recipient
npx ts-node governance.ts withdraw \
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  "1000000000000000000" \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --env testnet
```

### Transfer Operatorship

Transfers the operator address to a new address.

```bash
# Transfer operatorship
npx ts-node governance.ts transfer-operatorship \
  "0x0987" \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --env testnet
```

## Complex Examples

### Execute a Contract Upgrade Proposal

This example shows how to execute a proposal to upgrade a contract:

```bash
# Entry point selector for "upgrade" function
# You can calculate this using: starknet-keccak "upgrade"
UPGRADE_SELECTOR="0x0280bb2099800026f90c334a3a94888255f261cae22a5daa429ad7c6ab8fadf"

# New class hash for the upgrade
NEW_CLASS_HASH="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

# Execute the proposal
npx ts-node governance.ts execute-proposal \
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" \
  "$UPGRADE_SELECTOR" \
  "[\"$NEW_CLASS_HASH\"]" \
  "0" \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --env testnet
```

### Execute a Multi-Parameter Function Call

This example shows how to call a function with multiple parameters:

```bash
# Entry point selector for "set_parameters" function
SET_PARAMS_SELECTOR="0x123456789abcdef"

# Parameters: threshold (u256), timeout (u64), addresses (array)
# Note: u256 values need to be split into low and high parts
npx ts-node governance.ts execute-proposal \
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" \
  "$SET_PARAMS_SELECTOR" \
  '["0x5", "0x0", "0x3600", "0x3", "0xaddr1", "0xaddr2", "0xaddr3"]' \
  "0" \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --env testnet
```

## Offline Workflow

For mainnet operations with hardware wallets:

1. Generate unsigned transaction (requires account address via env var or flag):
```bash
npx ts-node governance.ts execute-proposal \
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" \
  "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e" \
  '["0x123"]' \
  "0" \
  --env mainnet \
  --offline
```

2. Sign the transaction offline using the sign-transaction.ts script
3. Combine signatures using combine-signatures.ts
4. Broadcast using broadcast-transaction.ts
