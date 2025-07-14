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

interface FlowLimitsOptions extends GatewayCommandOptions {
    tokenIds: string;
    flowLimits: string;
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

/**
 * Parse comma-separated token IDs and convert to uint256 format
 */
function parseTokenIds(tokenIdsStr: string): any[] {
    const tokenIds = tokenIdsStr.split(',').map(id => id.trim());
    return tokenIds.map(tokenId => {
        if (tokenId.startsWith('0x')) {
            return uint256.bnToUint256(tokenId);
        } else {
            return uint256.bnToUint256('0x' + tokenId);
        }
    });
}

/**
 * Parse comma-separated flow limits and convert to uint256 format
 */
function parseFlowLimits(flowLimitsStr: string): any[] {
    const limits = flowLimitsStr.split(',').map(limit => limit.trim());
    return limits.map(limit => uint256.bnToUint256(limit));
}

async function processCommand(
    config: Config,
    chain: ChainConfig & { name: string },
    options: FlowLimitsOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        tokenIds,
        flowLimits,
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

    // Parse token IDs and flow limits
    const parsedTokenIds = parseTokenIds(tokenIds);
    const parsedFlowLimits = parseFlowLimits(flowLimits);

    // Validate arrays have same length
    if (parsedTokenIds.length !== parsedFlowLimits.length) {
        throw new Error(`Token IDs count (${parsedTokenIds.length}) must match flow limits count (${parsedFlowLimits.length})`);
    }

    console.log(`\nSetting Flow Limits:`);
    console.log(`- Number of tokens: ${parsedTokenIds.length}`);
    
    // Display each token ID and its corresponding flow limit
    const tokenIdStrings = tokenIds.split(',').map(id => id.trim());
    const flowLimitStrings = flowLimits.split(',').map(limit => limit.trim());
    
    for (let i = 0; i < tokenIdStrings.length; i++) {
        console.log(`\nToken ${i + 1}:`);
        console.log(`  - Token ID: ${tokenIdStrings[i]}`);
        console.log(`  - Flow Limit: ${flowLimitStrings[i]}`);
    }

    // Build calldata for set_flow_limits
    // The function expects: token_ids: Array<u256>, flow_limits: Array<u256>
    const calldata = CallData.compile([
        parsedTokenIds, // token_ids: Array<u256>
        parsedFlowLimits, // flow_limits: Array<u256>
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for setting flow limits on ${chain.name}...`);
        
        const account = getStarknetAccount(privateKey!, accountAddress!, provider);
        const calls: Call[] = [{
            contractAddress: itsConfig.address,
            entrypoint: 'set_flow_limits',
            calldata
        }];

        await estimateGasAndDisplayArgs(account, calls);
        return {}; // Return empty for estimation
    }

    // Handle offline mode
    if (offline) {
        console.log(`\nGenerating unsigned transaction for setting flow limits on ${chain.name}...`);
        const calls = [{
            contractAddress: itsConfig.address,
            entrypoint: 'set_flow_limits',
            calldata: hexCalldata
        }];
        
        return handleOfflineTransaction(
            options,
            chain.name,
            calls,
            'set_flow_limits'
        );
    }

    // Execute the transaction
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);
    const itsContract = await getITSContract(provider, itsConfig.address, account);

    // Optionally verify token managers exist for the given token IDs
    console.log('\nVerifying token managers...');
    for (let i = 0; i < parsedTokenIds.length; i++) {
        try {
            const tokenManagerAddress = await itsContract.token_manager_address(parsedTokenIds[i]);
            console.log(`Token ${i + 1} - Token Manager: ${tokenManagerAddress}`);
        } catch (error) {
            console.warn(`Token ${i + 1} - Could not verify token manager: ${error.message}`);
        }
    }

    console.log('\nExecuting set_flow_limits...');
    
    const tx = await itsContract.set_flow_limits(
        parsedTokenIds,
        parsedFlowLimits
    );

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');
    
    const receipt = await tx.wait();
    console.log('Transaction accepted in block:', receipt.block_number);

    console.log('\nFlow limits set successfully!');
    console.log('Note: Flow limits help prevent excessive token movements and protect against potential exploits.');
    console.log('The limits apply to both incoming and outgoing transfers for each token.');

    return tx.transaction_hash;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-flow-limits')
        .description('Set flow limits for multiple tokens in InterchainTokenService')
        .requiredOption('--tokenIds <ids>', 'Comma-separated list of token IDs (hex strings)')
        .requiredOption('--flowLimits <limits>', 'Comma-separated list of flow limits (in smallest unit)')
        .addHelpText('after', `
Examples:
  Set flow limit for a single token:
    $ its-flow-limits --tokenIds 0x123...abc --flowLimits 1000000

  Set flow limits for multiple tokens:
    $ its-flow-limits --tokenIds 0x123...abc,0x456...def,0x789...ghi --flowLimits 1000000,2000000,500000

Note: The number of token IDs must match the number of flow limits.
Flow limits are specified in the smallest unit of the token (e.g., wei for 18 decimal tokens).`);

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
    setFlowLimits: processCommand,
};
