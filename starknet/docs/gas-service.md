# Gas Service Test Commands

This file contains example commands for testing all gas service functions. Replace the placeholder values with actual values from your test environment.

## Prerequisites

Make sure you have:
- A funded account on testnet
- The gas service contract deployed
- Any supported ERC20 token for testing gas payments (currently STRK only)
- Valid test data for each command

## Data Structure Notes

### Contracts and Amounts Structure (for collect)
```json
[
  {
    "contract_address": "0x...",    // ERC20 token contract address (currently STRK only)

    "amount": "1000000"             // Amount to collect (will be converted to u256)
  }
]
```

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
Usage: gas-service [options] [command]

Interact with the Axelar Gas Service contract on Starknet

Options:
  -h, --help         display help for command

Commands:
  collect [options]  Collect accumulated fees from the contract
  refund [options]   Refund tokens to a receiver address
  add-gas [options]  Add additional gas payment for GMP contract call
  pay-gas [options]  Pay for gas for a GMP contract call
  help [command]     display help for command
```

## Write Commands (Support --offline and --estimate)

### 1. Collect Fees

Collect accumulated fees from the contract. Only callable by the gas collector authority, which is usually the operators contract.

```bash
# Basic collect
npx ts-node gas-service.ts collect \
  --receiverAddress $TEST_RECEIVER_ADDRESS \
  --contractsAmounts '[{"contract_address": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", "amount": "1000000"}]' \
  --env testnet \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node gas-service.ts collect \
  --receiverAddress $TEST_RECEIVER_ADDRESS \
  --contractsAmounts '[{"contract_address": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", "amount": "1000000"}]' \
  --env testnet \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --estimate

# Offline transaction
npx ts-node gas-service.ts collect \
  --receiverAddress $TEST_RECEIVER_ADDRESS \
  --contractsAmounts '[{"contract_address": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", "amount": "1000000"}]' \
  --env testnet \
  --offline

# Multiple tokens collection
npx ts-node gas-service.ts collect \
  --receiverAddress $TEST_RECEIVER_ADDRESS \
  --contractsAmounts '[{"contract_address": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", "amount": "1000000"}, {"contract_address": "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8", "amount": "500000"}]' \
  --env testnet \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

### 2. Refund Tokens

Refund tokens to a specific address. Only callable by the gas collector authority, which is usually the operators contract.

```bash
# Basic refund
npx ts-node gas-service.ts refund \
  --txHash "0x1234" \
  --logIndex 0 \
  --receiverAddress $TEST_RECEIVER_ADDRESS \
  --tokenAddress $TEST_TOKEN_ADDRESS \
  --amount "500000" \
  --env testnet \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node gas-service.ts refund \
  --txHash "0x1234" \
  --logIndex 0 \
  --receiverAddress $TEST_RECEIVER_ADDRESS \
  --tokenAddress $TEST_TOKEN_ADDRESS \
  --amount "500000" \
  --env testnet \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --estimate

# Offline transaction
npx ts-node gas-service.ts refund \
  --txHash "0x1234" \
  --logIndex 0 \
  --receiverAddress $TEST_RECEIVER_ADDRESS \
  --tokenAddress $TEST_TOKEN_ADDRESS \
  --amount "500000" \
  --env testnet \
  --offline
```

### 3. Add Gas for GMP Contract Call

Add additional gas payment for an existing GMP contract call.

```bash
# Basic add gas
npx ts-node gas-service.ts add-gas \
  --txHash "0x1234" \
  --logIndex 1 \
  --tokenAddress $TEST_TOKEN_ADDRESS \
  --refundAddress $TEST_RECEIVER_ADDRESS \
  --amount "100000" \
  --env testnet \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node gas-service.ts add-gas \
  --txHash "0x1234" \
  --logIndex 1 \
  --tokenAddress $TEST_TOKEN_ADDRESS \
  --refundAddress $TEST_RECEIVER_ADDRESS \
  --amount "100000" \
  --env testnet \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --estimate

# Offline transaction
npx ts-node gas-service.ts add-gas \
  --txHash "0x1234" \
  --logIndex 1 \
  --tokenAddress $TEST_TOKEN_ADDRESS \
  --refundAddress $TEST_RECEIVER_ADDRESS \
  --amount "100000" \
  --env testnet \
  --offline
```

### 4. Pay Gas for GMP Contract Call

Pay for gas for a new GMP contract call before making the cross-chain call.

```bash
# Basic pay gas
npx ts-node gas-service.ts pay-gas \
  --destinationChain "ethereum" \
  --destinationAddress "0x742d35Cc6634C0532925a3b844Bc9e7595f8b9d0" \
  --payloadHash "0x1234" \
  --tokenAddress $TEST_TOKEN_ADDRESS \
  --refundAddress $TEST_RECEIVER_ADDRESS \
  --amount "200000" \
  --params "" \
  --env testnet \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node gas-service.ts pay-gas \
  --destinationChain "ethereum" \
  --destinationAddress "0x742d35Cc6634C0532925a3b844Bc9e7595f8b9d0" \
  --payloadHash "0x1234" \
  --tokenAddress $TEST_TOKEN_ADDRESS \
  --refundAddress $TEST_RECEIVER_ADDRESS \
  --amount "200000" \
  --params "" \
  --env testnet \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --estimate

# Offline transaction
npx ts-node gas-service.ts pay-gas \
  --destinationChain "ethereum" \
  --destinationAddress "0x742d35Cc6634C0532925a3b844Bc9e7595f8b9d0" \
  --payloadHash "0x1234" \
  --tokenAddress $TEST_TOKEN_ADDRESS \
  --refundAddress $TEST_RECEIVER_ADDRESS \
  --amount "200000" \
  --params "" \
  --env testnet \
  --offline

## Notes

- Only the gas collector authority can call `collect` and `refund` functions
- Regular users can call `add_gas` and `pay_gas` functions
- All amounts are in the token's smallest unit (e.g., FRI for STRK)
- The `txHash` parameter should be a valid felt252 value
- The `logIndex` parameter is a u64 value
- The `payloadHash` should be a valid u256 value (can be represented as hex string)
- The `params` field in `pay_gas` is a string that will be converted to ByteArray and emitted in the event
- For offline transactions, you'll need to follow up with the signing and broadcasting workflow
- Make sure to approve the gas service contract to spend your tokens before calling `pay_gas` or `add_gas`
