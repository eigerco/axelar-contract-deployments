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
import { CallData, Call, Contract, uint256, num, CairoCustomEnum } from 'starknet';
import {
    Config,
    ChainConfig,
    GatewayCommandOptions,
    OfflineTransactionResult
} from '../types';

interface DeployRemoteCanonicalOptions extends GatewayCommandOptions {
    tokenAddress: string;
    destinationChain: string;
    gasValue: string;
    gasToken: 'STRK' | 'ETH';
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
    options: DeployRemoteCanonicalOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        tokenAddress,
        destinationChain,
        gasValue,
        gasToken,
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

    console.log(`\nDeploying Canonical Token on Remote Chain:`);
    console.log(`- Original Token Address: ${tokenAddress}`);
    console.log(`- Destination Chain: ${destinationChain}`);
    console.log(`- Gas Value: ${gasValue}`);
    console.log(`- Gas Token: ${gasToken} (only STRK is supported currently)`);
    console.log(`- Factory Address: ${tokenFactoryAddress}`);

    // Build calldata for deploy_remote_canonical_interchain_token
    const calldata = CallData.compile([
        tokenAddress, // original_token_address: ContractAddress
        destinationChain, // destination_chain: felt252
        uint256.bnToUint256(gasValue), // gas_value: u256
        gasToken === 'ETH' ? new CairoCustomEnum({ Eth: "" }) : new CairoCustomEnum({ Strk: "" }), // gas_token: GasToken enum
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for deploying canonical token on remote chain...`);

        const account = getStarknetAccount(privateKey!, accountAddress!, provider);
        const calls: Call[] = [{
            contractAddress: tokenFactoryAddress,
            entrypoint: 'deploy_remote_canonical_interchain_token',
            calldata
        }];

        await estimateGasAndDisplayArgs(account, calls);
        return {}; // Return empty for estimation
    }

    // Handle offline mode
    if (offline) {
        console.log(`\nGenerating unsigned transaction for deploying canonical token on remote chain...`);
        const calls = [{
            contractAddress: tokenFactoryAddress,
            entrypoint: 'deploy_remote_canonical_interchain_token',
            calldata: hexCalldata
        }];

        return handleOfflineTransaction(
            options,
            chain.name,
            calls,
            'deploy_remote_canonical_token'
        );
    }

    // Execute the transaction
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);
    const tokenFactory = await getContractWithABI(provider, tokenFactoryAddress, account);

    // First, verify the token exists and get its details
    console.log('\nVerifying original token...');
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

        console.log(`Original token: ${name} (${symbol}), decimals: ${decimals}`);
    } catch (error) {
        console.warn('Could not fetch token details:', error.message);
        console.log('Proceeding with deployment...');
    }

    // Get the canonical token ID
    console.log('\nGetting canonical token ID...');
    try {
        const canonicalTokenId = await tokenFactory.canonical_interchain_token_id(tokenAddress);
        console.log('Canonical Token ID:', canonicalTokenId);
    } catch (error) {
        console.log('Could not fetch canonical token ID');
    }

    console.log('\nExecuting deploy_remote_canonical_interchain_token...');

    const tx = await tokenFactory.deploy_remote_canonical_interchain_token(
        tokenAddress,
        destinationChain,
        uint256.bnToUint256(gasValue),
        gasToken === 'ETH' ? new CairoCustomEnum({ Eth: "" }) : new CairoCustomEnum({ Strk: "" })
    );

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');

    const receipt = await tx.wait();
    console.log('Transaction accepted in block:', receipt.block_number);

    // Parse events to understand what happened
    const eventCount = receipt.events?.length || 0;
    console.log(`\nTransaction completed with ${eventCount} events.`);

    console.log('\nRemote canonical token deployment initiated!');
    console.log('The token will be deployed on the destination chain with:');
    console.log('- Same token metadata (name, symbol, decimals)');
    console.log('- Lock/Unlock mechanism for cross-chain transfers');
    console.log('- Same canonical token ID across all chains');
    console.log('\nNote: Check the destination chain for deployment confirmation.');

    return tx.transaction_hash;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-deploy-remote-canonical-token')
        .description('Deploy a canonical token representation on a remote chain')
        .requiredOption('--tokenAddress <address>', 'Address of the original canonical token')
        .requiredOption('--destinationChain <chain>', 'Destination chain name')
        .requiredOption('--gasValue <value>', 'Gas value for cross-chain deployment')
        .option('--gasToken <token>', 'Gas token (only STRK is supported currently)', 'STRK')
        .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)')
        .addHelpText('after', `
Examples:
  Deploy canonical token using STRK for gas:
    $ deploy-remote-canonical-token --tokenAddress 0x123... --destinationChain ethereum --gasValue 1000000000000000000

  Offline mode (generate unsigned transaction):
    $ deploy-remote-canonical-token --tokenAddress 0x123... --destinationChain ethereum --gasValue 1000000000000000000 --offline

Note: 
  - Only STRK is currently supported as gas token
  - The canonical token will maintain the same token ID across all chains
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
    deployRemoteCanonicalToken: processCommand,
};
