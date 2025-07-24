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
 * Helper function to get ITS contract instance with ABI
 */
async function getITSContract(
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
    .name('its')
    .description('InterchainTokenService operations on Starknet')
    .version('1.0.0');

// Subcommand: set-factory-address
program
    .command('set-factory-address')
    .description('Set the factory address for InterchainTokenService')
    .option('--factoryAddress <address>', 'Factory address (defaults to config value)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
        if (!itsConfig.address) {
            throw new Error('InterchainTokenService contract not found in configuration');
        }

        // Try to get factory address from config if not provided
        let finalFactoryAddress = options.factoryAddress;
        if (!finalFactoryAddress) {
            const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
            if (factoryConfig.address) {
                finalFactoryAddress = factoryConfig.address;
                console.log(`- Using factory address from config: ${finalFactoryAddress}`);
            } else {
                throw new Error('Factory address is required. Either provide --factoryAddress or ensure InterchainTokenFactory is configured');
            }
        }

        console.log(`\nSetting factory address:`);
        console.log(`- Factory Address: ${finalFactoryAddress}`);

        const calldata = CallData.compile([finalFactoryAddress]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for setting factory address...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: itsConfig.address,
                entrypoint: 'set_factory_address',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for setting factory address...`);
            const calls = [{
                contractAddress: itsConfig.address,
                entrypoint: 'set_factory_address',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'set_factory_address');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const itsContract = await getITSContract(provider, itsConfig.address, account);

        console.log(`\nExecuting set_factory_address...`);
        const tx = await itsContract.set_factory_address(finalFactoryAddress);
        
        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log(`\nFactory address set to: ${finalFactoryAddress}`);
    });

// Subcommand: chain-name
program
    .command('chain-name')
    .description('Get the chain name from InterchainTokenService')
    .option('--itsAddress <address>', 'InterchainTokenService address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsAddress = options.itsAddress || getContractConfig(config, chain.name, 'InterchainTokenService').address;
        if (!itsAddress) {
            throw new Error('InterchainTokenService contract not found. Provide --itsAddress or deploy ITS first.');
        }

        const itsContract = await getITSContract(provider, itsAddress);
        const chainName = await itsContract.chain_name();
        
        console.log(`\nChain Name: ${chainName}`);
    });

// Subcommand: token-manager-address
program
    .command('token-manager-address')
    .description('Get token manager address for a token ID')
    .requiredOption('--tokenId <id>', 'Token ID (hex string)')
    .option('--itsAddress <address>', 'InterchainTokenService address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsAddress = options.itsAddress || getContractConfig(config, chain.name, 'InterchainTokenService').address;
        if (!itsAddress) {
            throw new Error('InterchainTokenService contract not found. Provide --itsAddress or deploy ITS first.');
        }

        const itsContract = await getITSContract(provider, itsAddress);
        const tokenIdUint256 = parseTokenId(options.tokenId);
        const tokenManagerAddress = await itsContract.token_manager_address(tokenIdUint256);
        
        console.log(`\nToken Manager Address: ${tokenManagerAddress}`);
    });

// Subcommand: registered-token-address
program
    .command('registered-token-address')
    .description('Get registered token address for a token ID')
    .requiredOption('--tokenId <id>', 'Token ID (hex string)')
    .option('--itsAddress <address>', 'InterchainTokenService address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsAddress = options.itsAddress || getContractConfig(config, chain.name, 'InterchainTokenService').address;
        if (!itsAddress) {
            throw new Error('InterchainTokenService contract not found. Provide --itsAddress or deploy ITS first.');
        }

        const itsContract = await getITSContract(provider, itsAddress);
        const tokenIdUint256 = parseTokenId(options.tokenId);
        
        try {
            const tokenAddress = await itsContract.registered_token_address(tokenIdUint256);
            console.log(`\nRegistered Token Address: ${tokenAddress}`);
        } catch (error) {
            console.log('\nNo token registered for this token ID');
        }
    });

// Subcommand: interchain-token-address
program
    .command('interchain-token-address')
    .description('Get predicted interchain token address for a token ID')
    .requiredOption('--tokenId <id>', 'Token ID (hex string)')
    .option('--itsAddress <address>', 'InterchainTokenService address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsAddress = options.itsAddress || getContractConfig(config, chain.name, 'InterchainTokenService').address;
        if (!itsAddress) {
            throw new Error('InterchainTokenService contract not found. Provide --itsAddress or deploy ITS first.');
        }

        const itsContract = await getITSContract(provider, itsAddress);
        const tokenIdUint256 = parseTokenId(options.tokenId);
        const interchainTokenAddress = await itsContract.interchain_token_address(tokenIdUint256);
        
        console.log(`\nInterchain Token Address (predicted): ${interchainTokenAddress}`);
    });

// Subcommand: interchain-transfer
program
    .command('interchain-transfer')
    .description('Transfer tokens across chains')
    .requiredOption('--tokenId <id>', 'Token ID (hex string)')
    .requiredOption('--destinationChain <chain>', 'Destination chain name')
    .requiredOption('--destinationAddress <address>', 'Destination address')
    .requiredOption('--amount <amount>', 'Amount to transfer (in smallest unit)')
    .option('--data <data>', 'Optional data (hex bytes with 0x prefix, or UTF-8 string)')
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
        const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
        if (!itsConfig.address) {
            throw new Error('InterchainTokenService contract not found in configuration');
        }

        console.log(`\nInterchain Token Transfer:`);
        console.log(`- Token ID: ${options.tokenId}`);
        console.log(`- Destination Chain: ${options.destinationChain}`);
        console.log(`- Destination Address: ${options.destinationAddress}`);
        console.log(`- Amount: ${options.amount}`);
        if (options.data) {
            const { isHex } = detectDataFormat(options.data);
            console.log(`- Data: ${options.data} (${isHex ? 'hex bytes' : 'string'})`);
        }
        console.log(`- Gas Value: ${options.gasValue}`);
        console.log(`- Gas Token: ${options.gasToken}`);

        const tokenIdUint256 = parseTokenId(options.tokenId);
        const dataByteArray = options.data ? dataToByteArrayStruct(options.data) : { data: [], pending_word: '0x0', pending_word_len: 0 };
        
        const calldata = CallData.compile([
            tokenIdUint256,
            options.destinationChain,
            byteArray.byteArrayFromString(options.destinationAddress),
            uint256.bnToUint256(options.amount),
            dataByteArray,
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} }),
        ]);

        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for interchain transfer...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: itsConfig.address,
                entrypoint: 'interchain_transfer',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for interchain transfer...`);
            const calls = [{
                contractAddress: itsConfig.address,
                entrypoint: 'interchain_transfer',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'interchain_transfer');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const itsContract = await getITSContract(provider, itsConfig.address, account);

        console.log('\nExecuting interchain_transfer...');
        const tx = await account.execute({
            contractAddress: itsConfig.address,
            entrypoint: 'interchain_transfer',
            calldata: hexCalldata
        });

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await provider.waitForTransaction(tx.transaction_hash);
        console.log('\nInterchain transfer initiated successfully!');
    });

// Subcommand: register-token-metadata
program
    .command('register-token-metadata')
    .description('Register token metadata for cross-chain compatibility')
    .requiredOption('--tokenAddress <address>', 'Token contract address')
    .requiredOption('--gasValue <value>', 'Gas value for the operation')
    .option('--gasToken <token>', 'Gas token (only STRK is supported currently)', 'STRK')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
        if (!itsConfig.address) {
            throw new Error('InterchainTokenService contract not found in configuration');
        }

        console.log(`\nRegistering Token Metadata:`);
        console.log(`- Token Address: ${options.tokenAddress}`);
        console.log(`- Gas Value: ${options.gasValue}`);
        console.log(`- Gas Token: ${options.gasToken}`);

        const calldata = CallData.compile([
            options.tokenAddress,
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} }),
        ]);

        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for register token metadata...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: itsConfig.address,
                entrypoint: 'register_token_metadata',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for register token metadata...`);
            const calls = [{
                contractAddress: itsConfig.address,
                entrypoint: 'register_token_metadata',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'register_token_metadata');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const itsContract = await getITSContract(provider, itsConfig.address, account);

        console.log('\nExecuting register_token_metadata...');
        const tx = await itsContract.register_token_metadata(
            options.tokenAddress,
            uint256.bnToUint256(options.gasValue),
            options.gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
        );

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nToken metadata registered successfully!');
    });

// Subcommand: set-flow-limits
program
    .command('set-flow-limits')
    .description('Set flow limits for multiple tokens')
    .requiredOption('--tokenIds <ids>', 'Comma-separated list of token IDs (hex strings)')
    .requiredOption('--flowLimits <limits>', 'Comma-separated list of flow limits (in smallest unit)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
        if (!itsConfig.address) {
            throw new Error('InterchainTokenService contract not found in configuration');
        }

        const tokenIdStrings = options.tokenIds.split(',').map(id => id.trim());
        const flowLimitStrings = options.flowLimits.split(',').map(limit => limit.trim());
        
        if (tokenIdStrings.length !== flowLimitStrings.length) {
            throw new Error(`Token IDs count (${tokenIdStrings.length}) must match flow limits count (${flowLimitStrings.length})`);
        }

        const parsedTokenIds = tokenIdStrings.map(parseTokenId);
        const parsedFlowLimits = flowLimitStrings.map(limit => uint256.bnToUint256(limit));

        console.log(`\nSetting Flow Limits:`);
        console.log(`- Number of tokens: ${tokenIdStrings.length}`);
        
        for (let i = 0; i < tokenIdStrings.length; i++) {
            console.log(`\nToken ${i + 1}:`);
            console.log(`  - Token ID: ${tokenIdStrings[i]}`);
            console.log(`  - Flow Limit: ${flowLimitStrings[i]}`);
        }

        const calldata = CallData.compile([parsedTokenIds, parsedFlowLimits]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for setting flow limits...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: itsConfig.address,
                entrypoint: 'set_flow_limits',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for setting flow limits...`);
            const calls = [{
                contractAddress: itsConfig.address,
                entrypoint: 'set_flow_limits',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'set_flow_limits');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const itsContract = await getITSContract(provider, itsConfig.address, account);

        console.log('\nExecuting set_flow_limits...');
        const tx = await itsContract.set_flow_limits(parsedTokenIds, parsedFlowLimits);

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nFlow limits set successfully!');
    });

// Subcommand: set-pause-status
program
    .command('set-pause-status')
    .description('Pause or unpause the InterchainTokenService')
    .requiredOption('--paused <bool>', 'Pause status (true/false)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
        if (!itsConfig.address) {
            throw new Error('InterchainTokenService contract not found in configuration');
        }

        const paused = options.paused === 'true';
        console.log(`\n${paused ? 'Pausing' : 'Unpausing'} InterchainTokenService...`);

        const calldata = CallData.compile([paused]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for set pause status...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: itsConfig.address,
                entrypoint: 'set_pause_status',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for set pause status...`);
            const calls = [{
                contractAddress: itsConfig.address,
                entrypoint: 'set_pause_status',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'set_pause_status');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const itsContract = await getITSContract(provider, itsConfig.address, account);

        console.log('\nExecuting set_pause_status...');
        const tx = await itsContract.set_pause_status(paused);

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log(`\nInterchainTokenService has been ${paused ? 'PAUSED' : 'UNPAUSED'}.`);
    });

// Subcommand: set-trusted-chain
program
    .command('set-trusted-chain')
    .description('Add a trusted chain')
    .requiredOption('--chainName <name>', 'Chain name to trust')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
        if (!itsConfig.address) {
            throw new Error('InterchainTokenService contract not found in configuration');
        }

        console.log(`\nAdding trusted chain: ${options.chainName}`);

        const calldata = CallData.compile([options.chainName]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for set trusted chain...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: itsConfig.address,
                entrypoint: 'set_trusted_chain',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for set trusted chain...`);
            const calls = [{
                contractAddress: itsConfig.address,
                entrypoint: 'set_trusted_chain',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'set_trusted_chain');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const itsContract = await getITSContract(provider, itsConfig.address, account);

        console.log('\nExecuting set_trusted_chain...');
        const tx = await itsContract.set_trusted_chain(options.chainName);

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log(`\nChain "${options.chainName}" has been added as trusted.`);
    });

// Subcommand: remove-trusted-chain
program
    .command('remove-trusted-chain')
    .description('Remove a trusted chain')
    .requiredOption('--chainName <name>', 'Chain name to remove from trusted list')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
        if (!itsConfig.address) {
            throw new Error('InterchainTokenService contract not found in configuration');
        }

        console.log(`\nRemoving trusted chain: ${options.chainName}`);

        const calldata = CallData.compile([options.chainName]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for remove trusted chain...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: itsConfig.address,
                entrypoint: 'remove_trusted_chain',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for remove trusted chain...`);
            const calls = [{
                contractAddress: itsConfig.address,
                entrypoint: 'remove_trusted_chain',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'remove_trusted_chain');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const itsContract = await getITSContract(provider, itsConfig.address, account);

        console.log('\nExecuting remove_trusted_chain...');
        const tx = await itsContract.remove_trusted_chain(options.chainName);

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log(`\nChain "${options.chainName}" has been removed from trusted chains.`);
    });

// Subcommand: is-trusted-chain
program
    .command('is-trusted-chain')
    .description('Check if a chain is trusted')
    .requiredOption('--chainName <name>', 'Chain name to check')
    .option('--itsAddress <address>', 'InterchainTokenService address (defaults to config)')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const itsAddress = options.itsAddress || getContractConfig(config, chain.name, 'InterchainTokenService').address;
        if (!itsAddress) {
            throw new Error('InterchainTokenService contract not found. Provide --itsAddress or deploy ITS first.');
        }

        const itsContract = await getITSContract(provider, itsAddress);
        const isTrusted = await itsContract.is_trusted_chain(options.chainName);
        
        console.log(`\nChain "${options.chainName}" is ${isTrusted ? 'TRUSTED' : 'NOT TRUSTED'}`);
    });

// Add global options
addStarknetOptions(program);

// Help text
program.addHelpText('after', `
Examples:
  Set factory address:
    $ its set-factory-address --factoryAddress 0x123...
    $ its set-factory-address  # Uses config value

  Query chain name:
    $ its chain-name

  Transfer tokens:
    $ its interchain-transfer --tokenId 0x123... --destinationChain ethereum --destinationAddress 0x456... --amount 1000 --gasValue 100000

  Set flow limits:
    $ its set-flow-limits --tokenIds 0x123...,0x456... --flowLimits 1000000,2000000

  Manage trusted chains:
    $ its set-trusted-chain --chainName ethereum
    $ its remove-trusted-chain --chainName polygon
    $ its is-trusted-chain --chainName ethereum

For subcommand help:
  $ its <subcommand> --help`);

program.parse();
