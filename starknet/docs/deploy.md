# Contract Deployment Commands

This file contains example commands for deploying contracts on Starknet. Contract deployment creates an instance of a declared contract at a specific address.

## Prerequisites

Make sure you have:
- A funded account on testnet
- Contract already declared (class hash available in config)
- Valid account credentials
- For mainnet: Ledger hardware wallet

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
Usage: deploy-contract [options]

Deploy Starknet contracts

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
  --contractConfigName <contractConfigName>        name of the contract configuration to use
  --constructorCalldata <constructorCalldata>      constructor calldata as JSON array
  --salt <salt>                                    salt for deterministic deployment (default: "0", env: SALT)
  --l1GasMaxAmount <l1GasMaxAmount>                maximum L1 gas amount (default: 0) (default: "0", env: L1_GAS_MAX_AMOUNT)
  --l1GasMaxPricePerUnit <l1GasMaxPricePerUnit>    maximum L1 gas price per unit in wei (default: 0) (default: "0", env: L1_GAS_MAX_PRICE_PER_UNIT)
  --l2GasMaxAmount <l2GasMaxAmount>                maximum L2 gas amount (default: 0) (default: "0", env: L2_GAS_MAX_AMOUNT)
  --l2GasMaxPricePerUnit <l2GasMaxPricePerUnit>    maximum L2 gas price per unit in wei (default: 0) (default: "0", env: L2_GAS_MAX_PRICE_PER_UNIT)
  --l1DataMaxAmount <l1DataMaxAmount>              maximum L1 data amount (default: 0) (default: "0", env: L1_DATA_MAX_AMOUNT)
  --l1DataMaxPricePerUnit <l1DataMaxPricePerUnit>  maximum L1 data price per unit in wei (default: 0) (default: "0", env: L1_DATA_MAX_PRICE_PER_UNIT)
  -h, --help                                       display help for command
```

## Write Commands (Support --offline and --estimate)

### Basic Contract Deployment

```bash
npx ts-node starknet/deploy-contract.ts \
  --env testnet \
  --contractConfigName MyContract \
  --constructorCalldata '["0xparam1", "0xparam2"]' \
  --salt 0x123 \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

### Deployment with Gas Estimation

```bash
npx ts-node starknet/deploy-contract.ts \
  --env mainnet \
  --contractConfigName MyContract \
  --constructorCalldata '["0xparam1"]' \
  --salt 0x123 \
  --estimate \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

### Offline Transaction Generation

```bash
npx ts-node starknet/deploy-contract.ts \
  --env mainnet \
  --contractConfigName MyContract \
  --constructorCalldata '["0xparam1"]' \
  --salt 0x123 \
  --offline \
  --nonce 5 \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS \
  --l1GasMaxAmount 50000 \
  --l1GasMaxPricePerUnit 100000000000 \
  --l2GasMaxAmount 1000000 \
  --l2GasMaxPricePerUnit 1000000000
```

## Constructor Calldata Format

Constructor arguments must be Cairo serialized and provided as a JSON array string:
- Empty constructor: `'[]'`
- Single parameter: `'["0x1234"]'`
- Multiple parameters: `'["0x1234", "0x5678", "0x0", ...]'`

## Deterministic Addresses

Using a salt allows for deterministic contract addresses:
- Same salt + same constructor args = same address
- Salt can be any valid hex value

## Output

Successful deployment will show:
- Contract Address: The deployed contract address
- Transaction Hash: The deployment transaction hash
- Axelar JSON configuration update with deployment details

## Common Issues

**"Class hash not found in config"**
- Solution: Ensure contract is declared first using declare-contract.ts

**"Invalid constructor calldata"**
- Solution: Verify JSON array format and parameter types

**"Nonce is required for offline transaction"**
- Solution: Add --nonce flag with current account nonce

**"Salt already used"**
- Solution: Use a different salt value for unique address

## Notes

- Contract must be declared before deployment
- Salt is optional but recommended for deterministic addresses
- Constructor calldata must match contract's constructor signature
- Deployment saves contract address to config for future reference
- For mainnet, it's required to use offline workflow with hardware wallets
