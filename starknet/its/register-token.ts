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
import { CallData, Call, Contract, byteArray, num, CairoCustomEnum } from 'starknet';
import {
    Config,
    ChainConfig,
    GatewayCommandOptions,
    OfflineTransactionResult
} from '../types';

interface RegisterTokenOptions extends GatewayCommandOptions {
    salt: string;
    tokenAddress: string;
    tokenManagerType: string;
    operator?: string;
}

// Token Manager Types mapping for Cairo enum
const TOKEN_MANAGER_TYPES = {
    'native': 'NativeInterchainToken',
    'mintBurnFrom': 'MintBurnFrom',
    'lockUnlock': 'LockUnlock',
    'lockUnlockFee': 'LockUnlockFee',
    'mintBurn': 'MintBurn',
};

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

async function processCommand(
    config: Config,
    chain: ChainConfig & { name: string },
    options: RegisterTokenOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        salt,
        tokenAddress,
        tokenManagerType,
        operator,
        offline,
        estimate,
    } = options;

    // Validate execution options
    validateStarknetOptions(options.env, offline, privateKey, accountAddress);

    const provider = getStarknetProvider(chain);

    const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
    if (!itsConfig.address) {
        throw new Error('InterchainTokenService contract not found in configuration');
    }

    // Validate token manager type
    const tokenManagerTypeEnum = TOKEN_MANAGER_TYPES[tokenManagerType];
    if (tokenManagerTypeEnum === undefined) {
        throw new Error(`Invalid token manager type: ${tokenManagerType}. Valid types are: ${Object.keys(TOKEN_MANAGER_TYPES).join(', ')}`);
    }

    console.log(`\nRegistering Custom Token:`);
    console.log(`- Salt: ${salt}`);
    console.log(`- Token Address: ${tokenAddress}`);
    console.log(`- Token Manager Type: ${tokenManagerType} (${tokenManagerTypeEnum})`);
    console.log(`- Operator: ${operator || 'current account'}`);

    // Get the account address for operator if not provided
    let operatorAddress = operator;
    if (!operatorAddress && (privateKey || accountAddress)) {
        if (accountAddress) {
            operatorAddress = accountAddress;
        } else if (privateKey) {
            const account = getStarknetAccount(privateKey, accountAddress!, provider);
            operatorAddress = account.address;
        }
        console.log(`- Using account address as operator: ${operatorAddress}`);
    }

    // Build calldata for register_custom_token
    const calldata = CallData.compile([
        salt, // salt: felt252
        tokenAddress, // token_address: ContractAddress
        new CairoCustomEnum({ [tokenManagerTypeEnum]: {} }), // token_manager_type: TokenManagerType enum
        operatorAddress ? byteArray.byteArrayFromString(operatorAddress) : [], // link_params: ByteArray (operator address, empty if not provided)
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for registering custom token on ${chain.name}...`);
        
        const account = getStarknetAccount(privateKey!, accountAddress!, provider);
        const calls: Call[] = [{
            contractAddress: itsConfig.address,
            entrypoint: 'register_custom_token',
            calldata
        }];

        await estimateGasAndDisplayArgs(account, calls);
        return {}; // Return empty for estimation
    }

    // Handle offline mode
    if (offline) {
        console.log(`\nGenerating unsigned transaction for registering custom token on ${chain.name}...`);
        const calls = [{
            contractAddress: itsConfig.address,
            entrypoint: 'register_custom_token',
            calldata: hexCalldata
        }];
        
        return handleOfflineTransaction(
            options,
            chain.name,
            calls,
            'register_custom_token'
        );
    }

    // Execute the transaction
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);
    const itsContract = await getITSContract(provider, itsConfig.address, account);

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
            }
        ];
        const tokenContract = new Contract(tokenAbi, tokenAddress, provider);
        const name = await tokenContract.name();
        const symbol = await tokenContract.symbol();
        const decimals = await tokenContract.decimals();
        
        console.log(`Token found: ${name} (${symbol}), decimals: ${decimals}`);
    } catch (error) {
        console.warn('Could not fetch token details:', error.message);
        console.log('Proceeding with registration...');
    }

    console.log('\nExecuting register_custom_token...');
    
    const tx = await itsContract.register_custom_token(
        salt,
        tokenAddress,
        new CairoCustomEnum({ [tokenManagerTypeEnum]: {} }),
        operatorAddress || ''
    );

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');
    
    const receipt = await tx.wait();
    console.log('Transaction accepted in block:', receipt.block_number);

    // Parse TokenManagerDeployed event to get token_id
    const deployedEvent = receipt.events?.find(event => 
        event.keys[0] === num.toHex(num.getDecimalString('TokenManagerDeployed'))
    );
    
    if (deployedEvent) {
        // The token_id is the first key after the event selector
        const tokenId = deployedEvent.keys[1];
        console.log('\nToken registered successfully!');
        console.log('Token ID:', tokenId);
        console.log('Token Manager Type:', deployedEvent.keys[2]);
    } else {
        console.log('\nTransaction completed. Token should be registered.');
    }

    return tx.transaction_hash;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-register-token')
        .description('Register an existing token for cross-chain use')
        .requiredOption('--salt <salt>', 'Salt for token registration')
        .requiredOption('--tokenAddress <address>', 'Address of the existing token')
        .requiredOption('--tokenManagerType <type>', 'Token manager type (native, mintBurnFrom, lockUnlock, lockUnlockFee, mintBurn)')
        .option('--operator <address>', 'Operator address (defaults to current account)');

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
    registerCustomToken: processCommand,
};
