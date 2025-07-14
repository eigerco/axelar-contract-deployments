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

interface ManageChainsOptions extends GatewayCommandOptions {
    action: 'add' | 'remove' | 'check';
    chainName: string;
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
    options: ManageChainsOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        action,
        chainName,
        offline,
        estimate,
    } = options;

    const provider = getStarknetProvider(chain);

    const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
    if (!itsConfig.address) {
        throw new Error('InterchainTokenService contract not found in configuration');
    }

    console.log(`\nManaging Trusted Chains:`);
    console.log(`- Action: ${action}`);
    console.log(`- Chain Name: ${chainName}`);

    // For check action, we don't need authentication
    if (action === 'check') {
        const itsContract = await getITSContract(provider, itsConfig.address);
        
        console.log('\nChecking if chain is trusted...');
        const isTrusted = await itsContract.is_trusted_chain(chainName);
        
        console.log(`\nChain "${chainName}" is ${isTrusted ? 'TRUSTED' : 'NOT TRUSTED'}`);
        return { isTrusted };
    }

    // For add/remove actions, we need authentication
    validateStarknetOptions(options.env, offline, privateKey, accountAddress);

    let entrypoint: string;
    if (action === 'add') {
        entrypoint = 'set_trusted_chain';
    } else if (action === 'remove') {
        entrypoint = 'remove_trusted_chain';
    } else {
        throw new Error(`Invalid action: ${action}`);
    }

    // Build calldata
    const calldata = CallData.compile([
        chainName, // chain_name: felt252
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for ${action}ing trusted chain on ${chain.name}...`);
        
        const account = getStarknetAccount(privateKey!, accountAddress!, provider);
        const calls: Call[] = [{
            contractAddress: itsConfig.address,
            entrypoint,
            calldata
        }];

        await estimateGasAndDisplayArgs(account, calls);
        return {}; // Return empty for estimation
    }

    // Handle offline mode
    if (offline) {
        console.log(`\nGenerating unsigned transaction for ${action}ing trusted chain on ${chain.name}...`);
        const calls = [{
            contractAddress: itsConfig.address,
            entrypoint: entrypoint,
            calldata: hexCalldata
        }];
        
        return handleOfflineTransaction(
            options,
            chain.name,
            calls,
            `${action}_trusted_chain`
        );
    }

    // Execute the transaction
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);
    const itsContract = await getITSContract(provider, itsConfig.address, account);

    // Check if we're the owner
    console.log('\nVerifying ownership...');
    try {
        const ownerAbi = [
            {
                "name": "owner",
                "type": "function",
                "inputs": [],
                "outputs": [{ "type": "core::starknet::contract_address::ContractAddress" }],
                "state_mutability": "view"
            }
        ];
        const ownerContract = new Contract(ownerAbi, itsConfig.address, provider);
        const owner = await ownerContract.owner();
        console.log('Contract owner:', owner);
        
        if (owner !== account.address) {
            console.warn(`Warning: Current account (${account.address}) is not the owner.`);
            console.warn('This transaction may fail if only the owner can manage trusted chains.');
        }
    } catch (error) {
        console.log('Could not verify ownership. Proceeding...');
    }

    // Check current status before making changes
    console.log('\nChecking current status...');
    const currentStatus = await itsContract.is_trusted_chain(chainName);
    console.log(`Chain "${chainName}" is currently ${currentStatus ? 'TRUSTED' : 'NOT TRUSTED'}`);

    if (action === 'add' && currentStatus) {
        console.log('\nChain is already trusted. No action needed.');
        return {};
    }

    if (action === 'remove' && !currentStatus) {
        console.log('\nChain is already not trusted. No action needed.');
        return {};
    }

    console.log(`\nExecuting ${entrypoint}...`);
    
    const tx = await itsContract[entrypoint](chainName);

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');
    
    const receipt = await tx.wait();
    console.log('Transaction accepted in block:', receipt.block_number);

    // Verify the change
    console.log('\nVerifying the change...');
    const newStatus = await itsContract.is_trusted_chain(chainName);
    
    if (action === 'add' && newStatus) {
        console.log(`\nSuccess! Chain "${chainName}" is now TRUSTED.`);
    } else if (action === 'remove' && !newStatus) {
        console.log(`\nSuccess! Chain "${chainName}" is now NOT TRUSTED.`);
    } else {
        console.log(`\nWarning: Operation completed but chain status may not have changed as expected.`);
        console.log(`Current status: ${newStatus ? 'TRUSTED' : 'NOT TRUSTED'}`);
    }

    return tx.transaction_hash;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-manage-chains')
        .description('Manage trusted chains in InterchainTokenService')
        .requiredOption('--action <action>', 'Action to perform (add, remove, check)')
        .requiredOption('--chainName <name>', 'Name of the chain to manage')
        .addHelpText('after', `
Examples:
  Add a trusted chain:
    $ its-manage-chains --action add --chainName ethereum

  Remove a trusted chain:
    $ its-manage-chains --action remove --chainName polygon

  Check if a chain is trusted:
    $ its-manage-chains --action check --chainName avalanche

Note: Only the contract owner can add or remove trusted chains.
The 'check' action can be performed by anyone.`);

    addStarknetOptions(program);

    program.action(async (options) => {
        // Validate action
        if (!['add', 'remove', 'check'].includes(options.action)) {
            throw new Error('Action must be one of: add, remove, check');
        }

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
    manageTrustedChains: processCommand,
};
