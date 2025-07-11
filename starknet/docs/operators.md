# Operators Test Commands

This file contains example commands for testing all operators functions. Replace the placeholder values with actual values from your test environment.

## Prerequisites

Make sure you have:
- A funded account on testnet
- The operators contract deployed
- Valid test data for each command

## Environment Vars

If you prefer using env vars, instead of --env --privateKey and --accountAddress you can use the following env vars:

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
Usage: operators [options] [command]

Interact with Operators contract on Starknet

Options:
  -V, --version                                                                output the version number
  -h, --help                                                                   display help for command

Commands:
  is-operator [options] <account>                                              Check if an account is an operator
  add-operator [options] <operator>                                            Add a new operator
  remove-operator [options] <operator>                                         Remove an operator
  execute-contract [options] <target> <functionName> <calldata> <nativeValue>  Execute an external contract call
  help [command]                                                               display help for command
```

## Write Commands (Support --offline and --estimate)

### 1. Add Operator

```bash
# Basic add operator
npx ts-node operators.ts add-operator "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node operators.ts add-operator "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate

# Offline transaction
npx ts-node operators.ts add-operator "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet --offline
```

### 2. Remove Operator

```bash
# Basic remove operator
npx ts-node operators.ts remove-operator "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node operators.ts remove-operator "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate

# Offline transaction
npx ts-node operators.ts remove-operator "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet --offline
```

### 3. Execute Contract

```bash
# Basic execute using function name (automatically calculates selector)
# Note: calldata should be a JSON array of felt252 values
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "transfer" '["0x6789abcdef", "0x1000", "0x0"]' "0" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# Example with approve function
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "approve" '["0x6789abcdef", "0x1000", "0x0"]' "0" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# Example with balance_of function (view function)
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "balance_of" '["0x6789abcdef"]' "0" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With native value (sending ETH)
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "deposit" '[]' "1000000000000000000" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "transfer" '["0x123", "0x1000", "0x0"]' "0" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate

# Offline transaction
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "transfer" '["0x123", "0x1000", "0x0"]' "0" --env testnet --offline
```

## Read Commands (No private key needed)

### 4. Is Operator

```bash
npx ts-node operators.ts is-operator "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet
```

## Notes

- Replace all placeholder addresses with actual test data
- For testnet, you can get test ETH from the Starknet faucet
- Contract addresses should be in hex format (0x...)
- The calldata array should contain felt252 values as hex strings
- Function names are automatically converted to entry point selectors using the starknet.js selector utility
- Use the exact function name as defined in the Cairo contract (e.g., "transfer", "balance_of", "approve")
- Native value is specified as a u256 (can be decimal string or hex)
- For offline transactions, follow up with the signing and broadcasting workflow
- Only operators can call add_operator, remove_operator, and execute_contract functions
- The execute_contract function allows operators to make arbitrary contract calls

