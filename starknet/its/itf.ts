import { Command } from 'commander';
import { loadConfig, saveConfig, prompt } from '../../common';
import { addStarknetOptions } from '../cli-utils';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';
import {
    getStarknetProvider,
    getStarknetAccount,
    getContractConfig,
    handleOfflineTransaction,
    validateStarknetOptions,
    estimateGasAndDisplayArgs,
} from '../utils';
import { CallData, Call, Contract, uint256, byteArray, num, CairoCustomEnum } from 'starknet';
import {
    Config,
    ChainConfig,
    GatewayCommandOptions,
    OfflineTransactionResult
} from '../types';

/**
 * Helper function to get contract instance with ABI
 */
async function getContractWithABI(
    provider: any,
    address: string,
    account?: any
): Promise<Contract> {
    const { abi } = await provider.getClassAt(address);
    const contract = new Contract(abi, address, provider);
    if (account) {
        contract.connect(account);
    }
    return contract;
}

/**
 * Parse token ID from string to uint256 format
 */
function parseTokenId(tokenIdStr: string): any {
    if (tokenIdStr.startsWith('0x')) {
        return uint256.bnToUint256(tokenIdStr);
    } else {
        return uint256.bnToUint256('0x' + tokenIdStr);
    }
}

/**
 * Detect if input is hex string or regular string
 */
function detectDataFormat(data: string): { isHex: boolean; cleanHex?: string } {
    if (data.startsWith('0x')) {
        const cleanHex = data.slice(2);
        if (/^[0-9a-fA-F]*$/.test(cleanHex) && cleanHex.length % 2 === 0) {
            return { isHex: true, cleanHex };
        }
        throw new Error('Invalid hex format after 0x prefix - must contain only 0-9, a-f, A-F and have even length');
    }
    return { isHex: false };
}

/**
 * Convert data (hex or string) to ByteArray format
 */
function dataToByteArrayStruct(data: string): any {
    const { isHex, cleanHex } = detectDataFormat(data);
    
    if (isHex && cleanHex) {
        if (cleanHex.length === 0) {
            return {
                data: [],
                pending_word: '0x0',
                pending_word_len: 0
            };
        }
        
        const bytes = Buffer.from(cleanHex, 'hex');
        const dataArray: string[] = [];
        let offset = 0;

        while (offset + 31 <= bytes.length) {
            const chunk = bytes.slice(offset, offset + 31);
            dataArray.push('0x' + chunk.toString('hex'));
            offset += 31;
        }

        let pending_word = '0x0';
        let pending_word_len = 0;

        if (offset < bytes.length) {
            const remaining = bytes.slice(offset);
            pending_word = '0x' + remaining.toString('hex');
            pending_word_len = remaining.length;
        }

        return {
            data: dataArray,
            pending_word,
            pending_word_len
        };
    } else {
        return byteArray.byteArrayFromString(data);
    }
}

// Main program setup
const program = new Command();

program
    .name('itf')
    .description('InterchainTokenFactory operations on Starknet')
    .version('1.0.0');

// Subcommand: interchain-token-service
program
    .command('interchain-token-service')
    .description('Get the InterchainTokenService address from factory')
    .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryAddress = options.factoryAddress || getContractConfig(config, chain.name, 'InterchainTokenFactory').address;
        if (!factoryAddress) {
            throw new Error('InterchainTokenFactory contract not found. Provide --factoryAddress or deploy factory first.');
        }

        const factoryContract = await getContractWithABI(provider, factoryAddress);
        const itsAddress = await factoryContract.interchain_token_service();
        
        console.log(`\nInterchainTokenService Address: ${itsAddress}`);
    });

// Subcommand: chain-name
program
    .command('chain-name')
    .description('Get the chain name from factory')
    .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryAddress = options.factoryAddress || getContractConfig(config, chain.name, 'InterchainTokenFactory').address;
        if (!factoryAddress) {
            throw new Error('InterchainTokenFactory contract not found. Provide --factoryAddress or deploy factory first.');
        }

        const factoryContract = await getContractWithABI(provider, factoryAddress);
        const chainName = await factoryContract.chain_name();
        
        console.log(`\nChain Name: ${chainName}`);
    });

// Subcommand: interchain-token-id
program
    .command('interchain-token-id')
    .description('Calculate interchain token ID from deployer and salt')
    .requiredOption('--deployer <address>', 'Deployer address')
    .requiredOption('--salt <salt>', 'Salt value')
    .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryAddress = options.factoryAddress || getContractConfig(config, chain.name, 'InterchainTokenFactory').address;
        if (!factoryAddress) {
            throw new Error('InterchainTokenFactory contract not found. Provide --factoryAddress or deploy factory first.');
        }

        console.log(`\nCalculating Interchain Token ID:`);
        console.log(`- Deployer: ${options.deployer}`);
        console.log(`- Salt: ${options.salt}`);

        const factoryContract = await getContractWithABI(provider, factoryAddress);
        const tokenId = await factoryContract.interchain_token_id(options.deployer, options.salt);
        
        console.log(`\nToken ID: ${tokenId}`);
        if (typeof tokenId === 'object' && 'low' in tokenId && 'high' in tokenId) {
            const hex = '0x' + tokenId.high.toString(16).padStart(32, '0') + tokenId.low.toString(16).padStart(32, '0');
            console.log(`Hex format: ${hex}`);
        }
    });

// Subcommand: canonical-interchain-token-id
program
    .command('canonical-interchain-token-id')
    .description('Calculate canonical token ID from token address')
    .requiredOption('--tokenAddress <address>', 'Token address')
    .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryAddress = options.factoryAddress || getContractConfig(config, chain.name, 'InterchainTokenFactory').address;
        if (!factoryAddress) {
            throw new Error('InterchainTokenFactory contract not found. Provide --factoryAddress or deploy factory first.');
        }

        console.log(`\nCalculating Canonical Token ID:`);
        console.log(`- Token Address: ${options.tokenAddress}`);

        const factoryContract = await getContractWithABI(provider, factoryAddress);
        const tokenId = await factoryContract.canonical_interchain_token_id(options.tokenAddress);
        
        console.log(`\nToken ID: ${tokenId}`);
        if (typeof tokenId === 'object' && 'low' in tokenId && 'high' in tokenId) {
            const hex = '0x' + tokenId.high.toString(16).padStart(32, '0') + tokenId.low.toString(16).padStart(32, '0');
            console.log(`Hex format: ${hex}`);
        }
    });

// Subcommand: linked-token-id
program
    .command('linked-token-id')
    .description('Calculate linked token ID from deployer and salt')
    .requiredOption('--deployer <address>', 'Deployer address')
    .requiredOption('--salt <salt>', 'Salt value')
    .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryAddress = options.factoryAddress || getContractConfig(config, chain.name, 'InterchainTokenFactory').address;
        if (!factoryAddress) {
            throw new Error('InterchainTokenFactory contract not found. Provide --factoryAddress or deploy factory first.');
        }

        console.log(`\nCalculating Linked Token ID:`);
        console.log(`- Deployer: ${options.deployer}`);
        console.log(`- Salt: ${options.salt}`);

        const factoryContract = await getContractWithABI(provider, factoryAddress);
        const tokenId = await factoryContract.linked_token_id(options.deployer, options.salt);
        
        console.log(`\nToken ID: ${tokenId}`);
        if (typeof tokenId === 'object' && 'low' in tokenId && 'high' in tokenId) {
            const hex = '0x' + tokenId.high.toString(16).padStart(32, '0') + tokenId.low.toString(16).padStart(32, '0');
            console.log(`Hex format: ${hex}`);
        }
    });

// Subcommand: interchain-token-deploy-salt
program
    .command('interchain-token-deploy-salt')
    .description('Calculate deployment salt for interchain token')
    .requiredOption('--deployer <address>', 'Deployer address')
    .requiredOption('--salt <salt>', 'Salt value')
    .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryAddress = options.factoryAddress || getContractConfig(config, chain.name, 'InterchainTokenFactory').address;
        if (!factoryAddress) {
            throw new Error('InterchainTokenFactory contract not found. Provide --factoryAddress or deploy factory first.');
        }

        const factoryContract = await getContractWithABI(provider, factoryAddress);
        const deploySalt = await factoryContract.interchain_token_deploy_salt(options.deployer, options.salt);
        
        console.log(`\nInterchain Token Deploy Salt: ${deploySalt}`);
    });

// Subcommand: canonical-interchain-token-deploy-salt
program
    .command('canonical-interchain-token-deploy-salt')
    .description('Calculate deployment salt for canonical interchain token')
    .requiredOption('--tokenAddress <address>', 'Token address')
    .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryAddress = options.factoryAddress || getContractConfig(config, chain.name, 'InterchainTokenFactory').address;
        if (!factoryAddress) {
            throw new Error('InterchainTokenFactory contract not found. Provide --factoryAddress or deploy factory first.');
        }

        const factoryContract = await getContractWithABI(provider, factoryAddress);
        const deploySalt = await factoryContract.canonical_interchain_token_deploy_salt(options.tokenAddress);
        
        console.log(`\nCanonical Token Deploy Salt: ${deploySalt}`);
    });

// Subcommand: linked-token-deploy-salt
program
    .command('linked-token-deploy-salt')
    .description('Calculate deployment salt for linked token')
    .requiredOption('--deployer <address>', 'Deployer address')
    .requiredOption('--salt <salt>', 'Salt value')
    .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryAddress = options.factoryAddress || getContractConfig(config, chain.name, 'InterchainTokenFactory').address;
        if (!factoryAddress) {
            throw new Error('InterchainTokenFactory contract not found. Provide --factoryAddress or deploy factory first.');
        }

        const factoryContract = await getContractWithABI(provider, factoryAddress);
        const deploySalt = await factoryContract.linked_token_deploy_salt(options.deployer, options.salt);
        
        console.log(`\nLinked Token Deploy Salt: ${deploySalt}`);
    });

// Subcommand: deploy-interchain-token
program
    .command('deploy-interchain-token')
    .description('Deploy a new interchain token')
    .requiredOption('--salt <salt>', 'Salt for deployment')
    .requiredOption('--name <name>', 'Token name')
    .requiredOption('--symbol <symbol>', 'Token symbol')
    .requiredOption('--decimals <decimals>', 'Token decimals')
    .requiredOption('--initialSupply <amount>', 'Initial supply to mint')
    .requiredOption('--minter <address>', 'Address to receive initial supply')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
        if (!factoryConfig.address) {
            throw new Error('InterchainTokenFactory contract not found in configuration');
        }

        console.log(`\nDeploying Interchain Token:`);
        console.log(`- Salt: ${options.salt}`);
        console.log(`- Name: ${options.name}`);
        console.log(`- Symbol: ${options.symbol}`);
        console.log(`- Decimals: ${options.decimals}`);
        console.log(`- Initial Supply: ${options.initialSupply}`);
        console.log(`- Minter: ${options.minter}`);

        const calldata = CallData.compile([
            options.salt,
            byteArray.byteArrayFromString(options.name),
            byteArray.byteArrayFromString(options.symbol),
            options.decimals,
            uint256.bnToUint256(options.initialSupply),
            options.minter
        ]);

        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for deploy interchain token...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'deploy_interchain_token',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for deploy interchain token...`);
            const calls = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'deploy_interchain_token',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'deploy_interchain_token');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const factoryContract = await getContractWithABI(provider, factoryConfig.address, account);

        console.log('\nExecuting deploy_interchain_token...');
        const tx = await factoryContract.deploy_interchain_token(
            options.salt,
            byteArray.byteArrayFromString(options.name),
            byteArray.byteArrayFromString(options.symbol),
            options.decimals,
            uint256.bnToUint256(options.initialSupply),
            options.minter
        );

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nInterchain token deployed successfully!');
    });

// Subcommand: register-canonical-interchain-token
program
    .command('register-canonical-interchain-token')
    .description('Register an existing token as canonical interchain token')
    .requiredOption('--tokenAddress <address>', 'Existing token address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
        if (!factoryConfig.address) {
            throw new Error('InterchainTokenFactory contract not found in configuration');
        }

        console.log(`\nRegistering Canonical Interchain Token:`);
        console.log(`- Token Address: ${options.tokenAddress}`);

        const calldata = CallData.compile([options.tokenAddress]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for register canonical token...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'register_canonical_interchain_token',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for register canonical token...`);
            const calls = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'register_canonical_interchain_token',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'register_canonical_interchain_token');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const factoryContract = await getContractWithABI(provider, factoryConfig.address, account);

        console.log('\nExecuting register_canonical_interchain_token...');
        const tx = await factoryContract.register_canonical_interchain_token(options.tokenAddress);

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nCanonical token registered successfully!');
    });

// Subcommand: deploy-remote-canonical-interchain-token
program
    .command('deploy-remote-canonical-interchain-token')
    .description('Deploy canonical token on remote chain')
    .requiredOption('--tokenAddress <address>', 'Original token address')
    .requiredOption('--destinationChain <chain>', 'Destination chain name')
    .requiredOption('--gasValue <value>', 'Gas value for cross-chain execution')
    .option('--gasToken <token>', 'Gas token (only STRK is supported currently)', 'STRK')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
        if (!factoryConfig.address) {
            throw new Error('InterchainTokenFactory contract not found in configuration');
        }

        console.log(`\nDeploying Remote Canonical Token:`);
        console.log(`- Token Address: ${options.tokenAddress}`);
        console.log(`- Destination Chain: ${options.destinationChain}`);
        console.log(`- Gas Value: ${options.gasValue}`);
        console.log(`- Gas Token: ${options.gasToken}`);

        const calldata = CallData.compile([
            options.tokenAddress,
            options.destinationChain,
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
        ]);

        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for deploy remote canonical token...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'deploy_remote_canonical_interchain_token',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for deploy remote canonical token...`);
            const calls = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'deploy_remote_canonical_interchain_token',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'deploy_remote_canonical_interchain_token');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const factoryContract = await getContractWithABI(provider, factoryConfig.address, account);

        console.log('\nExecuting deploy_remote_canonical_interchain_token...');
        const tx = await factoryContract.deploy_remote_canonical_interchain_token(
            options.tokenAddress,
            options.destinationChain,
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
        );

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nRemote canonical token deployment initiated!');
    });

// Subcommand: register-custom-token (FIXED to call ITF)
program
    .command('register-custom-token')
    .description('Register a custom token with specified parameters')
    .requiredOption('--tokenAddress <address>', 'Token contract address')
    .requiredOption('--tokenManagerType <type>', 'Token manager type (0-4)')
    .requiredOption('--mintTo <address>', 'Address to mint initial supply to')
    .requiredOption('--mintAmount <amount>', 'Amount to mint')
    .option('--operator <address>', 'Operator address (defaults to sender)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
        if (!factoryConfig.address) {
            throw new Error('InterchainTokenFactory contract not found in configuration');
        }

        console.log(`\nRegistering Custom Token:`);
        console.log(`- Token Address: ${options.tokenAddress}`);
        console.log(`- Token Manager Type: ${options.tokenManagerType}`);
        console.log(`- Mint To: ${options.mintTo}`);
        console.log(`- Mint Amount: ${options.mintAmount}`);
        console.log(`- Operator: ${options.operator || 'sender'}`);

        const calldata = CallData.compile([
            options.tokenAddress,
            options.tokenManagerType,
            options.mintTo,
            uint256.bnToUint256(options.mintAmount),
            options.operator || allOptions.accountAddress
        ]);

        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for register custom token...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'register_custom_token',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for register custom token...`);
            const calls = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'register_custom_token',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'register_custom_token');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const factoryContract = await getContractWithABI(provider, factoryConfig.address, account);

        console.log('\nExecuting register_custom_token...');
        const tx = await factoryContract.register_custom_token(
            options.tokenAddress,
            options.tokenManagerType,
            options.mintTo,
            uint256.bnToUint256(options.mintAmount),
            options.operator || allOptions.accountAddress
        );

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nCustom token registered successfully!');
    });

// Subcommand: link-token (FIXED to call ITF)
program
    .command('link-token')
    .description('Link tokens across chains')
    .requiredOption('--salt <salt>', 'Salt for linking')
    .requiredOption('--destinationChain <chain>', 'Destination chain name')
    .requiredOption('--destinationTokenAddress <address>', 'Token address on destination chain')
    .requiredOption('--tokenManagerType <type>', 'Token manager type (0-4)')
    .requiredOption('--linkTo <address>', 'Address to link to')
    .requiredOption('--gasValue <value>', 'Gas value for cross-chain execution')
    .option('--gasToken <token>', 'Gas token (only STRK is supported currently)', 'STRK')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
        if (!factoryConfig.address) {
            throw new Error('InterchainTokenFactory contract not found in configuration');
        }

        console.log(`\nLinking Token:`);
        console.log(`- Salt: ${options.salt}`);
        console.log(`- Destination Chain: ${options.destinationChain}`);
        console.log(`- Destination Token: ${options.destinationTokenAddress}`);
        console.log(`- Token Manager Type: ${options.tokenManagerType}`);
        console.log(`- Link To: ${options.linkTo}`);
        console.log(`- Gas Value: ${options.gasValue}`);
        console.log(`- Gas Token: ${options.gasToken}`);

        const calldata = CallData.compile([
            options.salt,
            options.destinationChain,
            byteArray.byteArrayFromString(options.destinationTokenAddress),
            options.tokenManagerType,
            options.linkTo,
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
        ]);

        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for link token...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'link_token',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for link token...`);
            const calls = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'link_token',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'link_token');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const factoryContract = await getContractWithABI(provider, factoryConfig.address, account);

        console.log('\nExecuting link_token...');
        const tx = await factoryContract.link_token(
            options.salt,
            options.destinationChain,
            byteArray.byteArrayFromString(options.destinationTokenAddress),
            options.tokenManagerType,
            options.linkTo,
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
        );

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nToken linked successfully!');
    });

// Subcommand: approve-deploy-remote-interchain-token
program
    .command('approve-deploy-remote-interchain-token')
    .description('Approve remote deployment with custom minter')
    .requiredOption('--deployer <address>', 'Deployer address')
    .requiredOption('--salt <salt>', 'Salt for deployment')
    .requiredOption('--destinationChain <chain>', 'Destination chain name')
    .requiredOption('--destinationMinter <minter>', 'Minter address on destination chain')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
        if (!factoryConfig.address) {
            throw new Error('InterchainTokenFactory contract not found in configuration');
        }

        console.log(`\nApproving Remote Deployment:`);
        console.log(`- Deployer: ${options.deployer}`);
        console.log(`- Salt: ${options.salt}`);
        console.log(`- Destination Chain: ${options.destinationChain}`);
        console.log(`- Destination Minter: ${options.destinationMinter}`);

        const calldata = CallData.compile([
            options.deployer,
            options.salt,
            options.destinationChain,
            byteArray.byteArrayFromString(options.destinationMinter)
        ]);

        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for approve deploy remote...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'approve_deploy_remote_interchain_token',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for approve deploy remote...`);
            const calls = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'approve_deploy_remote_interchain_token',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'approve_deploy_remote_interchain_token');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const factoryContract = await getContractWithABI(provider, factoryConfig.address, account);

        console.log('\nExecuting approve_deploy_remote_interchain_token...');
        const tx = await factoryContract.approve_deploy_remote_interchain_token(
            options.deployer,
            options.salt,
            options.destinationChain,
            byteArray.byteArrayFromString(options.destinationMinter)
        );

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nRemote deployment approved!');
    });

// Subcommand: revoke-deploy-remote-interchain-token
program
    .command('revoke-deploy-remote-interchain-token')
    .description('Revoke remote deployment approval')
    .requiredOption('--deployer <address>', 'Deployer address')
    .requiredOption('--salt <salt>', 'Salt for deployment')
    .requiredOption('--destinationChain <chain>', 'Destination chain name')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
        if (!factoryConfig.address) {
            throw new Error('InterchainTokenFactory contract not found in configuration');
        }

        console.log(`\nRevoking Remote Deployment Approval:`);
        console.log(`- Deployer: ${options.deployer}`);
        console.log(`- Salt: ${options.salt}`);
        console.log(`- Destination Chain: ${options.destinationChain}`);

        const calldata = CallData.compile([
            options.deployer,
            options.salt,
            options.destinationChain
        ]);

        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for revoke deploy remote...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'revoke_deploy_remote_interchain_token',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for revoke deploy remote...`);
            const calls = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'revoke_deploy_remote_interchain_token',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'revoke_deploy_remote_interchain_token');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const factoryContract = await getContractWithABI(provider, factoryConfig.address, account);

        console.log('\nExecuting revoke_deploy_remote_interchain_token...');
        const tx = await factoryContract.revoke_deploy_remote_interchain_token(
            options.deployer,
            options.salt,
            options.destinationChain
        );

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nRemote deployment approval revoked!');
    });

// Subcommand: deploy-remote-interchain-token
program
    .command('deploy-remote-interchain-token')
    .description('Deploy token on remote chain (no minter)')
    .requiredOption('--salt <salt>', 'Salt for deployment')
    .requiredOption('--minter <address>', 'Initial minter address')
    .requiredOption('--destinationChain <chain>', 'Destination chain name')
    .requiredOption('--gasValue <value>', 'Gas value for cross-chain execution')
    .option('--gasToken <token>', 'Gas token (only STRK is supported currently)', 'STRK')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
        if (!factoryConfig.address) {
            throw new Error('InterchainTokenFactory contract not found in configuration');
        }

        console.log(`\nDeploying Remote Interchain Token:`);
        console.log(`- Salt: ${options.salt}`);
        console.log(`- Minter: ${options.minter}`);
        console.log(`- Destination Chain: ${options.destinationChain}`);
        console.log(`- Gas Value: ${options.gasValue}`);
        console.log(`- Gas Token: ${options.gasToken}`);

        const calldata = CallData.compile([
            options.salt,
            options.minter,
            options.destinationChain,
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
        ]);

        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for deploy remote interchain token...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'deploy_remote_interchain_token',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for deploy remote interchain token...`);
            const calls = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'deploy_remote_interchain_token',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'deploy_remote_interchain_token');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const factoryContract = await getContractWithABI(provider, factoryConfig.address, account);

        console.log('\nExecuting deploy_remote_interchain_token...');
        const tx = await factoryContract.deploy_remote_interchain_token(
            options.salt,
            options.minter,
            options.destinationChain,
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
        );

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nRemote token deployment initiated!');
    });

// Subcommand: deploy-remote-interchain-token-with-minter
program
    .command('deploy-remote-interchain-token-with-minter')
    .description('Deploy token on remote chain with minter')
    .requiredOption('--salt <salt>', 'Salt for deployment')
    .requiredOption('--minter <address>', 'Initial minter address')
    .requiredOption('--destinationChain <chain>', 'Destination chain name')
    .requiredOption('--destinationMinter <minter>', 'Minter address on destination chain')
    .requiredOption('--gasValue <value>', 'Gas value for cross-chain execution')
    .option('--gasToken <token>', 'Gas token (only STRK is supported currently)', 'STRK')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
        if (!factoryConfig.address) {
            throw new Error('InterchainTokenFactory contract not found in configuration');
        }

        console.log(`\nDeploying Remote Interchain Token with Minter:`);
        console.log(`- Salt: ${options.salt}`);
        console.log(`- Minter: ${options.minter}`);
        console.log(`- Destination Chain: ${options.destinationChain}`);
        console.log(`- Destination Minter: ${options.destinationMinter}`);
        console.log(`- Gas Value: ${options.gasValue}`);
        console.log(`- Gas Token: ${options.gasToken}`);

        const calldata = CallData.compile([
            options.salt,
            options.minter,
            options.destinationChain,
            byteArray.byteArrayFromString(options.destinationMinter),
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
        ]);

        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for deploy remote interchain token with minter...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'deploy_remote_interchain_token_with_minter',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for deploy remote interchain token with minter...`);
            const calls = [{
                contractAddress: factoryConfig.address,
                entrypoint: 'deploy_remote_interchain_token_with_minter',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'deploy_remote_interchain_token_with_minter');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const factoryContract = await getContractWithABI(provider, factoryConfig.address, account);

        console.log('\nExecuting deploy_remote_interchain_token_with_minter...');
        const tx = await factoryContract.deploy_remote_interchain_token_with_minter(
            options.salt,
            options.minter,
            options.destinationChain,
            byteArray.byteArrayFromString(options.destinationMinter),
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
        );

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nRemote token with minter deployment initiated!');
    });

// Add global options
addStarknetOptions(program);

// Help text
program.addHelpText('after', `
Examples:
  Calculate token IDs:
    $ itf interchain-token-id --deployer 0x123... --salt my-salt
    $ itf canonical-interchain-token-id --tokenAddress 0x456...
    $ itf linked-token-id --deployer 0x789... --salt link-salt

  Deploy tokens:
    $ itf deploy-interchain-token --salt my-token --name "My Token" --symbol MTK --decimals 18 --initialSupply 1000000 --minter 0x123...
    $ itf register-canonical-interchain-token --tokenAddress 0x456...

  Cross-chain operations:
    $ itf deploy-remote-canonical-interchain-token --tokenAddress 0x123... --destinationChain ethereum --gasValue 100000
    $ itf link-token --salt my-link --destinationChain polygon --destinationTokenAddress 0x789... --tokenManagerType 0 --linkTo 0xabc... --gasValue 100000

For subcommand help:
  $ itf <subcommand> --help`);

program.parse();
