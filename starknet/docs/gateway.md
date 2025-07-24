# Gateway Commands

This guide covers Gateway deployment and operations on Starknet. All commands support both online and offline execution modes.

## Prerequisites for Deployment

Before deploying the Gateway contract, you must:

1. **Build the contract** - Compile the Gateway contract using scarb:
   ```bash
   cd /path/to/giza-axelar-starknet
   scarb build
   ```

2. **Declare the contract** - Declare the compiled contract on-chain to get its class hash:
   ```bash
   npx ts-node starknet/declare-contract.ts \
     --contractConfigName AxelarGateway \
     --contractPath /path/to/giza-axelar-starknet/target/dev/gateway_AxelarGateway.contract_class.json \
     --env testnet \
     --privateKey 0x... \
     --accountAddress 0x...
   ```

For detailed instructions on contract declaration, see the [Contract Declaration documentation](./declare.md).

## Deployment


| Network              | `minimumRotationDelay` | `deployer`                                   |
| -------------------- | ---------------------- | -------------------------------------------- |
| **Devnet-amplifier** | `0`                    | `0x03D268008DcA0F241d2cF93578e1428dB0E94bdE3db22C93bCa93873Bc72851e` |
| **Stagenet**         | `300`                  | `TBD` |
| **Testnet**          | `3600`                 | `TBD` |
| **Mainnet**          | `86400`                | `TBD` |


### Deployment

Deploy the Amplifier Gateway contract on Starknet. This is the main contract that handles cross-chain messaging and validation.

```
Usage: deploy-amplifier-gateway [options]

Deploy Amplifier Gateway contract on Starknet

Options:
  --contractConfigName <name>         Contract configuration name (e.g., AxelarGateway)
  --previousSignersRetention <value>  Previous signers retention value (default: 15)
  --minimumRotationDelay <seconds>    Minimum rotation delay in seconds (default: 86400)
  --domainSeparator <value>           Domain separator (keccak256 hash or "offline" for automatic calculation)
  --owner <address>                   Owner contract address
  --operator <address>                Operator contract address (optional)
  --salt <salt>                       Salt for deterministic deployment (default: "0")
  -e, --env <env>                     environment (choices: "devnet-amplifier",
                                      "mainnet", "stagenet", "testnet", default:
                                      "testnet", env: ENV)
  -y, --yes                           skip deployment prompt confirmation (env:
                                      YES)
  -p, --privateKey < privateKey >     private key for Starknet account(testnet
                                      only, not required for offline tx
                                      generation) (env: STARKNET_PRIVATE_KEY)
  --accountAddress <accountAddress>   Starknet account address (env:
                                      STARKNET_ACCOUNT_ADDRESS)
  --offline                           Generate unsigned transaction for offline signing
  --estimate                          Estimate gas costs
  --nonce <nonce>                     Account nonce (required for offline)
  -h, --help                          display help for command
```

**Note:** This deployment script supports offline mode and gas estimation, using the universal deployer pattern.

**Default Values:**
- `previousSignersRetention`: 15 (number of previous signer sets to retain)
- `minimumRotationDelay`: 86400 seconds (24 hours) - but consider using network-specific values shown in the table above

**Domain Separator:** 
- Use `--domainSeparator offline` to automatically calculate it using: `keccak256(axelarId + routerAddress + network)`
- Or provide a manual hex hash value (e.g., `0x123...`)
- For local deployments, it defaults to `0x0000...0000` if not provided

**Example (Online - Testnet with custom rotation delay):**
```bash
npx ts-node starknet/deploy-amplifier-gateway.ts \
  --env testnet \
  --contractConfigName AxelarGateway \
  --minimumRotationDelay 3600 \
  --domainSeparator offline \
  --owner 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  --operator 0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210 \
  --salt 0x123 \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Example (Offline - Step 1: Estimate Gas):**
```bash
npx ts-node starknet/deploy-amplifier-gateway.ts \
  --env testnet \
  --contractConfigName AxelarGateway \
  --domainSeparator offline \
  --owner 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  --salt 0x123 \
  --privateKey 0x... \
  --accountAddress 0x... \
  --estimate
```

**Example (Offline - Step 2: Generate Unsigned Transaction):**
```bash
npx ts-node starknet/deploy-amplifier-gateway.ts \
  --env mainnet \
  --contractConfigName AxelarGateway \
  --domainSeparator offline \
  --owner 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  --salt 0x123 \
  --accountAddress 0x... \
  --offline \
  --nonce 5 \
  --l1GasMaxAmount 100000 \
  --l1GasMaxPricePerUnit 100 \
  --l2GasMaxAmount 100000 \
  --l2GasMaxPricePerUnit 100
```

Note: The script uses default values for previousSignersRetention (15) and minimumRotationDelay (86400). Override them only if needed for your specific deployment.

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

## Output

Successful gateway operations will show:
- Transaction Hash: The transaction hash for write operations
- Result: Operation-specific results (e.g., operator address, epoch number)
- Gas consumption details for transactions

## Common Issues

**"Invalid JSON format in messages or proof"**
- Solution: Ensure JSON strings are properly formatted and escaped

**"Contract address not found"**
- Solution: Verify the gateway contract is deployed and configured correctly

**"Invalid signature format"**
- Solution: Signatures must be arrays of byte arrays, e.g., `[[1,2,3,4], [5,6,7,8]]`

**"Insufficient threshold for signatures"**
- Solution: Ensure enough valid signatures are provided to meet the threshold

**"Message already approved/executed"**
- Solution: Check message status before attempting to approve or execute

## Notes

- Replace all placeholder addresses and values with actual test data
- For testnet, you can get test ETH from the Starknet faucet
- The JSON arguments for `approve-messages` and `rotate-signers` must be valid JSON strings with the proper structure shown above
- Contract addresses should be in hex format (0x...)
- String fields in Message structs (`source_chain`, `message_id`, `source_address`) are automatically converted to ByteArrays
- Signatures in the Proof structure should be arrays of byte arrays (e.g., `[[1,2,3,4], [5,6,7,8]]`)
- For offline transactions, you'll need to follow up with the signing and broadcasting workflow
- The `payload_hash` should be a valid u256 value (can be represented as hex string)
