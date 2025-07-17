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
import { CallData, Call, Contract, uint256, num } from 'starknet';
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
 * Get interchain token address from ITS for a given token ID
 */
async function getInterchainTokenAddress(
    provider: any,
    itsAddress: string,
    tokenId: string
): Promise<string> {
    const itsContract = await getContractWithABI(provider, itsAddress);
    const tokenIdUint256 = parseTokenId(tokenId);
    return await itsContract.interchain_token_address(tokenIdUint256);
}

// Main program setup
const program = new Command();

program
    .name('interchain-token')
    .description('InterchainToken operations on Starknet')
    .version('1.0.0');

// Subcommand: transfer-mintership
program
    .command('transfer-mintership')
    .description('Transfer minter role to a new address')
    .requiredOption('--tokenAddress <address>', 'Interchain token address')
    .requiredOption('--newMinter <address>', 'New minter address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);

        console.log(`\nTransferring Mintership:`);
        console.log(`- Token Address: ${options.tokenAddress}`);
        console.log(`- New Minter: ${options.newMinter}`);

        const calldata = CallData.compile([options.newMinter]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for transfer mintership...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: options.tokenAddress,
                entrypoint: 'transfer_mintership',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for transfer mintership...`);
            const calls = [{
                contractAddress: options.tokenAddress,
                entrypoint: 'transfer_mintership',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'transfer_mintership');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const tokenContract = await getContractWithABI(provider, options.tokenAddress, account);

        console.log('\nExecuting transfer_mintership...');
        const tx = await tokenContract.transfer_mintership(options.newMinter);

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nMintership transferred successfully!');
    });

// Subcommand: is-minter
program
    .command('is-minter')
    .description('Check if an address has minter role')
    .requiredOption('--tokenAddress <address>', 'Interchain token address')
    .requiredOption('--address <address>', 'Address to check')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        const tokenContract = await getContractWithABI(provider, options.tokenAddress);
        
        const isMinter = await tokenContract.is_minter(options.address);
        console.log(`\nAddress ${options.address} is ${isMinter ? 'a minter' : 'NOT a minter'}`);
    });

// Subcommand: mint
program
    .command('mint')
    .description('Mint new tokens to a recipient')
    .requiredOption('--tokenAddress <address>', 'Interchain token address')
    .requiredOption('--recipient <address>', 'Recipient address')
    .requiredOption('--amount <amount>', 'Amount to mint')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);

        console.log(`\nMinting Tokens:`);
        console.log(`- Token Address: ${options.tokenAddress}`);
        console.log(`- Recipient: ${options.recipient}`);
        console.log(`- Amount: ${options.amount}`);

        const calldata = CallData.compile([
            options.recipient,
            uint256.bnToUint256(options.amount)
        ]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for mint...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: options.tokenAddress,
                entrypoint: 'mint',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for mint...`);
            const calls = [{
                contractAddress: options.tokenAddress,
                entrypoint: 'mint',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'mint');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const tokenContract = await getContractWithABI(provider, options.tokenAddress, account);

        // Check if sender is a minter
        console.log('\nVerifying minter role...');
        try {
            const isMinter = await tokenContract.is_minter(account.address);
            if (!isMinter) {
                console.warn(`Warning: Current account (${account.address}) is not a minter.`);
                console.warn('This transaction may fail if only minters can mint tokens.');
            }
        } catch (error) {
            console.log('Could not verify minter role. Proceeding...');
        }

        console.log('\nExecuting mint...');
        const tx = await tokenContract.mint(options.recipient, uint256.bnToUint256(options.amount));

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nTokens minted successfully!');
    });

// Subcommand: burn
program
    .command('burn')
    .description('Burn tokens from an address')
    .requiredOption('--tokenAddress <address>', 'Interchain token address')
    .requiredOption('--from <address>', 'Address to burn from')
    .requiredOption('--amount <amount>', 'Amount to burn')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        validateStarknetOptions(allOptions.env, allOptions.offline, allOptions.privateKey, allOptions.accountAddress);
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);

        console.log(`\nBurning Tokens:`);
        console.log(`- Token Address: ${options.tokenAddress}`);
        console.log(`- From: ${options.from}`);
        console.log(`- Amount: ${options.amount}`);

        const calldata = CallData.compile([
            options.from,
            uint256.bnToUint256(options.amount)
        ]);
        const hexCalldata = calldata.map(item => num.toHex(item));

        if (allOptions.estimate) {
            console.log(`\nEstimating gas for burn...`);
            const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
            const calls: Call[] = [{
                contractAddress: options.tokenAddress,
                entrypoint: 'burn',
                calldata
            }];
            await estimateGasAndDisplayArgs(account, calls);
            return;
        }

        if (allOptions.offline) {
            console.log(`\nGenerating unsigned transaction for burn...`);
            const calls = [{
                contractAddress: options.tokenAddress,
                entrypoint: 'burn',
                calldata: hexCalldata
            }];
            await handleOfflineTransaction(allOptions, chain.name, calls, 'burn');
            return;
        }

        const account = getStarknetAccount(allOptions.privateKey!, allOptions.accountAddress!, provider);
        const tokenContract = await getContractWithABI(provider, options.tokenAddress, account);

        // Check balance before burning
        console.log('\nChecking balance...');
        try {
            const balanceAbi = [
                {
                    "name": "balanceOf",
                    "type": "function",
                    "inputs": [{ "name": "account", "type": "core::starknet::contract_address::ContractAddress" }],
                    "outputs": [{ "type": "core::integer::u256" }],
                    "state_mutability": "view"
                }
            ];
            const balanceContract = new Contract(balanceAbi, options.tokenAddress, provider);
            const balance = await balanceContract.balanceOf(options.from);
            console.log(`Current balance: ${balance}`);
            
            const burnAmount = BigInt(options.amount);
            if (BigInt(balance) < burnAmount) {
                console.warn(`Warning: Insufficient balance. Current: ${balance}, Burn amount: ${options.amount}`);
            }
        } catch (error) {
            console.log('Could not check balance. Proceeding...');
        }

        console.log('\nExecuting burn...');
        const tx = await tokenContract.burn(options.from, uint256.bnToUint256(options.amount));

        console.log('Transaction hash:', tx.transaction_hash);
        console.log('\nWaiting for transaction to be accepted...');
        await tx.wait();
        console.log('\nTokens burned successfully!');
    });

// Helper subcommand: get-token-by-id
program
    .command('get-token-by-id')
    .description('Get interchain token address from ITS using token ID')
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

        const tokenAddress = await getInterchainTokenAddress(provider, itsAddress, options.tokenId);
        console.log(`\nInterchain Token Address: ${tokenAddress}`);
    });

// Helper subcommand: token-info
program
    .command('token-info')
    .description('Get basic token information')
    .requiredOption('--tokenAddress <address>', 'Interchain token address')
    .action(async (options, command) => {
        const globalOptions = command.parent.opts();
        const allOptions = { ...globalOptions, ...options };
        
        const config = loadConfig(allOptions.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) throw new Error('Starknet configuration not found');

        const provider = getStarknetProvider(chain);
        
        console.log(`\nQuerying Token Information for: ${options.tokenAddress}`);
        
        try {
            const tokenAbi = [
                {
                    "name": "name",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{ "type": "core::byte_array::ByteArray" }],
                    "state_mutability": "view"
                },
                {
                    "name": "symbol",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{ "type": "core::byte_array::ByteArray" }],
                    "state_mutability": "view"
                },
                {
                    "name": "decimals",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{ "type": "core::integer::u8" }],
                    "state_mutability": "view"
                },
                {
                    "name": "totalSupply",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{ "type": "core::integer::u256" }],
                    "state_mutability": "view"
                }
            ];

            const tokenContract = new Contract(tokenAbi, options.tokenAddress, provider);
            
            const name = await tokenContract.name();
            const symbol = await tokenContract.symbol();
            const decimals = await tokenContract.decimals();
            const totalSupply = await tokenContract.totalSupply();

            console.log(`\nToken Details:`);
            console.log(`- Name: ${name}`);
            console.log(`- Symbol: ${symbol}`);
            console.log(`- Decimals: ${decimals}`);
            console.log(`- Total Supply: ${totalSupply}`);
        } catch (error) {
            console.error('Error fetching token information:', error.message);
        }
    });

// Add global options
addStarknetOptions(program);

// Help text
program.addHelpText('after', `
Examples:
  Minter management:
    $ interchain-token transfer-mintership --tokenAddress 0x123... --newMinter 0x456...
    $ interchain-token is-minter --tokenAddress 0x123... --address 0x456...

  Token operations:
    $ interchain-token mint --tokenAddress 0x123... --recipient 0x789... --amount 1000000
    $ interchain-token burn --tokenAddress 0x123... --from 0x789... --amount 500000

  Helper commands:
    $ interchain-token get-token-by-id --tokenId 0xabc...
    $ interchain-token token-info --tokenAddress 0x123...

For subcommand help:
  $ interchain-token <subcommand> --help`);

program.parse();
