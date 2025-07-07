# Starknet Deployment Scripts 🏗️

This directory contains deployment and operational scripts for Axelar contracts on Starknet. The scripts support both online and offline workflows, with hardware wallet integration for secure mainnet operations.

## 🔧 Setup

### Prerequisites

- Node.js >= 18
- Starknet.js dependencies
- For mainnet: Ledger hardware wallet

### Installation

```bash
npm ci && npm run build
```

### TypeScript Support

All scripts now use `ts-node` for TypeScript execution:
- Compatible with existing JavaScript workflows
- Enhanced type safety and development experience
- All commands use `ts-node` instead of `node`

### Environment Configuration

Create a `.env` file with the following variables (see `.example.env` for reference):

```bash
# Starknet Configuration
STARKNET_PRIVATE_KEY=0x...  # For testnet only, mainnet requires offline workflow
STARKNET_ACCOUNT_ADDRESS=0x...

# Network settings
ENV=testnet  # or mainnet
```

## 🚀 Core Features

### Dual Workflow Support
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
- ✅ Gas Service contract operations
- ✅ Operators contract management
- 🔄 ITS (Interchain Token Service) - *coming soon*

## 📚 Core Workflow

### Offline Transaction Workflow (Required for Mainnet)

The offline transaction workflow requires several steps to ensure security when using hardware wallets:

1. **Gas Estimation** (Online) - Estimate transaction fees using an online environment
2. **Transaction File Generation** (Offline) - Generate unsigned transaction with gas fee flags from previous step
3. **Signature Distribution** - Share the unsigned transaction file with all multisig signers
4. **Individual Signing** (Offline) - Each signer independently signs the transaction, generating a signed file
5. **Signature Collection** - All signers share their signed files with one coordinator
6. **Signature Combination** - Coordinator combines all signatures into a single multisig transaction
7. **Transaction Broadcast** (Online) - Submit the fully signed transaction to the network

### 1. Declare Contract (Online Only)
```bash
npx ts-node starknet/declare-contract.ts \
  --env testnet \
  --contractConfigName AxelarGateway \
  --contractPath ./artifacts/AxelarGateway.contract_class.json \
  --privateKey 0x... \
  --accountAddress 0x...
```

This will declare the contract on-chain and save the class hash to the configuration.

### 2. Deploy Contract

**Online Deployment (Testnet):**
```bash
npx ts-node starknet/deploy-contract.ts \
  --env testnet \
  --contractConfigName AxelarGateway \
  --constructorCalldata '["0x1234"]' \
  --salt 0x123 \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Offline Deployment (Mainnet):**
```bash
# 1. Estimate gas (online environment)
npx ts-node starknet/deploy-contract.ts \
  --env mainnet \
  --contractConfigName AxelarGateway \
  --constructorCalldata '["0x1234"]' \
  --salt 0x123 \
  --estimate \
  --privateKey 0x... \
  --accountAddress 0x...

# 2. Generate unsigned transaction (offline environment)
npx ts-node starknet/deploy-contract.ts \
  --env mainnet \
  --contractConfigName AxelarGateway \
  --constructorCalldata '["0x1234"]' \
  --salt 0x123 \
  --offline \
  --nonce 5 \
  --accountAddress 0x... \
  --l1GasMaxAmount 50000 \
  --l1GasMaxPricePerUnit 100000000000 \
  --l2GasMaxAmount 1000000 \
  --l2GasMaxPricePerUnit 1000000000
```

### 3. Upgrade Contract

**Online Upgrade:**
```bash
npx ts-node starknet/upgrade-contract.ts \
  --env testnet \
  --contractConfigName AxelarGateway \
  --classHash 0xNewClassHash... \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Offline Upgrade:**
```bash
# 1. Estimate gas (online environment)
npx ts-node starknet/upgrade-contract.ts \
  --env mainnet \
  --contractConfigName AxelarGateway \
  --classHash 0xNewClassHash... \
  --estimate \
  --privateKey 0x... \
  --accountAddress 0x...

# 2. Generate unsigned transaction (offline environment)
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

## 🔄 Multicall Operations

Execute multiple contract calls in a single transaction to save gas and improve efficiency.

### Multicall Configuration

Create a JSON configuration file specifying all calls to execute:

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

### Multicall Use Cases

- **Gateway + Gas Service**: Call contract on another chain and pay for gas in one transaction
- **Batch Approvals**: Approve multiple messages in a single transaction
- **Complex Operations**: Combine governance operations with contract calls
- **Gas Optimization**: Reduce transaction count and save on gas fees

## 🏛️ Argent Multisig Operations

Control and manage Argent multisig v0.2.0 accounts with comprehensive support for all multisig operations.

### Get Ledger Public Key

Retrieve your Ledger's public key for use as a multisig signer:

```bash
npx ts-node starknet/multisig.ts get-ledger-pubkey \
  --ledger-path "m/44'/9004'/0'/0/0"
```

### Read Operations

**Get Threshold:**
```bash
npx ts-node starknet/multisig.ts get-threshold \
  --contract-address 0x... \
  --env testnet
```

**Get Signers:**
```bash
npx ts-node starknet/multisig.ts get-signers \
  --contract-address 0x... \
  --env testnet
```

**Check if Address is Signer:**
```bash
npx ts-node starknet/multisig.ts is-signer \
  --contract-address 0x... \
  --signers 0x... \
  --signer-type starknet \
  --env testnet
```

### Multisig Management Operations

All management operations support both online and offline modes with gas estimation.

**Change Threshold:**
```bash
# Online
npx ts-node starknet/multisig.ts change-threshold \
  --contract-address 0x... \
  --threshold 2 \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...

# Offline
npx ts-node starknet/multisig.ts change-threshold \
  --contract-address 0x... \
  --threshold 2 \
  --env mainnet \
  --offline \
  --nonce 5 \
  --accountAddress 0x... \
  --l1GasMaxAmount 50000 \
  --l1GasMaxPricePerUnit 100000000000
```

**Add Signers:**
```bash
npx ts-node starknet/multisig.ts add-signers \
  --contract-address 0x... \
  --threshold 2 \
  --signers 0x1234...,0x5678... \
  --signer-type starknet \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Remove Signers:**
```bash
npx ts-node starknet/multisig.ts remove-signers \
  --contract-address 0x... \
  --threshold 1 \
  --signers 0x1234... \
  --signer-type starknet \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Replace Signer:**
```bash
npx ts-node starknet/multisig.ts replace-signer \
  --contract-address 0x... \
  --signer-to-remove 0x1234... \
  --signer-to-add 0x5678... \
  --signer-type starknet \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

### Guardian Recovery Operations

Manage guardian-based account recovery for emergency situations.

**Enable/Disable Guardian Recovery:**
```bash
npx ts-node starknet/multisig.ts toggle-escape \
  --contract-address 0x... \
  --is-enabled true \
  --security-period 86400 \
  --expiry-period 604800 \
  --guardian 0x... \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Get Guardian:**
```bash
npx ts-node starknet/multisig.ts get-guardian \
  --contract-address 0x... \
  --env testnet
```

**Trigger Escape (Guardian Only):**
```bash
npx ts-node starknet/multisig.ts trigger-escape \
  --contract-address 0x... \
  --selector 0x... \
  --calldata 0x1234,0x5678 \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Execute Escape (After Security Period):**
```bash
npx ts-node starknet/multisig.ts execute-escape \
  --contract-address 0x... \
  --selector 0x... \
  --calldata 0x1234,0x5678 \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Cancel Escape:**
```bash
npx ts-node starknet/multisig.ts cancel-escape \
  --contract-address 0x... \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Get Escape Status:**
```bash
npx ts-node starknet/multisig.ts get-escape \
  --contract-address 0x... \
  --env testnet
```

### Supported Signer Types

- `starknet`: Standard Starknet signers (default)
- `secp256k1`: Ethereum-compatible signers
- `secp256r1`: P-256 curve signers
- `eip191`: EIP-191 compliant signers

### Multisig Workflow Example

1. **Check Current State:**
   ```bash
   npx ts-node starknet/multisig.ts get-threshold --contract-address 0x... --env testnet
   npx ts-node starknet/multisig.ts get-signers --contract-address 0x... --env testnet
   ```

2. **Generate Offline Transaction (Mainnet):**
   ```bash
   # Estimate gas first
   npx ts-node starknet/multisig.ts add-signers \
     --contract-address 0x... \
     --threshold 2 \
     --signers 0xNewSigner \
     --estimate \
     --env mainnet \
     --privateKey 0x... \
     --accountAddress 0x...
   
   # Generate unsigned transaction
   npx ts-node starknet/multisig.ts add-signers \
     --contract-address 0x... \
     --threshold 2 \
     --signers 0xNewSigner \
     --offline \
     --nonce 5 \
     --accountAddress 0x... \
     --l1GasMaxAmount 50000 \
     --l1GasMaxPricePerUnit 100000000000
   ```

3. **Sign and broadcast following the standard offline workflow**

## 🔐 Offline Signing Workflow (Mainnet)

For secure mainnet deployments, follow this complete offline signing workflow:

### Step 1: Gas Estimation (Online Environment)
```bash
# Estimate gas for the transaction
npx ts-node starknet/deploy-contract.ts \
  --env mainnet \
  --contractConfigName AxelarGateway \
  --constructorCalldata '["0x1234"]' \
  --salt 0x123 \
  --estimate \
  --privateKey 0x... \
  --accountAddress 0x...
```

The output will show CLI arguments to copy:
```
--l1GasMaxAmount 50000 --l1GasMaxPricePerUnit 100000000000 --l2GasMaxAmount 1000000 --l2GasMaxPricePerUnit 1000000000
```

### Step 2: Generate Unsigned Transaction (Offline Environment)
Transfer the estimated values to your offline environment and generate the unsigned transaction:

```bash
npx ts-node starknet/deploy-contract.ts \
  --env mainnet \
  --contractConfigName AxelarGateway \
  --constructorCalldata '["0x1234"]' \
  --salt 0x123 \
  --offline \
  --nonce 5 \
  --accountAddress 0x... \
  --l1GasMaxAmount 50000 \
  --l1GasMaxPricePerUnit 100000000000 \
  --l2GasMaxAmount 1000000 \
  --l2GasMaxPricePerUnit 1000000000
```

This creates a file like: `starknet-offline-txs/deploy_AxelarGateway_starknet_2025-06-12T10-30-45-123Z.json`

### Step 3: Sign Transaction with Ledger (Offline Environment)
```bash
# Install Ledger dependencies first (if not already installed)
npm install @ledgerhq/hw-transport-node-hid @ledgerhq/hw-app-starknet

# Sign the transaction
npx ts-node starknet/sign-transaction.ts \
  starknet-offline-txs/deploy_AxelarGateway_starknet_2025-06-12T10-30-45-123Z.json \
  --ledger-path "m/44'/9004'/0'/0/0" \
  --env mainnet
```

**For Multisig Accounts:** Each signer repeats this step independently on their own offline device.

### Step 4: Combine Signatures (For Multisig Only)
If using multisig accounts, combine all signatures:

```bash
npx ts-node starknet/combine-signatures.ts \
  starknet-offline-txs/deploy_AxelarGateway_starknet_2025-06-12T10-30-45-123Z_signed.json \
  starknet-offline-txs/deploy_AxelarGateway_starknet_another_signer_signed.json
# Creates: starknet-offline-txs/tx_multisig_signed_2025-06-12T10-35-22-789Z.json

# Or with custom output filename
npx ts-node starknet/combine-signatures.ts \
  signer1_signed.json \
  signer2_signed.json \
  -o custom_multisig.json
```

### Step 5: Broadcast Transaction (Online Environment)
Transfer the signed transaction to an online environment and broadcast:

```bash
# For single-signature accounts
npx ts-node starknet/broadcast-transaction.ts \
  starknet-offline-txs/deploy_AxelarGateway_starknet_2025-06-12T10-30-45-123Z_signed.json \
  --env mainnet \
  --contract-config-name AxelarGateway

# For multisig accounts
npx ts-node starknet/broadcast-transaction.ts \
  starknet-offline-txs/tx_multisig_signed_2025-06-12T10-35-22-789Z.json \
  --env mainnet \
  --contract-config-name AxelarGateway
```

## 📋 Contract Configuration

Contracts are managed through configuration names stored in the chain config. Each contract entry contains:
- `classHash`: The declared class hash
- `address`: The deployed contract address (after deployment)
- `deploymentTransactionHash`: Transaction hash of deployment
- `declarationTransactionHash`: Transaction hash of declaration
- Other metadata (salt, deployer, timestamps)

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

### Contract-Specific Guides
- **[Gateway Operations](./docs/gateway.md)** - Cross-chain messaging and gateway management
- **[Gas Service Operations](./docs/gas-service.md)** - Gas payment and management commands
- **[Governance Operations](./docs/governance.md)** - Governance proposal and execution commands
- **[Operators Operations](./docs/operators.md)** - Operator management and configuration

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

### Debug Mode

Add `--verbose` flag to any command for detailed logging.

### Argent Multisig Debugging

**Debug signer registration:**
```bash
npx ts-node starknet/debug-multisig-signer.ts \
  YOUR_MULTISIG_ADDRESS \
  YOUR_PUBLIC_KEY \
  --env testnet
```

**Format constructor for deployment:**
```bash
npx ts-node starknet/format-multisig-constructor.ts \
  1 \
  0x1234...pubkey1 \
  0x5678...pubkey2
```

## 📚 Additional Resources

- [Starknet Official Documentation](https://docs.starknet.io/)
- [Starknet.js Library](https://starknetjs.com/)
- [Axelar Network Documentation](https://docs.axelar.dev/)

## 🤝 Contributing

When adding new contracts:

1. Prepare contract artifacts (sierra and casm JSON files)
2. Declare contract using `declare-contract.ts`
3. Deploy contract using `deploy-contract.ts`
4. Add contract-specific interaction scripts if needed
5. Test on testnet before mainnet

