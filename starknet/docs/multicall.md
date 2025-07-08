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

## Environment Setup

```bash
# Set your test environment
export STARKNET_ENV=testnet

# Set your test account (for online transactions)
export STARKNET_PRIVATE_KEY=0x1234...
export STARKNET_ACCOUNT_ADDRESS=0x5678...
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

## Command Options

### Required Options
- First argument: Path to multicall configuration JSON file
- `--env`: Environment (testnet, mainnet)
- `--accountAddress`: Account address for transaction

### Optional Options
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

## Testing Workflow

1. **Create configuration file**:
   ```bash
   # Create a test multicall configuration
   cat > test-multicall.json << EOF
   {
     "calls": [
       {
         "contract_address": "0xYOUR_CONTRACT",
         "entrypoint": "function_name",
         "calldata": ["param1", "param2"]
       }
     ]
   }
   EOF
   ```

2. **Test with gas estimation**:
   ```bash
   npx ts-node starknet/multicall.ts test-multicall.json \
     --env testnet \
     --estimate \
     --privateKey $STARKNET_PRIVATE_KEY \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

3. **Execute multicall**:
   ```bash
   npx ts-node starknet/multicall.ts test-multicall.json \
     --env testnet \
     --privateKey $STARKNET_PRIVATE_KEY \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

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
