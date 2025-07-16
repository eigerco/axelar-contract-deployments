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

interface DeployTokenOptions extends GatewayCommandOptions {
    salt: string;
    destinationChain?: string;
    name: string;
    symbol: string;
    decimals: string;
    minter?: string;
    initialSupply?: string;
    gasValue?: string;
    gasToken?: 'STRK' | 'ETH';
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
        initialSupply = '0',
        gasValue,
        gasToken,
        offline,
        estimate,
    } = options;

    // Validate execution options
    validateStarknetOptions(options.env, offline, privateKey, accountAddress);

    const provider = getStarknetProvider(chain);

    const itfConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
    if (!itfConfig.address) {
        throw new Error('InterchainTokenFactory contract not found in configuration. Please deploy ITF first.');
    }

    // Validate and set minter based on initial supply
    let minterAddress: string;

    if (initialSupply === '0') {
        // When initial supply is 0, a minter address is required
        if (!minter) {
            throw new Error('Minter address is required when initial supply is 0');
        }
        minterAddress = minter;
    } else {
        // When initial supply > 0, the contract sets minter to contract address
        // So we pass 0x0 and the contract will handle it
        minterAddress = '0x0';
    }

    console.log(`\nDeploying Interchain Token via Factory:`);
    console.log(`- Name: ${name}`);
    console.log(`- Symbol: ${symbol}`);
    console.log(`- Decimals: ${decimals}`);
    console.log(`- Salt: ${salt}`);
    console.log(`- Initial Supply: ${initialSupply}`);
    if (initialSupply === '0') {
        console.log(`- Minter: ${minterAddress}`);
    } else {
        console.log(`- Minter: Contract will set to token contract address (initial supply > 0)`);
    }
    if (destinationChain) {
        console.log(`- Note: Factory only supports local deployment. Cross-chain deployment requires separate command.`);
    }

    // Build calldata for deploy_interchain_token on factory
    const calldata = CallData.compile([
        salt, // salt: felt252
        byteArray.byteArrayFromString(name), // name: ByteArray
        byteArray.byteArrayFromString(symbol), // symbol: ByteArray
        decimals, // decimals: u8
        uint256.bnToUint256(initialSupply), // initial_supply: u256
        minterAddress, // minter: ContractAddress
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for deploying interchain token on ${chain.name}...`);

        const account = getStarknetAccount(privateKey!, accountAddress!, provider);
        const calls: Call[] = [{
            contractAddress: itfConfig.address,
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
            contractAddress: itfConfig.address,
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
    const itfContract = await getContractWithABI(provider, itfConfig.address, account);

    console.log('\nExecuting deploy_interchain_token on factory...');

    const tx = await itfContract.deploy_interchain_token(
        salt,
        name,
        symbol,
        decimals,
        uint256.bnToUint256(initialSupply),
        minterAddress
    );

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');

    const receipt = await tx.wait();
    console.log('Transaction accepted in block:', receipt.block_number);

    // The factory's deploy_interchain_token returns the token_id directly
    console.log('\nInterchain token deployed successfully via factory!');
    console.log('Note: Check transaction receipt for token ID in the return value or events.');

    return tx.transaction_hash;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-deploy-token')
        .description('Deploy a new interchain token on Starknet via InterchainTokenFactory')
        .requiredOption('--salt <salt>', 'Salt for token deployment')
        .requiredOption('--name <name>', 'Token name')
        .requiredOption('--symbol <symbol>', 'Token symbol')
        .requiredOption('--decimals <decimals>', 'Token decimals')
        .option('--initialSupply <amount>', 'Initial supply to mint (defaults to 0)')
        .option('--minter <address>', 'Minter address (if initial supply > 0, mintership will be transferred to this address)')
        .addHelpText('after', `
Note: This command deploys tokens locally via the InterchainTokenFactory.
- If initialSupply > 0, tokens will be minted to the deployer and mintership transferred to the minter
- If initialSupply = 0, the minter address will be set directly
- For cross-chain deployment, use a separate command after local deployment`);

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
