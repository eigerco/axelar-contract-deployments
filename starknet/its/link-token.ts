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
import { CallData, Call, Contract, uint256, byteArray, num, CairoCustomEnum } from 'starknet';
import {
    Config,
    ChainConfig,
    GatewayCommandOptions,
    OfflineTransactionResult
} from '../types';

interface LinkTokenOptions extends GatewayCommandOptions {
    salt: string;
    destinationChain: string;
    destinationTokenAddress: string;
    tokenManagerType: string;
    operator?: string;
    gasValue: string;
    gasToken: 'STRK' | 'ETH';
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
    options: LinkTokenOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        salt,
        destinationChain,
        destinationTokenAddress,
        tokenManagerType,
        operator,
        gasValue,
        gasToken,
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

    console.log(`\nLinking Token:`);
    console.log(`- Salt: ${salt}`);
    console.log(`- Destination Chain: ${destinationChain}`);
    console.log(`- Destination Token Address: ${destinationTokenAddress}`);
    console.log(`- Token Manager Type: ${tokenManagerType} (${tokenManagerTypeEnum})`);
    console.log(`- Operator: ${operator || 'current account'}`);
    console.log(`- Gas Value: ${gasValue}`);
    console.log(`- Gas Token: ${gasToken} (only STRK is supported currently)`);

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

    // Build calldata for link_token
    const calldata = CallData.compile([
        salt, // salt: felt252
        destinationChain, // destination_chain: felt252
        byteArray.byteArrayFromString(destinationTokenAddress), // destination_token_address: ByteArray
        new CairoCustomEnum({ [tokenManagerTypeEnum]: {} }), // token_manager_type: TokenManagerType enum
        operatorAddress ? byteArray.byteArrayFromString(operatorAddress) : [], // link_params: ByteArray (operator address, empty if not provided)
        uint256.bnToUint256(gasValue), // gas_value: u256
        gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} }), // gas_token: GasToken enum
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for linking token on ${chain.name}...`);

        const account = getStarknetAccount(privateKey!, accountAddress!, provider);
        const calls: Call[] = [{
            contractAddress: itsConfig.address,
            entrypoint: 'link_token',
            calldata
        }];

        await estimateGasAndDisplayArgs(account, calls);
        return {}; // Return empty for estimation
    }

    // Handle offline mode
    if (offline) {
        console.log(`\nGenerating unsigned transaction for linking token on ${chain.name}...`);
        const calls = [{
            contractAddress: itsConfig.address,
            entrypoint: 'link_token',
            calldata: hexCalldata
        }];

        return handleOfflineTransaction(
            options,
            chain.name,
            calls,
            'link_token'
        );
    }

    // Execute the transaction
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);
    const itsContract = await getITSContract(provider, itsConfig.address, account);

    // First, calculate the token ID and check if token manager exists locally
    console.log('\nCalculating token ID...');
    try {
        const tokenId = await itsContract.interchain_token_id(account.address, salt);
        console.log('Token ID:', tokenId);

        // Check if token manager exists
        const tokenManagerAddress = await itsContract.token_manager_address(tokenId);
        console.log('Local Token Manager Address:', tokenManagerAddress);

        // Try to get the registered token address
        try {
            const tokenAddress = await itsContract.registered_token_address(tokenId);
            console.log('Local Token Address:', tokenAddress);
        } catch (error) {
            console.log('No local token registered yet. This may be a remote-only link.');
        }
    } catch (error) {
        console.warn('Could not verify local token setup:', error.message);
    }

    console.log('\nExecuting link_token...');

    const tx = await itsContract.link_token(
        salt,
        destinationChain,
        destinationTokenAddress,
        new CairoCustomEnum({ [tokenManagerTypeEnum]: {} }),
        operatorAddress || '',
        uint256.bnToUint256(gasValue),
        gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
    );

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');

    const receipt = await tx.wait();
    console.log('Transaction accepted in block:', receipt.block_number);

    // Parse LinkTokenStarted event
    const linkEvent = receipt.events?.find(event =>
        event.keys[0] === num.toHex(num.getDecimalString('LinkTokenStarted'))
    );

    if (linkEvent) {
        console.log('\nToken linking initiated successfully!');
        if (linkEvent.keys.length > 1) {
            console.log('Token ID:', linkEvent.keys[1]);
        }
    } else {
        console.log('\nTransaction completed. Token should be linked on the destination chain.');
    }

    console.log('\nNote: The token will be linked on the destination chain with:');
    console.log(`- Token Manager Type: ${tokenManagerType}`);
    console.log(`- Operator: ${operatorAddress || 'default'}`);

    return tx.transaction_hash;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-link-token')
        .description('Link a token across chains using InterchainTokenService')
        .requiredOption('--salt <salt>', 'Salt used for token registration')
        .requiredOption('--destinationChain <chain>', 'Destination chain name')
        .requiredOption('--destinationTokenAddress <address>', 'Token address on destination chain')
        .requiredOption('--tokenManagerType <type>', 'Token manager type (native, mintBurnFrom, lockUnlock, lockUnlockFee, mintBurn)')
        .option('--operator <address>', 'Operator address for the linked token (defaults to current account)')
        .requiredOption('--gasValue <value>', 'Gas value for cross-chain linking')
        .option('--gasToken <token>', 'Gas token (only STRK is supported currently)', 'STRK')
        .addHelpText('after', `
Examples:
  Link token using STRK for gas:
    $ link-token --salt my-salt --destinationChain polygon --destinationTokenAddress 0x... --tokenManagerType lockUnlock --gasValue 1000000000000000000

  Link token with custom operator:
    $ link-token --salt my-salt --destinationChain polygon --destinationTokenAddress 0x... --tokenManagerType mintBurn --operator 0x123... --gasValue 1000000000000000000

  Offline mode (generate unsigned transaction):
    $ link-token --salt my-salt --destinationChain polygon --destinationTokenAddress 0x... --tokenManagerType lockUnlock --gasValue 1000000000000000000 --offline

Note: 
  - Only STRK is currently supported as gas token
  - The salt should match the one used during token registration
  - Token manager types: native, mintBurnFrom, lockUnlock, lockUnlockFee, mintBurn
  - Gas value should be specified in Wei (18 decimals)`);

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
    linkToken: processCommand,
};
