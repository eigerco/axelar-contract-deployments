# Multicall Operations

This file contains example commands for executing multiple contract calls in a single transaction. Multicall operations help save gas and improve efficiency by batching multiple operations together.

## Prerequisites

Make sure you have:
- A funded account on testnet
- Target contracts deployed and accessible
- Valid account credentials
- For mainnet: Ledger hardware wallet

## Multicall Configuration

Create a JSON configuration file specifying all calls to execute. Each call requires:
- `contract_address`: The target contract address
- `entrypoint`: The function to call
- `calldata`: Array of parameters for the function

### Example Configuration File

```json
{
  "calls": [
    {
      "contract_address": "0x04c1d9da136846ab084ae18cf6ce7a652df7793b666a16ce46b1bf5850cc739d",
      "entrypoint": "call_contract",
      "calldata": ["ethereum", "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7", "0x1234567890abcdef"]
    },
    {
      "contract_address": "0x01234567890abcdef01234567890abcdef01234567890abcdef01234567890a",
      "entrypoint": "pay_gas",
      "calldata": ["0x1234567890abcdef1234567890abcdef12345678", "ethereum", "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7", "100000", "0x1234567890abcdef1234567890abcdef12345678"]
    }
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
Usage: multicall [options] <config>

Execute multiple contract calls in a single transaction on Starknet

Arguments:
  config                                           path to multicall configuration JSON file

Options:
  -V, --version                                    output the version number
  -e, --env <env>                                  environment (choices: "devnet-amplifier", "mainnet", "stagenet", "testnet", default: "testnet", env: ENV)
  -y, --yes                                        skip deployment prompt confirmation (env: YES)
  -p, --privateKey < privateKey >                  private key for Starknet account(testnet only, not required for offline tx generation) (env: STARKNET_PRIVATE_KEY)
  --accountAddress <accountAddress>                Starknet account address (env: STARKNET_ACCOUNT_ADDRESS)
  --offline                                        generate unsigned transaction for offline signing (env: OFFLINE)
  --estimate                                       estimate gas for this transaction and display CLI args to copy (env: ESTIMATE)
  --outputDir <outputDir>                          output directory for unsigned transactions (required for --offline) (default: "./starknet-offline-txs", env: OUTPUT_DIR)
  --nonce <nonce>                                  nonce for offline transaction generation (required for --offline) (env: NONCE)
  --l1GasMaxAmount <l1GasMaxAmount>                maximum L1 gas amount (default: 0) (default: "0", env: L1_GAS_MAX_AMOUNT)
  --l1GasMaxPricePerUnit <l1GasMaxPricePerUnit>    maximum L1 gas price per unit in wei (default: 0) (default: "0", env: L1_GAS_MAX_PRICE_PER_UNIT)
  --l2GasMaxAmount <l2GasMaxAmount>                maximum L2 gas amount (default: 0) (default: "0", env: L2_GAS_MAX_AMOUNT)
  --l2GasMaxPricePerUnit <l2GasMaxPricePerUnit>    maximum L2 gas price per unit in wei (default: 0) (default: "0", env: L2_GAS_MAX_PRICE_PER_UNIT)
  --l1DataMaxAmount <l1DataMaxAmount>              maximum L1 data amount (default: 0) (default: "0", env: L1_DATA_MAX_AMOUNT)
  --l1DataMaxPricePerUnit <l1DataMaxPricePerUnit>  maximum L1 data price per unit in wei (default: 0) (default: "0", env: L1_DATA_MAX_PRICE_PER_UNIT)
  -h, --help                                       display help for command
```

## Write Commands (Support --offline and --estimate)

### Online Multicall (Testnet)

```bash
npx ts-node starknet/multicall.ts examples/multicall-example.json \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

### Offline Multicall (Mainnet)

**Step 1: Estimate Gas**
```bash
npx ts-node starknet/multicall.ts examples/multicall-example.json \
  --env mainnet \
  --estimate \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Step 2: Generate Unsigned Transaction**
```bash
npx ts-node starknet/multicall.ts examples/multicall-example.json \
  --env mainnet \
  --offline \
  --nonce 5 \
  --accountAddress 0x... \
  --l1GasMaxAmount 100000 \
  --l1GasMaxPricePerUnit 100000000000 \
  --l2GasMaxAmount 2000000 \
  --l2GasMaxPricePerUnit 1000000000
```

The remaining steps (sign, combine signatures, broadcast) follow the same workflow as single transactions.

## Common Multicall Use Cases

### Gateway + Gas Service
Call contract on another chain and pay for gas in one transaction:
```json
{
  "calls": [
    {
      "contract_address": "0xGATEWAY_ADDRESS",
      "entrypoint": "call_contract",
      "calldata": ["ethereum", "0xRECIPIENT", "0xPAYLOAD"]
    },
    {
      "contract_address": "0xGAS_SERVICE_ADDRESS",
      "entrypoint": "pay_gas",
      "calldata": ["0xTX_HASH", "ethereum", "0xRECIPIENT", "100000", "0xREFUND_ADDRESS"]
    }
  ]
}
```

### Batch Approvals
Approve multiple messages in a single transaction:
```json
{
  "calls": [
    {
      "contract_address": "0xCONTRACT_ADDRESS",
      "entrypoint": "approve",
      "calldata": ["0xSPENDER1", "1000000"]
    },
    {
      "contract_address": "0xCONTRACT_ADDRESS",
      "entrypoint": "approve",
      "calldata": ["0xSPENDER2", "2000000"]
    }
  ]
}
```

### Complex Operations
Combine governance operations with contract calls for atomic execution.

### Gas Optimization
Reduce transaction count and save on gas fees by batching related operations.

## Output

Successful multicall will show:
- Transaction Hash: The multicall transaction hash
- Individual call results (if applicable)
- Gas used for the entire operation

## Common Issues

**"Invalid JSON format"**
- Solution: Verify JSON syntax and structure

**"Contract not found"**
- Solution: Ensure all contract addresses are valid

**"Entrypoint not found"**
- Solution: Verify function names match contract ABI

**"Invalid calldata"**
- Solution: Check parameter types and order match function signature

## Notes

- All calls in a multicall execute atomically - if one fails, all fail
- Order matters - calls execute in the order specified
- Gas estimation accounts for all calls combined
- Multicall can significantly reduce gas costs for related operations
- Test complex multicalls thoroughly before mainnet deployment
