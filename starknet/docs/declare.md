# Contract Declaration Commands

This file contains example commands for declaring contracts on Starknet. Contract declaration is the process of registering a contract's bytecode on-chain, which returns a class hash that can be used for deployments.

## Prerequisites

Make sure you have:
- A funded account on testnet
- Compiled contract artifacts (both .contract_class.json and .compiled_contract_class.json files)
- Valid account credentials

## Important Notes

- Contract declaration is **online only** - it cannot be done offline
- Both Sierra (.contract_class.json) and CASM (.compiled_contract_class.json) files are required
- The CASM file should be in the same directory with the same base name
- Class hash is saved to configuration for later use in deployment

## Environment Setup

```bash
# Set your test environment
export STARKNET_ENV=testnet

# Set your test account (required for declaration)
export STARKNET_PRIVATE_KEY=0x1234...
export STARKNET_ACCOUNT_ADDRESS=0x5678...
```

## Declare Contract Command

### Basic Declaration

```bash
npx ts-node starknet/declare-contract.ts \
  --env testnet \
  --contractConfigName AxelarGateway \
  --contractPath ./artifacts/AxelarGateway.contract_class.json \
  --privateKey 0x... \
  --accountAddress 0x...
```

### With Confirmation Skip

```bash
npx ts-node starknet/declare-contract.ts \
  --env testnet \
  --contractConfigName AxelarGateway \
  --contractPath ./artifacts/AxelarGateway.contract_class.json \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --yes
```

## Command Options

- `--env`: Environment (testnet, mainnet)
- `--contractConfigName`: Name to store in config for future reference
- `--contractPath`: Path to the Sierra contract JSON file
- `--privateKey`: Private key for transaction signing
- `--accountAddress`: Account address for transaction
- `--yes`: Skip confirmation prompts

## Testing Workflow

1. **Prepare contract artifacts**:
   - Ensure you have both Sierra and CASM files
   - Files should follow naming convention:
     - Sierra: `ContractName.contract_class.json`
     - CASM: `ContractName.compiled_contract_class.json`

2. **Verify account has funds**:
   ```bash
   # Check your account balance before declaring
   starkli account fetch $STARKNET_ACCOUNT_ADDRESS --rpc $RPC_URL
   ```

3. **Declare the contract**:
   ```bash
   npx ts-node starknet/declare-contract.ts \
     --env testnet \
     --contractConfigName YourContract \
     --contractPath ./path/to/YourContract.contract_class.json \
     --privateKey $STARKNET_PRIVATE_KEY \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

4. **Verify declaration**:
   - Check the output for the class hash
   - Verify the class hash is saved in config
   - The class hash can now be used for deployments

## Output

Successful declaration will show:
- Class Hash: The unique identifier for your contract class
- Transaction Hash: The declaration transaction hash
- Configuration update confirmation

## Common Issues

**"Failed to load contract artifact"**
- Solution: Verify the contract path is correct and file exists

**"Failed to parse CASM file"**
- Solution: Ensure CASM file exists in the same directory with correct naming

**"Account does not exist"**
- Solution: Verify your account address is correct and deployed

**"Insufficient funds"**
- Solution: Get test ETH from the Starknet faucet

## Notes

- Declaration is a one-time operation per contract version
- The same contract code will always produce the same class hash
- Class hash is required for contract deployment
- Keep track of class hashes for different contract versions
