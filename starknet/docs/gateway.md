# Gateway Test Commands

This file contains example commands for testing all gateway functions. Replace the placeholder values with actual values from your test environment.

## Prerequisites

Make sure you have:
- A funded account on testnet
- The gateway contract deployed
- Valid test data for each command

## Data Structure Notes

### Message Structure
```json
{
  "source_chain": "string",         // Will be converted to ByteArray
  "message_id": "string",           // Will be converted to ByteArray
  "source_address": "string",       // Will be converted to ByteArray
  "contract_address": "0x...",      // Starknet contract address (felt252)
  "payload_hash": "0x..."           // u256 hash value
}
```

### Proof Structure
```json
{
  "signers": {                      // WeightedSigners struct
    "signers": [                    // Array of WeightedSigner
      {
        "signer": "0x...",          // felt252 address
        "weight": 1                 // u128 weight
      }
    ],
    "threshold": 2,                 // u128 threshold
    "nonce": "0x1"                  // u256 nonce
  },
  "signatures": [                   // Array<Array<u8>>
    [1,2,3,4],                   // Each signature as array of bytes
    [5,6,7,8]
  ]
}
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
Usage: gateway [options] [command]

Interact with Axelar Gateway on Starknet

Options:
  -V, --version                                                                                            output the version number
  -h, --help                                                                                               display help for command

Commands:
  call-contract [options] <destinationChain> <destinationContractAddress> <payload>                        Call a contract on another chain
  approve-messages [options] <messages> <proof>                                                            Approve messages
  validate-message [options] <sourceChain> <messageId> <sourceAddress> <payloadHash>                       Validate a message
  rotate-signers [options] <newSigners> <proof>                                                            Rotate gateway signers
  is-message-approved [options] <sourceChain> <messageId> <sourceAddress> <contractAddress> <payloadHash>  Check if message is approved
  is-message-executed [options] <sourceChain> <messageId>                                                  Check if message is executed
  transfer-operatorship [options] <newOperator>                                                            Transfer gateway operatorship
  get-operator [options]                                                                                   Get current operator
  get-epoch [options]                                                                                      Get current epoch
  init-signers [options] <signers>                                                                         Initialize gateway signers (can only be called once after deployment or upgrade)
  help [command]                                                                                           display help for command
```

## Write Commands (Support --offline and --estimate)

### 1. Call Contract

```bash
# Basic call
npx ts-node gateway.ts call-contract "ethereum" "0x1234567890123456789012345678901234567890" "Hello from Starknet" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node gateway.ts call-contract "ethereum" "0x1234567890123456789012345678901234567890" "Hello from Starknet" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate

# Offline transaction
npx ts-node gateway.ts call-contract "ethereum" "0x1234567890123456789012345678901234567890" "Hello from Starknet" --env testnet --offline
```

### 2. Approve Messages

```bash
# Basic approve
# Note: Messages array contains objects with string fields that will be converted to ByteArrays
# Proof contains WeightedSigners and signatures array
npx ts-node gateway.ts approve-messages '[{"source_chain": "ethereum", "message_id": "msg123", "source_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8b9d0", "contract_address": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", "payload_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"}]' '{"signers": {"signers": [{"signer": "0x123", "weight": 1}, {"signer": "0x456", "weight": 1}], "threshold": 2, "nonce": "0x1"}, "signatures": [[1,2,3,4], [5,6,7,8]]}' --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node gateway.ts approve-messages '[{"source_chain": "ethereum", "message_id": "msg123", "source_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8b9d0", "contract_address": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", "payload_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"}]' '{"signers": {"signers": [{"signer": "0x123", "weight": 1}, {"signer": "0x456", "weight": 1}], "threshold": 2, "nonce": "0x1"}, "signatures": [[1,2,3,4], [5,6,7,8]]}' --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate

# Offline transaction
npx ts-node gateway.ts approve-messages '[{"source_chain": "ethereum", "message_id": "msg123", "source_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8b9d0", "contract_address": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", "payload_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"}]' '{"signers": {"signers": [{"signer": "0x123", "weight": 1}, {"signer": "0x456", "weight": 1}], "threshold": 2, "nonce": "0x1"}, "signatures": [[1,2,3,4], [5,6,7,8]]}' --env testnet --offline
```

### 3. Validate Message

```bash
# Basic validate
npx ts-node gateway.ts validate-message "ethereum" "0x123456" "0x1234567890123456789012345678901234567890" "0x9876543210" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node gateway.ts validate-message "ethereum" "0x123456" "0x1234567890123456789012345678901234567890" "0x9876543210" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate

# Offline transaction
npx ts-node gateway.ts validate-message "ethereum" "0x123456" "0x1234567890123456789012345678901234567890" "0x9876543210" --env testnet --offline
```

### 4. Rotate Signers

```bash
# Basic rotate
# Note: newSigners is a WeightedSigners struct with signers array, threshold, and nonce
# Proof contains the current WeightedSigners and signatures array
npx ts-node gateway.ts rotate-signers '{"signers": [{"signer": "0x111", "weight": 1}, {"signer": "0x222", "weight": 1}], "threshold": 2, "nonce": "0x2"}' '{"signers": {"signers": [{"signer": "0x123", "weight": 1}, {"signer": "0x456", "weight": 1}], "threshold": 2, "nonce": "0x1"}, "signatures": [[1,2,3,4], [5,6,7,8]]}' --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node gateway.ts rotate-signers '{"signers": [{"signer": "0x111", "weight": 1}, {"signer": "0x222", "weight": 1}], "threshold": 2, "nonce": "0x2"}' '{"signers": {"signers": [{"signer": "0x123", "weight": 1}, {"signer": "0x456", "weight": 1}], "threshold": 2, "nonce": "0x1"}, "signatures": [[1,2,3,4]], [[5,6,7,8]]}' --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate

# Offline transaction
npx ts-node gateway.ts rotate-signers '{"signers": [{"signer": "0x111", "weight": 1}, {"signer": "0x222", "weight": 1}], "threshold": 2, "nonce": "0x2"}' '{"signers": {"signers": [{"signer": "0x123", "weight": 1}, {"signer": "0x456", "weight": 1}], "threshold": 2, "nonce": "0x1"}, "signatures": [[1,2,3,4]], [[5,6,7,8]]}' --env testnet --offline
```

### 5. Initialize Signers

```bash
# Basic init signers (can only be called once after deployment or upgrade)
# Note: signers is an array of WeightedSigners structs
# Each WeightedSigners struct contains: signers array, threshold, and nonce
npx ts-node gateway.ts init-signers '[{"signers": [{"signer": "0x123", "weight": 1}, {"signer": "0x456", "weight": 1}], "threshold": 2, "nonce": "0x1"}]' --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With optional operator address
npx ts-node gateway.ts init-signers '[{"signers": [{"signer": "0x123", "weight": 1}, {"signer": "0x456", "weight": 1}], "threshold": 2, "nonce": "0x1"}]' --operator "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node gateway.ts init-signers '[{"signers": [{"signer": "0x123", "weight": 1}, {"signer": "0x456", "weight": 1}], "threshold": 2, "nonce": "0x1"}]' --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate

# Offline transaction
npx ts-node gateway.ts init-signers '[{"signers": [{"signer": "0x123", "weight": 1}, {"signer": "0x456", "weight": 1}], "threshold": 2, "nonce": "0x1"}]' --env testnet --offline

# Multiple signer sets example
npx ts-node gateway.ts init-signers '[{"signers": [{"signer": "0x123", "weight": 1}], "threshold": 1, "nonce": "0x1"}, {"signers": [{"signer": "0x456", "weight": 2}], "threshold": 2, "nonce": "0x2"}]' --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

### 6. Transfer Operatorship

```bash
# Basic transfer
npx ts-node gateway.ts transfer-operatorship "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# With gas estimation
npx ts-node gateway.ts transfer-operatorship "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS --estimate

# Offline transaction
npx ts-node gateway.ts transfer-operatorship "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" --env testnet --offline
```

## Read Commands (No private key needed)

### 7. Is Message Approved

```bash
npx ts-node gateway.ts is-message-approved "ethereum" "0x123456" "0x1234567890123456789012345678901234567890" "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" "0x9876543210" --env testnet
```

### 8. Is Message Executed

```bash
npx ts-node gateway.ts is-message-executed "ethereum" "0x123456" --env testnet
```

### 9. Get Operator

```bash
npx ts-node gateway.ts get-operator --env testnet
```

### 10. Get Epoch

```bash
npx ts-node gateway.ts get-epoch --env testnet
```

## Notes

- Replace all placeholder addresses and values with actual test data
- For testnet, you can get test ETH from the Starknet faucet
- The JSON arguments for `approve-messages` and `rotate-signers` must be valid JSON strings with the proper structure shown above
- Contract addresses should be in hex format (0x...)
- String fields in Message structs (`source_chain`, `message_id`, `source_address`) are automatically converted to ByteArrays
- Signatures in the Proof structure should be arrays of byte arrays (e.g., `[[1,2,3,4], [5,6,7,8]]`)
- For offline transactions, you'll need to follow up with the signing and broadcasting workflow
- The `payload_hash` should be a valid u256 value (can be represented as hex string)
