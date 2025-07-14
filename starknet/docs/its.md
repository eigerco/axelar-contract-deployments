# InterchainTokenService (ITS) Commands

This guide covers all available commands for managing the InterchainTokenService on Starknet. All commands support both online and offline execution modes.

## Table of Contents
- [Deployment](#deployment)
  - [Deploy InterchainTokenService](#deploy-interchaintokenservice)
  - [Deploy InterchainTokenFactory](#deploy-interchaintokenfactory)
- [Token Operations](#token-operations)
- [Cross-Chain Operations](#cross-chain-operations)
- [Management Operations](#management-operations)
- [Query Operations](#query-operations)
- [Utility Commands](#utility-commands)
- [Testing](#testing)

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

## Token Operations

### Deploy Interchain Token

```
Usage: its-deploy-token [options]

Deploy a new interchain token on Starknet

Options:
  --salt <salt>                      Salt for token deployment
  --destinationChain <chain>         Destination chain name (optional, defaults
                                     to local deployment)
  --name <name>                      Token name
  --symbol <symbol>                  Token symbol
  --decimals <decimals>              Token decimals
  --minter <address>                 Minter address (defaults to current
                                     account)
  --gasValue <value>                 Gas value for cross-chain deployment
  --gasToken <token>                 Gas token (currently only STRK is supported)
                                     (default: "STRK")
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

**Example:**
```bash
npx ts-node starknet/its/deploy-token.ts --salt my-token-salt --name "My Token" --symbol "MTK" --decimals 18 --gasValue 100000 --gasToken STRK --privateKey 0x... --accountAddress 0x...
```

### Register Custom Token

```
Usage: its-register-token [options]

Register an existing token for cross-chain use

Options:
  --salt <salt>                      Salt for token registration
  --tokenAddress <address>           Address of the existing token
  --tokenManagerType <type>          Token manager type (native, mintBurnFrom,
                                     lockUnlock, lockUnlockFee, mintBurn)
  --operator <address>               Operator address (defaults to current
                                     account)
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

**Example:**
```bash
npx ts-node starknet/its/register-token.ts --salt my-salt --tokenAddress 0x... --tokenManagerType lockUnlock --privateKey 0x... --accountAddress 0x...
```

### Register Canonical Token

```
Usage: its-register-canonical-token [options]

Register a canonical token for cross-chain use (uses lock/unlock mechanism)

Options:
  --tokenAddress <address>           Address of the canonical token to register
  --factoryAddress <address>         InterchainTokenFactory address (defaults
                                     to config)
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

**Example:**
```bash
npx ts-node starknet/its/register-canonical-token.ts --tokenAddress 0x... --privateKey 0x... --accountAddress 0x...
```

## Cross-Chain Operations

### Interchain Transfer

```
Usage: its-transfer [options]

Transfer tokens across chains using InterchainTokenService

Options:
  --tokenId <id>                     Token ID (hex string)
  --destinationChain <chain>         Destination chain name
  --destinationAddress <address>     Destination address
  --amount <amount>                  Amount to transfer (in smallest unit)
  --data <data>                      Optional data for contract execution
  --gasValue <value>                 Gas value for cross-chain execution
  --gasToken <token>                 Gas token (currently only STRK is supported)
                                     (default: "STRK")
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

**Example:**
```bash
npx ts-node starknet/its/transfer.ts --tokenId 0x... --destinationChain ethereum --destinationAddress 0x... --amount 1000000 --gasValue 100000 --gasToken STRK --privateKey 0x... --accountAddress 0x...
```

### Link Token

```
Usage: its-link-token [options]

Link a token across chains using InterchainTokenService

Options:
  --salt <salt>                        Salt used for token registration
  --destinationChain <chain>           Destination chain name
  --destinationTokenAddress <address>  Token address on destination chain
  --tokenManagerType <type>            Token manager type (native,
                                       mintBurnFrom, lockUnlock, lockUnlockFee,
                                       mintBurn)
  --operator <address>                 Operator address for the linked token
                                       (defaults to current account)
  --gasValue <value>                   Gas value for cross-chain linking
  --gasToken <token>                   Gas token (currently only STRK is
                                       supported) (default: "STRK")
  -e, --env <env>                      environment (choices:
                                       "devnet-amplifier", "mainnet",
                                       "stagenet", "testnet", default:
                                       "testnet", env: ENV)
  -y, --yes                            skip deployment prompt confirmation
                                       (env: YES)
  -p, --privateKey < privateKey >      private key for Starknet account(testnet
                                       only, not required for offline tx
                                       generation) (env: STARKNET_PRIVATE_KEY)
  --accountAddress <accountAddress>    Starknet account address (env:
                                       STARKNET_ACCOUNT_ADDRESS)
  -h, --help                           display help for command
```

**Example:**
```bash
npx ts-node starknet/its/link-token.ts --salt my-link-salt --destinationChain polygon --destinationTokenAddress 0x... --tokenManagerType lockUnlock --gasValue 100000 --gasToken STRK --privateKey 0x... --accountAddress 0x...
```

### Deploy Remote Canonical Token

```
Usage: its-deploy-remote-canonical-token [options]

Deploy a canonical token representation on a remote chain

Options:
  --tokenAddress <address>           Address of the original canonical token
  --destinationChain <chain>         Destination chain name
  --gasValue <value>                 Gas value for cross-chain deployment
  --gasToken <token>                 Gas token (currently only STRK is supported)
                                     (default: "STRK")
  --factoryAddress <address>         InterchainTokenFactory address (defaults
                                     to config)
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

**Example:**
```bash
npx ts-node starknet/its/deploy-remote-canonical-token.ts --tokenAddress 0x... --destinationChain avalanche --gasValue 100000 --gasToken STRK --privateKey 0x... --accountAddress 0x...
```

## Management Operations

### Manage Trusted Chains

```
Usage: its-manage-chains [options]

Manage trusted chains in InterchainTokenService

Options:
  --action <action>                  Action to perform (add, remove, check)
  --chainName <name>                 Name of the chain to manage
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

Examples:
  Add a trusted chain:
    $ its-manage-chains --action add --chainName ethereum

  Remove a trusted chain:
    $ its-manage-chains --action remove --chainName polygon

  Check if a chain is trusted:
    $ its-manage-chains --action check --chainName avalanche

Note: Only the contract owner can add or remove trusted chains.
The 'check' action can be performed by anyone.
```

### Set Flow Limits

```
Usage: its-flow-limits [options]

Set flow limits for multiple tokens in InterchainTokenService

Options:
  --tokenIds <ids>                   Comma-separated list of token IDs (hex
                                     strings)
  --flowLimits <limits>              Comma-separated list of flow limits (in
                                     smallest unit)
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

Examples:
  Set flow limit for a single token:
    $ its-flow-limits --tokenIds 0x123...abc --flowLimits 1000000

  Set flow limits for multiple tokens:
    $ its-flow-limits --tokenIds 0x123...abc,0x456...def,0x789...ghi --flowLimits 1000000,2000000,500000

Note: The number of token IDs must match the number of flow limits.
Flow limits are specified in the smallest unit of the token (e.g., wei for 18 decimal tokens).
```

### Manage Service

```
Usage: its-manage-service [options]

Manage InterchainTokenService settings and status

Options:
  --action <action>                  Action to perform (pause, unpause,
                                     transfer-ownership, set-factory,
                                     check-status)
  --newOwner <address>               New owner address (required for
                                     transfer-ownership)
  --factoryAddress <address>         Factory address (required for set-factory)
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

Examples:
  Pause the service:
    $ its-manage-service --action pause

  Unpause the service:
    $ its-manage-service --action unpause

  Transfer ownership:
    $ its-manage-service --action transfer-ownership --newOwner 0x123...

  Set factory address:
    $ its-manage-service --action set-factory --factoryAddress 0x456...

  Check service status:
    $ its-manage-service --action check-status

Note: Most actions require owner privileges.
The 'check-status' action can be performed by anyone.
```

## Query Operations

### Query ITS Information

```
Usage: its-query [options]

Query InterchainTokenService for token and chain information

Options:
  --query <type>                     Query type (token-manager, token-address,
                                     interchain-token-address, chain-name,
                                     trusted-chain, flow-limit, token-info)
  --tokenId <id>                     Token ID (required for token queries)
  --chainName <name>                 Chain name (required for trusted-chain
                                     query)
  --itsAddress <address>             InterchainTokenService address (defaults
                                     to config)
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

Examples:
  Get token manager address:
    $ its-query --query token-manager --tokenId 0x123...

  Get registered token address:
    $ its-query --query token-address --tokenId 0x123...

  Get predicted interchain token address:
    $ its-query --query interchain-token-address --tokenId 0x123...

  Get chain name:
    $ its-query --query chain-name

  Check if chain is trusted:
    $ its-query --query trusted-chain --chainName ethereum

  Get flow limit information:
    $ its-query --query flow-limit --tokenId 0x123...

  Get complete token information:
    $ its-query --query token-info --tokenId 0x123...
```

## Utility Commands

### Calculate Token ID

```
Usage: its-calculate-token-id [options]

Calculate deterministic token IDs for InterchainTokenService

Options:
  --type <type>                      Type of token ID to calculate (interchain,
                                     canonical, linked)
  --deployer <address>               Deployer address (required for interchain
                                     and linked types)
  --salt <salt>                      Salt value (required for interchain and
                                     linked types)
  --tokenAddress <address>           Token address (required for canonical
                                     type)
  --itsAddress <address>             InterchainTokenService address (defaults
                                     to config)
  --factoryAddress <address>         InterchainTokenFactory address (defaults
                                     to config)
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

Examples:
  Calculate interchain token ID:
    $ its-calculate-token-id --type interchain --deployer 0x123... --salt my-salt

  Calculate canonical token ID:
    $ its-calculate-token-id --type canonical --tokenAddress 0x456...

  Calculate linked token ID:
    $ its-calculate-token-id --type linked --deployer 0x789... --salt link-salt

Token ID Types:
  - interchain: For tokens deployed via deploy_interchain_token
  - canonical: For existing tokens registered as canonical
  - linked: For tokens linked via the factory
```

## Testing

### End-to-End Test Flow

```
Usage: its-test-flow [options]

Run an end-to-end test of InterchainTokenService functionality

Options:
  --tokenName <name>                 Token name (default: "Test Token")
  --tokenSymbol <symbol>             Token symbol (default: "TEST")
  --tokenDecimals <decimals>         Token decimals (default: "18")
  --initialSupply <amount>           Initial supply (in whole tokens) (default:
                                     "1000000")
  --salt <salt>                      Deployment salt (defaults to
                                     timestamp-based)
  --destinationChain <chain>         Destination chain for transfer (default:
                                     "ethereum")
  --transferAmount <amount>          Amount to transfer (in whole tokens)
                                     (default: "100")
  --skipDeployment                   Skip token deployment and use existing
                                     token
  --tokenId <id>                     Token ID to use (required if
                                     --skipDeployment)
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

This script demonstrates a complete ITS workflow:
1. Deploy a new interchain token (or use existing)
2. Query token information
3. Check destination chain trust
4. Initiate an interchain transfer
5. Verify the balance change

Examples:
  Full test with new token deployment:
    $ its-test-flow --tokenName "My Token" --tokenSymbol "MTK"

  Test with existing token:
    $ its-test-flow --skipDeployment --tokenId 0x123...

  Custom transfer amount and destination:
    $ its-test-flow --transferAmount 500 --destinationChain polygon

Note: Ensure you have sufficient balance for gas payments.
```

## Offline Signing Support

All ITS commands support offline signing for mainnet operations. Add the `--offline` flag along with appropriate gas parameters to generate unsigned transactions for hardware wallet signing.

**Example:**
```bash
npx ts-node starknet/its/transfer.ts --tokenId 0x... --destinationChain ethereum --destinationAddress 0x... --amount 1000000 --gasValue 100000 --gasToken STRK --offline --nonce 5 --accountAddress 0x...
```

See the main README for complete offline signing workflow instructions.

## Notes

- All commands use the `starknet/its/` directory path
- Token IDs are deterministic and consistent across all chains
- Always ensure destination chains are trusted before transfers
- Flow limits help prevent excessive token movements
- Canonical tokens use lock/unlock, new tokens use mint/burn
- Gas values depend on destination chain requirements

