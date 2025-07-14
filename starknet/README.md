# Starknet Deployment Scripts 🏗️

This directory contains deployment and operational scripts for Axelar contracts on Starknet. The scripts support both online and offline workflows, with hardware wallet integration for secure mainnet operations.

## 🔧 Setup

### Prerequisites

- Node.js >= 18
- All dependencies installed
- `scarb` >= 2.11.4
- For mainnet: Ledger hardware wallet

### Installation

```bash
npm ci && npm run build
```

### Environment Configuration

Create a `.env` file with the following variables (see `.example.env` for reference):

```bash
# Starknet Configuration
STARKNET_PRIVATE_KEY=0x...  # For testnet only, mainnet requires offline workflow
STARKNET_ACCOUNT_ADDRESS=0x...

# Network settings
ENV=testnet  # or mainnet
```

### Prerequisite steps
Before you start running contract related scripts you need to:

1. Build all your contracts using `scarb build`. You can run that command in the root of giza-axelar-starknet and it will build all contracts for you.
2. Create and fund a starknet account (single or multi signature).
2. Declare all the contracts you plan to deploy using the `declare.ts` script, which will also create the objects in the `axelar-chain-config` JSON file.
3. Deploy all the contracts you've declared using the `deploy.ts` script.

These 3 steps will update the axelar-chains-config JSON file for the `--env` you use in your commands.

## 🚀 Core Features

### Dual Workflow Support
All commands, except the contract declaration(which is only online) have 2 modes:
- **Online Mode**: Direct transaction execution (testnet only)
- **Offline Mode**: Unsigned transaction generation for hardware wallet signing (required for mainnet)

### Chain Configuration
- Starknet scripts automatically use the 'starknet' chain from your environment config
- No need to specify chain names in commands

### Security Model
Based on the the passed `--env` flag value:
- **Testnet**: Private key-based signing
- **Mainnet**: Mandatory offline workflow with Ledger hardware wallets

### Transaction Types
- **Deploy Transactions**: Contract deployments with deterministic addresses
- **Invoke Transactions**: Contract calls and state modifications
- **Declare Transactions**: Contract class declarations (online only)
- **Multicall Transactions**: Execute multiple calls in a single transaction
- **Query Transactions**: Read-only contract queries (no state changes)

### Contract Support
- ✅ Contract declaration, deployment and upgrades
- ✅ Gateway operations (call contract, approve messages, validate messages)
- ✅ Signer rotation and operatorship management
- ✅ Multicall support for batching operations
- ✅ InterchainTokenService (ITS) - full token bridging support

## 🛠️ CLI Options Reference

**Base Options (available on all scripts):**
- `-e, --env`: Environment (testnet, mainnet)
- `-y, --yes`: Skip confirmation prompts

**Starknet-Specific Options:**
- `--privateKey`: Private key (testnet only, not required for offline)
- `--accountAddress`: Account address
- `--offline`: Generate unsigned transaction for hardware wallet signing
- `--estimate`: Estimate gas and display CLI arguments to copy (use these flags in the next step)
- `--nonce`: Account nonce (required for offline, must be manually specified)
- `--outputDir`: Output directory for offline files

**Note:** For online transactions, use `--privateKey`. For offline transactions, first run with `--estimate` to get gas parameters, then run with `--offline`, `--nonce`, and the gas flags from estimation.

**Declare-Specific Options:**
- `--contractConfigName`: Name to store in config
- `--contractPath`: Path to contract JSON file

**Deploy-Specific Options:**
- `--contractConfigName`: Contract configuration name to use
- `--constructorCalldata`: Constructor arguments as JSON array
- `--salt`: Salt for deterministic deployment

**Upgrade-Specific Options:**
- `--contractConfigName`: Contract configuration to upgrade
- `--classHash`: New class hash for upgrade
- `--contractAddress`: Contract address (optional if in config)

**Offline Transaction Gas Options:**
- `--l1GasMaxAmount`: Maximum L1 gas amount
- `--l1GasMaxPricePerUnit`: Maximum L1 gas price per unit
- `--l2GasMaxAmount`: Maximum L2 gas amount  
- `--l2GasMaxPricePerUnit`: Maximum L2 gas price per unit
- `--l1DataMaxAmount`: Maximum L1 data amount
- `--l1DataMaxPricePerUnit`: Maximum L1 data price per unit

**Offline Signing Script Options:**

*sign-transaction.ts:*
- `--ledger-path`: Ledger derivation path (default: "m/44'/9004'/0'/0/0")
- `--env`: Environment for chain ID detection
- `--multisig`: Enable multisig mode - includes public key in signature (default: true)

*combine-signatures.ts:*
- `--output`: Output file for combined transaction (default: starknet-offline-txs/tx_multisig_signed_<timestamp>.json)

*broadcast-transaction.ts:*
- `--env`: Environment configuration
- `--contract-config-name`: Contract config name (for deployment transactions)

## 📚 Documentation

### Contract Operations
- **[Contract Declaration (online only)](./docs/declare.md)** - Declare contract classes on-chain
- **[Contract Deployment](./docs/deploy.md)** - Deploy contract instances
- **[Contract Upgrades](./docs/upgrade.md)** - Upgrade existing contracts
- **[Multicall Operations](./docs/multicall.md)** - Batch multiple calls in one transaction
- **[Multisig Management](./docs/multisig.md)** - Argent multisig account operations
- **[Offline Transaction Workflow](./docs/offline.md)** - Complete offline signing workflow for mainnet

### Contract-Specific Guides
- **[Gateway Operations](./docs/gateway-test-commands.md)** - Cross-chain messaging and gateway management
- **[InterchainTokenService (ITS)](./docs/its.md)** - Token bridging and cross-chain token operations
- **[Gas Service Operations](./docs/gas-service-test-commands.md)** - Gas payment and management
- **[Governance Operations](./docs/governance-test-commands.md)** - Governance and voting operations
- **[Operators Management](./docs/operators-test-commands.md)** - Operator management and control

### Workflow Guides
- **[Offline Signing](./docs/OFFLINE-SIGNING.md)** - Complete guide for mainnet offline workflow
- **[Key Management](./key-management.md)** - Security guidelines and key management


## 🔍 Troubleshooting

### Common Issues

**"Class hash not found in config"**
- Solution: Ensure you've declared the contract first using `declare-contract.ts`

**"Nonce is required for offline transaction generation"**
- Solution: Add `--nonce <current_nonce>` flag

**"Chain not found in configuration"**
- Solution: Verify chain name in `axelar-chains-config/info/<env>.json`

**"Contract path does not exist"**
- Solution: Verify the path to your contract JSON file is correct

## 📚 Additional Resources

- [Starknet Official Documentation](https://docs.starknet.io/)
- [Starknet.js Library](https://starknetjs.com/)
- [Axelar Network Documentation](https://docs.axelar.dev/)

