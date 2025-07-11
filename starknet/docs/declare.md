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

## Environment Vars

If you prefer using env vars, instead of --env --privateKey and --accountAddress you can use the following env vars:

```bash
# For gas estimation (online)
export ENV=testnet
export STARKNET_PRIVATE_KEY=0x...
export STARKNET_ACCOUNT_ADDRESS=0x...

```

## Command Options

```
Usage: declare-contract [options]

Declare Starknet contracts and save class hash to config

Options:
  -V, --version                              output the version number
  -e, --env <env>                            environment (choices: "devnet-amplifier", "mainnet", "stagenet", "testnet", default: "testnet", env: ENV)
  -y, --yes                                  skip deployment prompt confirmation (env: YES)
  -p, --privateKey < privateKey >            private key for Starknet account(testnet only, not required for offline tx generation) (env: STARKNET_PRIVATE_KEY)
  --accountAddress <accountAddress>          Starknet account address (env: STARKNET_ACCOUNT_ADDRESS)
  --contractConfigName <contractConfigName>  name to store in config for this contract
  --contractPath <contractPath>              path to the contract JSON file
  -h, --help                                 display help for command
```

## Declare Contract Commands

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
