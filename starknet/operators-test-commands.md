# Operators Test Commands

This file contains example commands for testing all operators functions. Replace the placeholder values with actual values from your test environment.

## Prerequisites

Make sure you have:
- A funded account on testnet
- The operators contract deployed
- Valid test data for each command

## Environment Setup

```bash
# Set your test environment
export STARKNET_ENV=testnet

# Set your test account (for online transactions)
export STARKNET_PRIVATE_KEY=0x1234...
export STARKNET_ACCOUNT_ADDRESS=0x5678...
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
# Basic execute
# Note: calldata should be a JSON array of felt252 values
# Entry point selector can be computed using starkli selector command or provided as hex
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "0x362398bec32bc0ebb411203221a35a0301193a96f317ebe5e40be9f60d15320" '["0x123", "0x456"]' "0" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# Example with transfer function (selector for 'transfer')
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e" '["0x6789abcdef", "0x1000", "0x0"]' "0" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With native value (sending ETH)
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "0x362398bec32bc0ebb411203221a35a0301193a96f317ebe5e40be9f60d15320" '[]' "1000000000000000000" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "0x362398bec32bc0ebb411203221a35a0301193a96f317ebe5e40be9f60d15320" '["0x123"]' "0" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate

# Offline transaction
npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "0x362398bec32bc0ebb411203221a35a0301193a96f317ebe5e40be9f60d15320" '["0x123"]' "0" --env testnet --offline
```

## Read Commands (No private key needed)

### 4. Is Operator

```bash
npx ts-node operators.ts is-operator "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet
```

## Testing Workflow

1. **Start with read commands** to verify the operators contract is accessible:
   ```bash
   npx ts-node operators.ts is-operator $STARKNET_ACCOUNT_ADDRESS --env testnet
   ```

2. **Add yourself as operator** (if you have permission):
   ```bash
   npx ts-node operators.ts add-operator $STARKNET_ACCOUNT_ADDRESS --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

3. **Verify operator status**:
   ```bash
   npx ts-node operators.ts is-operator $STARKNET_ACCOUNT_ADDRESS --env testnet
   ```

4. **Test execute contract** with a simple call:
   ```bash
   # Example: calling a view function
   npx ts-node operators.ts execute-contract "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "0x362398bec32bc0ebb411203221a35a0301193a96f317ebe5e40be9f60d15320" '[]' "0" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

5. **Test gas estimation**:
   ```bash
   npx ts-node operators.ts add-operator "0x123" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate
   ```

6. **Test offline transaction generation**:
   ```bash
   npx ts-node operators.ts add-operator "0x123" --env testnet --offline
   ```

## Common Entry Point Selectors

Here are some common function selectors you might use with execute-contract:

```bash
# Calculate selector using starkli
starkli selector "transfer"
# Result: 0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e

starkli selector "approve"
# Result: 0x219209e083275171774dab1df80982e9df2096516f06319c5c6d71ae0a8480c

starkli selector "balance_of"
# Result: 0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e
```

## Notes

- Replace all placeholder addresses with actual test data
- For testnet, you can get test ETH from the Starknet faucet
- Contract addresses should be in hex format (0x...)
- The calldata array should contain felt252 values as hex strings
- Entry point selectors can be calculated using `starkli selector <function_name>`
- Native value is specified as a u256 (can be decimal string or hex)
- For offline transactions, follow up with the signing and broadcasting workflow
- Only operators can call add_operator, remove_operator, and execute_contract functions
- The execute_contract function allows operators to make arbitrary contract calls

