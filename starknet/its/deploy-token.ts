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

interface DeployTokenOptions extends GatewayCommandOptions {
    salt: string;
    destinationChain?: string;
    name: string;
    symbol: string;
    decimals: string;
    minter?: string;
    gasValue: string;
    gasToken: 'STRK' | 'ETH';
}

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
    options: DeployTokenOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        salt,
        destinationChain,
        name,
        symbol,
        decimals,
        minter,
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

    console.log(`\nDeploying Interchain Token:`);
    console.log(`- Name: ${name}`);
    console.log(`- Symbol: ${symbol}`);
    console.log(`- Decimals: ${decimals}`);
    console.log(`- Salt: ${salt}`);
    console.log(`- Destination Chain: ${destinationChain || 'local'}`);
    console.log(`- Minter: ${minter || 'current account'}`);
    console.log(`- Gas Value: ${gasValue}`);
    console.log(`- Gas Token: ${gasToken} (Note: Only STRK is currently supported)`);

    // Get the account address for minter if not provided
    let minterAddress = minter;
    if (!minterAddress && (privateKey || accountAddress)) {
        if (accountAddress) {
            minterAddress = accountAddress;
        } else if (privateKey) {
            const account = getStarknetAccount(privateKey, accountAddress!, provider);
            minterAddress = account.address;
        }
        console.log(`- Using account address as minter: ${minterAddress}`);
    }

    // Build calldata for deploy_interchain_token
    const calldata = CallData.compile([
        salt, // salt: felt252
        destinationChain || '0', // destination_chain: felt252 (0 for local deployment)
        byteArray.byteArrayFromString(name), // name: ByteArray
        byteArray.byteArrayFromString(symbol), // symbol: ByteArray
        decimals, // decimals: u8
        byteArray.byteArrayFromString(minterAddress || ''), // minter: ByteArray
        uint256.bnToUint256(gasValue), // gas_value: u256
        0, // gas_token: GasToken enum - Always use STRK (0) for now
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for deploying interchain token on ${chain.name}...`);

        const account = getStarknetAccount(privateKey!, accountAddress!, provider);
        const calls: Call[] = [{
            contractAddress: itsConfig.address,
            entrypoint: 'deploy_interchain_token',
            calldata
        }];

        await estimateGasAndDisplayArgs(account, calls);
        return {}; // Return empty for estimation
    }

    // Handle offline mode
    if (offline) {
        console.log(`\nGenerating unsigned transaction for deploying interchain token on ${chain.name}...`);
        const calls = [{
            contractAddress: itsConfig.address,
            entrypoint: 'deploy_interchain_token',
            calldata: hexCalldata
        }];

        return handleOfflineTransaction(
            options,
            chain.name,
            calls,
            'deploy_interchain_token'
        );
    }

    // Execute the transaction
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);
    const itsContract = await getITSContract(provider, itsConfig.address, account);

    console.log('\nExecuting deploy_interchain_token...');

    const tx = await itsContract.deploy_interchain_token(
        salt,
        destinationChain || '0',
        name,
        symbol,
        decimals,
        minterAddress || '',
        uint256.bnToUint256(gasValue),
        new CairoCustomEnum({ Strk: "" })  // Only STRK supported
    );

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');

    const receipt = await tx.wait();
    console.log('Transaction accepted in block:', receipt.block_number);

    // Parse InterchainTokenDeployed event to get token_id
    const deployedEvent = receipt.events?.find(event =>
        event.keys[0] === num.toHex(num.getDecimalString('InterchainTokenDeployed'))
    );

    if (deployedEvent) {
        // The token_id is the first key after the event selector
        const tokenId = deployedEvent.keys[1];
        console.log('\nInterchain token deployed successfully!');
        console.log('Token ID:', tokenId);
    } else {
        console.log('\nTransaction completed but could not parse token ID from events.');
    }

    return tx.transaction_hash;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-deploy-token')
        .description('Deploy a new interchain token on Starknet')
        .requiredOption('--salt <salt>', 'Salt for token deployment')
        .option('--destinationChain <chain>', 'Destination chain name (optional, defaults to local deployment)')
        .requiredOption('--name <name>', 'Token name')
        .requiredOption('--symbol <symbol>', 'Token symbol')
        .requiredOption('--decimals <decimals>', 'Token decimals')
        .option('--minter <address>', 'Minter address (defaults to current account)')
        .requiredOption('--gasValue <value>', 'Gas value for cross-chain deployment')
        .requiredOption('--gasToken <token>', 'Gas token (currently only STRK is supported)', 'STRK');

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
    deployInterchainToken: processCommand,
};
