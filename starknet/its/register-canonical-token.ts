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
import { CallData, Call, Contract, num } from 'starknet';
import {
    Config,
    ChainConfig,
    GatewayCommandOptions,
    OfflineTransactionResult
} from '../types';

interface RegisterCanonicalTokenOptions extends GatewayCommandOptions {
    tokenAddress: string;
    factoryAddress?: string;
}

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

async function processCommand(
    config: Config,
    chain: ChainConfig & { name: string },
    options: RegisterCanonicalTokenOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        tokenAddress,
        factoryAddress,
        offline,
        estimate,
    } = options;

    // Validate execution options
    validateStarknetOptions(options.env, offline, privateKey, accountAddress);

    const provider = getStarknetProvider(chain);

    // Get InterchainTokenFactory address
    let tokenFactoryAddress = factoryAddress;
    if (!tokenFactoryAddress) {
        const factoryConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
        tokenFactoryAddress = factoryConfig.address;
        
        if (!tokenFactoryAddress) {
            throw new Error('InterchainTokenFactory contract not found in configuration. Please deploy it first or provide --factoryAddress option.');
        }
    }

    console.log(`\nRegistering Canonical Token:`);
    console.log(`- Token Address: ${tokenAddress}`);
    console.log(`- Factory Address: ${tokenFactoryAddress}`);

    // Build calldata for register_canonical_interchain_token
    const calldata = CallData.compile([
        tokenAddress, // token_address: ContractAddress
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for registering canonical token on ${chain.name}...`);
        
        const account = getStarknetAccount(privateKey!, accountAddress!, provider);
        const calls: Call[] = [{
            contractAddress: tokenFactoryAddress,
            entrypoint: 'register_canonical_interchain_token',
            calldata
        }];

        await estimateGasAndDisplayArgs(account, calls);
        return {}; // Return empty for estimation
    }

    // Handle offline mode
    if (offline) {
        console.log(`\nGenerating unsigned transaction for registering canonical token on ${chain.name}...`);
        const calls = [{
            contractAddress: tokenFactoryAddress,
            entrypoint: 'register_canonical_interchain_token',
            calldata: hexCalldata
        }];
        
        return handleOfflineTransaction(
            options,
            chain.name,
            calls,
            'register_canonical_token'
        );
    }

    // Execute the transaction
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);
    const tokenFactory = await getContractWithABI(provider, tokenFactoryAddress, account);

    // First, verify the token exists and get its details
    console.log('\nVerifying token...');
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
        const tokenContract = new Contract(tokenAbi, tokenAddress, provider);
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        const decimals = await tokenContract.decimals();
        const totalSupply = await tokenContract.totalSupply();
        
        console.log(`Token found: ${name} (${symbol})`);
        console.log(`Decimals: ${decimals}`);
        console.log(`Total Supply: ${totalSupply}`);
    } catch (error) {
        console.warn('Could not fetch token details:', error.message);
        console.log('Proceeding with registration...');
    }

    // Get the canonical token ID that will be generated
    console.log('\nCalculating canonical token ID...');
    try {
        const canonicalTokenId = await tokenFactory.canonical_interchain_token_id(tokenAddress);
        console.log('Expected Token ID:', canonicalTokenId);
    } catch (error) {
        console.log('Could not pre-calculate token ID');
    }

    console.log('\nExecuting register_canonical_interchain_token...');
    
    const tx = await tokenFactory.register_canonical_interchain_token(tokenAddress);

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');
    
    const receipt = await tx.wait();
    console.log('Transaction accepted in block:', receipt.block_number);

    // Parse events to get token_id
    // Look for TokenManagerDeployed event from ITS
    const deployedEvent = receipt.events?.find(event => {
        // Check if this might be a TokenManagerDeployed event
        const eventKey = event.keys[0];
        return eventKey && eventKey.includes('TokenManagerDeployed');
    });
    
    if (deployedEvent && deployedEvent.keys.length > 1) {
        const tokenId = deployedEvent.keys[1];
        console.log('\nCanonical token registered successfully!');
        console.log('Token ID:', tokenId);
        console.log('Token Manager Type: LockUnlock (canonical tokens use lock/unlock mechanism)');
    } else {
        console.log('\nTransaction completed. Canonical token should be registered.');
        console.log('Note: Canonical tokens use the LockUnlock token manager type.');
    }

    return tx.transaction_hash;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-register-canonical-token')
        .description('Register a canonical token for cross-chain use (uses lock/unlock mechanism)')
        .requiredOption('--tokenAddress <address>', 'Address of the canonical token to register')
        .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)');

    addStarknetOptions(program);

    program.action(async (options) => {
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        
        if (!chain) {
            throw new Error('Starknet configuration not found');
        }

        await processCommand(config, { ...chain, name: STARKNET_CHAIN }, options);
    });

    program.parse();
}

module.exports = {
    registerCanonicalToken: processCommand,
};
