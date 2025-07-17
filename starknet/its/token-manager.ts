import { Command } from 'commander';
import { loadConfig } from '../../common';
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
import { CallData, Call, Contract, uint256, byteArray, num } from 'starknet';
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
 * Get token manager address from ITS for a given token ID
 */
async function getTokenManagerAddress(
    provider: any,
    itsAddress: string,
    tokenId: string
): Promise<string> {
    const itsContract = await getContractWithABI(provider, itsAddress);
    const tokenIdUint256 = parseTokenId(tokenId);
    return await itsContract.token_manager_address(tokenIdUint256);
}

// Main program setup
const program = new Command();

program
    .name('token-manager')
    .description('TokenManager operations on Starknet')
    .version('1.0.0');

// Subcommand: interchain-token-id
program
    .command('interchain-token-id')
    .description('Get the interchain token ID managed by this token manager')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress);
        
        const tokenId = await tokenManager.interchain_token_id();
        console.log(`\nInterchain Token ID: ${tokenId}`);
    });

// Subcommand: token-address
program
    .command('token-address')
    .description('Get the token address managed by this token manager')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress);
        
        const tokenAddress = await tokenManager.token_address();
        console.log(`\nToken Address: ${tokenAddress}`);
    });

// Subcommand: token-address-from-params
program
    .command('token-address-from-params')
    .description('Derive token address from parameters')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .requiredOption('--params <data>', 'Parameters as hex string')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress);
        
        const tokenAddress = await tokenManager.token_address_from_params(
            byteArray.byteArrayFromString(options.params)
        );
        console.log(`\nDerived Token Address: ${tokenAddress}`);
    });

// Subcommand: implementation-type
program
    .command('implementation-type')
    .description('Get the token manager implementation type')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress);
        
        const implementationType = await tokenManager.implementation_type();
        const typeNames = ['NativeInterchainToken', 'MintBurnFrom', 'LockUnlock', 'LockUnlockFee', 'MintBurn'];
        console.log(`\nImplementation Type: ${typeNames[implementationType] || implementationType} (${implementationType})`);
    });

// Subcommand: flow-limit
program
    .command('flow-limit')
    .description('Get the flow limit for the token')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress);
        
        const flowLimit = await tokenManager.flow_limit();
        console.log(`\nFlow Limit: ${flowLimit}`);
    });

// Subcommand: flow-out-amount
program
    .command('flow-out-amount')
    .description('Get the current flow out amount')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress);
        
        const flowOut = await tokenManager.flow_out_amount();
        console.log(`\nFlow Out Amount: ${flowOut}`);
    });

// Subcommand: flow-in-amount
program
    .command('flow-in-amount')
    .description('Get the current flow in amount')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress);
        
        const flowIn = await tokenManager.flow_in_amount();
        console.log(`\nFlow In Amount: ${flowIn}`);
    });

// Subcommand: add-flow-in
program
    .command('add-flow-in')
    .description('Add to flow in amount')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .requiredOption('--amount <amount>', 'Amount to add')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);

        console.log(`\nAdding Flow In:`);
        console.log(`- Token Manager: ${options.tokenManagerAddress}`);
        console.log(`- Amount: ${options.amount}`);

        const calldata = CallData.compile([uint256.bnToUint256(options.amount)]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for add flow in...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'add_flow_in',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for add flow in...`);
            const calls = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'add_flow_in',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'add_flow_in');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress, account);

        console.log('\nExecuting add_flow_in...');
        const tx = await tokenManager.add_flow_in(uint256.bnToUint256(options.amount));

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nFlow in amount added successfully!');
    });

// Subcommand: add-flow-out
program
    .command('add-flow-out')
    .description('Add to flow out amount')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .requiredOption('--amount <amount>', 'Amount to add')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);

        console.log(`\nAdding Flow Out:`);
        console.log(`- Token Manager: ${options.tokenManagerAddress}`);
        console.log(`- Amount: ${options.amount}`);

        const calldata = CallData.compile([uint256.bnToUint256(options.amount)]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for add flow out...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'add_flow_out',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for add flow out...`);
            const calls = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'add_flow_out',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'add_flow_out');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress, account);

        console.log('\nExecuting add_flow_out...');
        const tx = await tokenManager.add_flow_out(uint256.bnToUint256(options.amount));

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nFlow out amount added successfully!');
    });

// Subcommand: set-flow-limit
program
    .command('set-flow-limit')
    .description('Set the flow limit for the token')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .requiredOption('--flowLimit <limit>', 'New flow limit')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);

        console.log(`\nSetting Flow Limit:`);
        console.log(`- Token Manager: ${options.tokenManagerAddress}`);
        console.log(`- Flow Limit: ${options.flowLimit}`);

        const calldata = CallData.compile([uint256.bnToUint256(options.flowLimit)]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for set flow limit...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'set_flow_limit',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for set flow limit...`);
            const calls = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'set_flow_limit',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'set_flow_limit');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress, account);

        console.log('\nExecuting set_flow_limit...');
        const tx = await tokenManager.set_flow_limit(uint256.bnToUint256(options.flowLimit));

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nFlow limit set successfully!');
    });

// Subcommand: transfer-flow-limiter
program
    .command('transfer-flow-limiter')
    .description('Transfer flow limiter role from one address to another')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .requiredOption('--from <address>', 'Current flow limiter address')
    .requiredOption('--to <address>', 'New flow limiter address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);

        console.log(`\nTransferring Flow Limiter Role:`);
        console.log(`- Token Manager: ${options.tokenManagerAddress}`);
        console.log(`- From: ${options.from}`);
        console.log(`- To: ${options.to}`);

        const calldata = CallData.compile([options.from, options.to]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for transfer flow limiter...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'transfer_flow_limiter',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for transfer flow limiter...`);
            const calls = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'transfer_flow_limiter',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'transfer_flow_limiter');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress, account);

        console.log('\nExecuting transfer_flow_limiter...');
        const tx = await tokenManager.transfer_flow_limiter(options.from, options.to);

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nFlow limiter role transferred successfully!');
    });

// Subcommand: add-flow-limiter
program
    .command('add-flow-limiter')
    .description('Add a new flow limiter')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .requiredOption('--flowLimiter <address>', 'Address to add as flow limiter')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);

        console.log(`\nAdding Flow Limiter:`);
        console.log(`- Token Manager: ${options.tokenManagerAddress}`);
        console.log(`- Flow Limiter: ${options.flowLimiter}`);

        const calldata = CallData.compile([options.flowLimiter]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for add flow limiter...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'add_flow_limiter',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for add flow limiter...`);
            const calls = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'add_flow_limiter',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'add_flow_limiter');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress, account);

        console.log('\nExecuting add_flow_limiter...');
        const tx = await tokenManager.add_flow_limiter(options.flowLimiter);

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nFlow limiter added successfully!');
    });

// Subcommand: remove-flow-limiter
program
    .command('remove-flow-limiter')
    .description('Remove a flow limiter')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .requiredOption('--flowLimiter <address>', 'Address to remove as flow limiter')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);

        console.log(`\nRemoving Flow Limiter:`);
        console.log(`- Token Manager: ${options.tokenManagerAddress}`);
        console.log(`- Flow Limiter: ${options.flowLimiter}`);

        const calldata = CallData.compile([options.flowLimiter]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for remove flow limiter...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'remove_flow_limiter',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for remove flow limiter...`);
            const calls = [{
                contractAddress: options.tokenManagerAddress,
                entrypoint: 'remove_flow_limiter',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'remove_flow_limiter');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress, account);

        console.log('\nExecuting remove_flow_limiter...');
        const tx = await tokenManager.remove_flow_limiter(options.flowLimiter);

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nFlow limiter removed successfully!');
    });

// Subcommand: is-flow-limiter
program
    .command('is-flow-limiter')
    .description('Check if an address is a flow limiter')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .requiredOption('--address <address>', 'Address to check')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress);
        
        const isFlowLimiter = await tokenManager.is_flow_limiter(options.address);
        console.log(`\nAddress ${options.address} is ${isFlowLimiter ? 'a flow limiter' : 'NOT a flow limiter'}`);
    });

// Subcommand: params
program
    .command('params')
    .description('Get token manager parameters')
    .requiredOption('--tokenManagerAddress <address>', 'Token manager address')
    .requiredOption('--operator <address>', 'Operator address')
    .requiredOption('--tokenAddress <address>', 'Token address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const tokenManager = await getContractWithABI(provider, options.tokenManagerAddress);
        
        const params = await tokenManager.params(options.operator, options.tokenAddress);
        console.log(`\nToken Manager Parameters:`);
        console.log(params);
    });

// Helper subcommand: get-token-manager-by-id
program
    .command('get-token-manager-by-id')
    .description('Get token manager address from ITS using token ID')
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

        const tokenManagerAddress = await getTokenManagerAddress(provider, itsAddress, options.tokenId);
        console.log(`\nToken Manager Address: ${tokenManagerAddress}`);
    });

// Add global options
addStarknetOptions(program);

// Help text
program.addHelpText('after', `
Examples:
  Query token manager info:
    $ token-manager implementation-type --tokenManagerAddress 0x123...
    $ token-manager token-address --tokenManagerAddress 0x123...
    $ token-manager flow-limit --tokenManagerAddress 0x123...

  Manage flow limits:
    $ token-manager set-flow-limit --tokenManagerAddress 0x123... --flowLimit 1000000
    $ token-manager add-flow-limiter --tokenManagerAddress 0x123... --flowLimiter 0x456...
    $ token-manager is-flow-limiter --tokenManagerAddress 0x123... --address 0x456...

  Helper commands:
    $ token-manager get-token-manager-by-id --tokenId 0x789...

For subcommand help:
  $ token-manager <subcommand> --help`);

program.parse();
