# Contract Declaration Commands

This file contains example commands for declaring contracts on Starknet. Contract declaration is the process of registering a contract's bytecode on-chain, which returns a class hash that can be used for deployments.

## Prerequisites

Make sure you have:
- A funded account
- Compiled contract artifacts
- Valid account credentials

## Important Notes

- Contract declaration is **online only**
- Both Sierra (.contract_class.json) and CASM (.compiled_contract_class.json) files are required. They are generated after building the contracts.
- The CASM file should be in the same directory with the same base name. This is the default naming after a `scarb build`.
- Class hash is saved to the Axelar JSON config file for later use in deployment

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

## Declaring Workflow

1. **Verify account has funds**:
   ```bash
   # Check your account balance before declaring
   starkli account fetch $STARKNET_ACCOUNT_ADDRESS --rpc $RPC_URL
   ```

2. **Declare the contract**:
   ```bash
   npx ts-node starknet/declare-contract.ts \
     --env testnet \
     --contractConfigName YourContract \
     --contractPath ./path/to/YourContract.contract_class.json \
     --privateKey $STARKNET_PRIVATE_KEY \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

3. **Verify declaration**:
   - Check the class hash in a Starknet explorer of your choosing
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

**"Class with hash 0x... is already declared"**
- There is already a contract with this class hash declared on chain
- You can use the class hash to deploy a new instance of this contract if you want

## Notes

- Declaration is a one-time operation per contract version
- The same contract code will always produce the same class hash
- Class hash is required for contract deployment
- Keep track of class hashes for different contract versions
