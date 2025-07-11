# Governance Test Commands

This document contains example commands for testing the Axelar Governance contract on Starknet.

## Prerequisites

- Node.js and npm installed
- Environment configuration file (e.g., `testnet.json`, `devnet.json`)
- Private key and account address for write operations
- Governance contract deployed and configured in the environment

## Environment Vars

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

## Read Commands

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

## Write Commands (Support --offline and --estimate)

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

## Output

Successful governance operations will show:
- **Read Operations**: Current values (governance chain, address, proposal status, time locks)
- **Write Operations**: Transaction hash and execution confirmation
- **Proposal Operations**: Execution result and any returned data
- **Gas Estimation**: Estimated gas parameters for offline transactions

## Common Issues

**"Proposal not found or expired"**
- Solution: Verify proposal parameters and ensure it hasn't expired

**"Only governance can execute this action"**
- Solution: Ensure the calling account has governance permissions

**"Invalid proposal parameters"**
- Solution: Check target address, entry point selector, and calldata format

**"Time lock not expired"**
- Solution: Wait for the time lock period to expire before execution

**"Insufficient operatorship permissions"**
- Solution: Verify the account has operator privileges for operator proposals

## Notes

- Replace all placeholder addresses and values with actual governance data
- For testnet, you can get test ETH from the Starknet faucet
- Governance operations require specific permissions and time locks
- Entry point selectors can be calculated using Cairo/Starknet.js selector functions
- Calldata must be properly formatted as Cairo-serialized felt252 arrays
- For offline transactions, follow up with the signing and broadcasting workflow
- Governance proposals often have time delays and require careful parameter verification
