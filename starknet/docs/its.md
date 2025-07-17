# InterchainTokenService (ITS) Commands

This guide covers the consolidated ITS ecosystem scripts for managing cross-chain token operations on Starknet. All commands support both online and offline execution modes.

## Overview

The ITS ecosystem provides a comprehensive suite for cross-chain token operations through four main components:

1. **InterchainTokenService (ITS)** - Core service for cross-chain token operations
2. **InterchainTokenFactory (ITF)** - Factory for deploying and managing interchain tokens
3. **TokenManager** - Manages individual token operations and flow limits
4. **InterchainToken** - ERC20 tokens with minting/burning capabilities

## Consolidated Scripts

We provide four consolidated scripts that organize all ITS operations:
- `its.ts` - InterchainTokenService operations
- `itf.ts` - InterchainTokenFactory operations
- `token-manager.ts` - TokenManager operations
- `interchain-token.ts` - InterchainToken operations

## Table of Contents
- [Deployment](#deployment)
  - [Deploy InterchainTokenService](#deploy-interchaintokenservice)
  - [Deploy InterchainTokenFactory](#deploy-interchaintokenfactory)
  - [ITS Script](#its-script)
  - [ITF Script](#itf-script)
  - [TokenManager Script](#tokenmanager-script)
  - [InterchainToken Script](#interchaintoken-script)
- [Offline Signing Support](#offline-signing-support)
- [Implementation Status](#implementation-status)

## Deployment

### Deploy InterchainTokenService

Deploy the InterchainTokenService contract on Starknet. This is the main contract that handles all token operations across chains.

```
Usage: deploy-its [options]

Deploy InterchainTokenService contract on Starknet

Options:
  --gateway <address>                AxelarGateway contract address
  --gasService <address>             AxelarGasService contract address
  --chainName <name>                 Chain name for ITS (defaults to chain name
                                     from config)
  --interchainToken <classHash>      InterchainToken class hash
  --tokenManager <classHash>         TokenManager class hash
  --tokenHandler <classHash>         TokenHandler class hash
  --universalDeployer <address>      Universal Deployer contract address
  --itsHubChainName <name>           ITS hub chain name (defaults to "axelar")
  --itsHubContractAddress <address>  ITS hub contract address (required)
  --operator <address>               Operator address (defaults to account
                                     address)
  --owner <address>                  Owner address (defaults to account
                                     address)
  --salt <salt>                      Salt for deployment (defaults to 0)
                                     (default: "0")
  -e, --env <env>                    environment (choices: "devnet-amplifier",
                                     "mainnet", "stagenet", "testnet", default:
                                     "testnet", env: ENV)
  -y, --yes                          skip deployment prompt confirmation (env:
                                     YES)
  -p, --privateKey < privateKey >    private key for Starknet account(testnet
                                     only, not required for offline tx
                                     generation) (env: STARKNET_PRIVATE_KEY)
  --accountAddress <accountAddress>  Starknet account address (env:
                                     STARKNET_ACCOUNT_ADDRESS)
  -h, --help                         display help for command
```

**Note:** Unlike other deployment scripts, ITS deployment does not support offline mode or gas estimation as it uses direct contract deployment.

**Example:**
```bash
npx ts-node starknet/its/deploy-its.ts \
  --env testnet \
  --gateway 0x... \
  --gasService 0x... \
  --chainName starknet \
  --itsHubChainName axelar \
  --itsHubContractAddress 0x... \
  --operator 0x... \
  --owner 0x... \
  --salt 0x123 \
  --privateKey 0x... \
  --accountAddress 0x...
```

### Deploy InterchainTokenFactory

Deploy the InterchainTokenFactory contract on Starknet. This contract is responsible for creating and managing interchain tokens.

```
Usage: deploy-itf [options]

Deploy InterchainTokenFactory contract on Starknet

Options:
  --interchainTokenService <address> InterchainTokenService contract address
  --owner <address>                  Owner address (defaults to account address)
  --salt <salt>                      Salt for deployment (defaults to 0)
                                     (default: "0")
  -e, --env <env>                    environment (choices: "devnet-amplifier",
                                     "mainnet", "stagenet", "testnet", default:
                                     "testnet", env: ENV)
  -y, --yes                          skip deployment prompt confirmation (env:
                                     YES)
  -p, --privateKey < privateKey >    private key for Starknet account(testnet
                                     only, not required for offline tx
                                     generation) (env: STARKNET_PRIVATE_KEY)
  --accountAddress <accountAddress>  Starknet account address (env:
                                     STARKNET_ACCOUNT_ADDRESS)
  -h, --help                         display help for command
```

**Note:** Like ITS deployment, ITF deployment does not support offline mode or gas estimation as it uses direct contract deployment.

**Example:**
```bash
npx ts-node starknet/its/deploy-itf.ts \
  --env testnet \
  --interchainTokenService 0x... \
  --owner 0x... \
  --salt 0x123 \
  --privateKey 0x... \
  --accountAddress 0x...
```

### ITS Script

The main entry point for InterchainTokenService core operations.

```bash
node starknet/its/its.js <subcommand> [options]
```

**Available Subcommands:**

#### Administrative Operations
- `set-factory-address` - Set the factory address for ITS
- `set-pause-status` - Pause or unpause the service
- `set-trusted-chain` - Add a trusted chain
- `remove-trusted-chain` - Remove a trusted chain

#### Query Operations
- `chain-name` - Get the chain name
- `token-manager-address` - Get token manager address for a token ID
- `registered-token-address` - Get registered token address
- `interchain-token-address` - Get predicted interchain token address
- `is-trusted-chain` - Check if a chain is trusted

#### Token Operations
- `interchain-transfer` - Transfer tokens across chains
- `register-token-metadata` - Register token metadata for cross-chain compatibility
- `set-flow-limits` - Set flow limits for multiple tokens

**Examples:**

```bash
# Set factory address (uses config if not specified)
node starknet/its/its.js set-factory-address --factoryAddress 0x123...

# Transfer tokens across chains
node starknet/its/its.js interchain-transfer \
  --tokenId 0x123... \
  --destinationChain ethereum \
  --destinationAddress 0x456... \
  --amount 1000000 \
  --gasValue 100000

# Set flow limits for multiple tokens
node starknet/its/its.js set-flow-limits \
  --tokenIds 0x123...,0x456... \
  --flowLimits 1000000,2000000

# Query operations (no authentication required)
node starknet/its/its.js chain-name
node starknet/its/its.js is-trusted-chain --chainName ethereum
```

### ITF Script

Factory operations for deploying and managing interchain tokens.

```bash
node starknet/its/itf.js <subcommand> [options]
```

**Available Subcommands:**

#### Query Operations
- `interchain-token-service` - Get ITS address from factory
- `chain-name` - Get chain name from factory
- `interchain-token-id` - Calculate token ID from deployer and salt
- `canonical-interchain-token-id` - Calculate canonical token ID
- `linked-token-id` - Calculate linked token ID
- `interchain-token-deploy-salt` - Calculate deployment salt
- `canonical-interchain-token-deploy-salt` - Calculate canonical deployment salt
- `linked-token-deploy-salt` - Calculate linked token deployment salt

#### Deployment Operations
- `deploy-interchain-token` - Deploy a new interchain token
- `register-canonical-interchain-token` - Register existing token as canonical
- `deploy-remote-canonical-interchain-token` - Deploy canonical token on remote chain
- `register-custom-token` - Register custom token with parameters
- `link-token` - Link tokens across chains

#### Remote Deployment Management
- `approve-deploy-remote-interchain-token` - Approve remote deployment with custom minter
- `revoke-deploy-remote-interchain-token` - Revoke remote deployment approval
- `deploy-remote-interchain-token` - Deploy token on remote chain (no minter)
- `deploy-remote-interchain-token-with-minter` - Deploy token on remote chain with minter

**Examples:**

```bash
# Calculate token IDs
node starknet/its/itf.js interchain-token-id \
  --deployer 0x123... \
  --salt my-salt

# Deploy a new interchain token
node starknet/its/itf.js deploy-interchain-token \
  --salt my-token \
  --name "My Token" \
  --symbol MTK \
  --decimals 18 \
  --initialSupply 1000000 \
  --minter 0x123...

# Cross-chain deployment
node starknet/its/itf.js deploy-remote-canonical-interchain-token \
  --tokenAddress 0x123... \
  --destinationChain ethereum \
  --gasValue 100000
```

### TokenManager Script

Manage individual token operations and flow limits.

```bash
node starknet/its/token-manager.js <subcommand> [options]
```

**Available Subcommands:**

#### Query Operations
- `interchain-token-id` - Get the token ID managed
- `token-address` - Get the token address
- `token-address-from-params` - Derive token address from parameters
- `implementation-type` - Get token manager type
- `flow-limit` - Get current flow limit
- `flow-out-amount` - Get current flow out amount
- `flow-in-amount` - Get current flow in amount
- `is-flow-limiter` - Check if address is flow limiter
- `params` - Get token manager parameters

#### Management Operations
- `add-flow-in` - Add to flow in amount
- `add-flow-out` - Add to flow out amount
- `set-flow-limit` - Set the flow limit
- `transfer-flow-limiter` - Transfer flow limiter role
- `add-flow-limiter` - Add a flow limiter
- `remove-flow-limiter` - Remove a flow limiter

#### Helper Operations
- `get-token-manager-by-id` - Get token manager address from ITS using token ID

**Examples:**

```bash
# Query token manager info
node starknet/its/token-manager.js implementation-type \
  --tokenManagerAddress 0x123...

# Set flow limit
node starknet/its/token-manager.js set-flow-limit \
  --tokenManagerAddress 0x123... \
  --flowLimit 1000000

# Get token manager by token ID
node starknet/its/token-manager.js get-token-manager-by-id \
  --tokenId 0x789...
```

### InterchainToken Script

Direct token operations for minting, burning, and minter management.

```bash
node starknet/its/interchain-token.js <subcommand> [options]
```

**Available Subcommands:**

#### Minter Management
- `transfer-mintership` - Transfer minter role to new address
- `is-minter` - Check if address has minter role

#### Token Operations
- `mint` - Mint new tokens to recipient
- `burn` - Burn tokens from address

#### Helper Operations
- `get-token-by-id` - Get interchain token address from ITS using token ID
- `token-info` - Get basic token information (name, symbol, decimals, supply)

**Examples:**

```bash
# Transfer minter role
node starknet/its/interchain-token.js transfer-mintership \
  --tokenAddress 0x123... \
  --newMinter 0x456...

# Mint tokens
node starknet/its/interchain-token.js mint \
  --tokenAddress 0x123... \
  --recipient 0x789... \
  --amount 1000000

# Get token info
node starknet/its/interchain-token.js token-info \
  --tokenAddress 0x123...
```

## Offline Signing Support

All ITS commands support offline signing for mainnet operations. Add the `--offline` flag along with appropriate gas parameters to generate unsigned transactions for hardware wallet signing.

**Example:**
```bash
node starknet/its/its.js interchain-transfer \
  --tokenId 0x... \
  --destinationChain ethereum \
  --destinationAddress 0x... \
  --amount 1000000 \
  --gasValue 100000 \
  --offline \
  --nonce 5 \
  --accountAddress 0x...
```

See the main README for complete offline signing workflow instructions.

All ITS commands support offline signing for mainnet operations. Add the `--offline` flag along with appropriate gas parameters to generate unsigned transactions for hardware wallet signing.

**Example:**
```bash
node starknet/its/its.js interchain-transfer \
  --tokenId 0x... \
  --destinationChain ethereum \
  --destinationAddress 0x... \
  --amount 1000000 \
  --gasValue 100000 \
  --offline \
  --nonce 5 \
  --accountAddress 0x...
```

See the main README for complete offline signing workflow instructions.
