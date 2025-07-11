# Contract Upgrade Commands

This file contains example commands for upgrading contracts on Starknet. Contract upgrades allow you to update the implementation of an existing contract while preserving its address and state.

## Prerequisites

Make sure you have:
- A funded account on testnet
- An upgradeable contract already deployed
- New contract class already declared
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
Usage: upgrade-contract [options]

Upgrade Starknet contracts

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
  --classHash <classHash>                          new class hash for contract upgrade
  --contractAddress <contractAddress>              contract address (optional if already in config) (env: CONTRACT_ADDRESS)
  --l1GasMaxAmount <l1GasMaxAmount>                maximum L1 gas amount (default: 0) (default: "0", env: L1_GAS_MAX_AMOUNT)
  --l1GasMaxPricePerUnit <l1GasMaxPricePerUnit>    maximum L1 gas price per unit in wei (default: 0) (default: "0", env: L1_GAS_MAX_PRICE_PER_UNIT)
  --l2GasMaxAmount <l2GasMaxAmount>                maximum L2 gas amount (default: 0) (default: "0", env: L2_GAS_MAX_AMOUNT)
  --l2GasMaxPricePerUnit <l2GasMaxPricePerUnit>    maximum L2 gas price per unit in wei (default: 0) (default: "0", env: L2_GAS_MAX_PRICE_PER_UNIT)
  --l1DataMaxAmount <l1DataMaxAmount>              maximum L1 data amount (default: 0) (default: "0", env: L1_DATA_MAX_AMOUNT)
  --l1DataMaxPricePerUnit <l1DataMaxPricePerUnit>  maximum L1 data price per unit in wei (default: 0) (default: "0", env: L1_DATA_MAX_PRICE_PER_UNIT)
  -h, --help                                       display help for command
```

## Write Commands (Support --offline and --estimate)

### Online Upgrade (Testnet)

```bash
npx ts-node starknet/upgrade-contract.ts \
  --env testnet \
  --contractConfigName AxelarGateway \
  --classHash 0xNewClassHash... \
  --privateKey 0x... \
  --accountAddress 0x...
```

### Offline Upgrade (Mainnet)

**Step 1: Estimate Gas (Online Environment)**
```bash
npx ts-node starknet/upgrade-contract.ts \
  --env mainnet \
  --contractConfigName AxelarGateway \
  --classHash 0xNewClassHash... \
  --estimate \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Step 2: Generate Unsigned Transaction (Offline Environment)**
```bash
npx ts-node starknet/upgrade-contract.ts \
  --env mainnet \
  --contractConfigName AxelarGateway \
  --classHash 0xNewClassHash... \
  --offline \
  --nonce 6 \
  --accountAddress 0x... \
  --l1GasMaxAmount 30000 \
  --l1GasMaxPricePerUnit 100000000000 \
  --l2GasMaxAmount 500000 \
  --l2GasMaxPricePerUnit 1000000000
```

## Command Options

### Required Options

- `--env`: Environment (testnet, mainnet) - if not env var has been set
- `--contractConfigName`: Contract configuration to upgrade
- `--classHash`: New class hash for upgrade
- `--accountAddress`: Account address for transaction - if not env var has been set

### Optional Options
- `--contractAddress`: Contract address (uses config if not provided)
- `--privateKey`: Private key (required for online, not for offline) - if not env var has been set
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

## Upgrade Workflow

### For Testnet (Online)

1. **Declare new contract version**:
   ```bash
   npx ts-node starknet/declare-contract.ts \
     --contractConfigName AxelarGatewayV2 \
     --contractPath ./artifacts/AxelarGatewayV2.contract_class.json \
     --privateKey $STARKNET_PRIVATE_KEY \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

2. **Upgrade the contract**:
   ```bash
   npx ts-node starknet/upgrade-contract.ts \
     --env testnet \
     --contractConfigName AxelarGateway \
     --classHash 0xNewClassHash... \
     --privateKey $STARKNET_PRIVATE_KEY \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

### For Mainnet (Offline)

1. **Declare new contract version** (follow declare workflow)

2. **Estimate gas on online machine**:
   ```bash
   npx ts-node starknet/upgrade-contract.ts \
     --env mainnet \
     --contractConfigName AxelarGateway \
     --classHash 0xNewClassHash... \
     --estimate \
     --privateKey $STARKNET_PRIVATE_KEY \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS
   ```

3. **Copy gas parameters from output**:
   ```
   --l1GasMaxAmount 30000 --l1GasMaxPricePerUnit 100000000000 --l2GasMaxAmount 500000 --l2GasMaxPricePerUnit 1000000000
   ```

4. **Generate unsigned transaction on offline machine**:
   ```bash
   npx ts-node starknet/upgrade-contract.ts \
     --env mainnet \
     --contractConfigName AxelarGateway \
     --classHash 0xNewClassHash... \
     --offline \
     --nonce 6 \
     --accountAddress $STARKNET_ACCOUNT_ADDRESS \
     --l1GasMaxAmount 30000 \
     --l1GasMaxPricePerUnit 100000000000 \
     --l2GasMaxAmount 500000 \
     --l2GasMaxPricePerUnit 1000000000
   ```

5. **Follow offline signing workflow** (see main README)

## Important Considerations

### Gateway Upgradability
- After upgrading the gateway contract, you can call init_signers again with new signers, but only once.

### Upgrade Compatibility
- New contract must be compatible with existing storage layout
- Added storage variables must go at the end
- Existing storage variable types cannot change
- Function signatures can be modified

### Authorization
- Only authorized accounts can perform upgrades
- Usually restricted to contract owner or governance
- Check contract's upgrade mechanism

### Testing
- Always test upgrades on testnet first
- Verify storage is preserved after upgrade
- Test all modified functionality

## Output

Successful upgrade will show:
- Transaction Hash: The upgrade transaction hash
- Confirmation that contract was upgraded
- New class hash is active

## Common Issues

**"Unauthorized upgrade attempt"**
- Solution: Ensure account has upgrade permissions

**"Class hash not found"**
- Solution: Verify new contract is declared first

**"Contract not found in config"**
- Solution: Check contractConfigName matches existing contract

**"Invalid class hash format"**
- Solution: Ensure class hash starts with 0x

## Notes

- Upgrades are critical operations - test thoroughly
- Contract address remains the same after upgrade
- State and storage are preserved
- Only implementation logic changes
- For mainnet, always use offline workflow with hardware wallets
- Consider using time-locked upgrades for additional security
