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

interface ManageServiceOptions extends GatewayCommandOptions {
    action: 'pause' | 'unpause' | 'transfer-ownership' | 'set-factory' | 'check-status';
    newOwner?: string;
    factoryAddress?: string;
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
    options: ManageServiceOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        action,
        newOwner,
        factoryAddress,
        offline,
        estimate,
    } = options;

    const provider = getStarknetProvider(chain);

    const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
    if (!itsConfig.address) {
        throw new Error('InterchainTokenService contract not found in configuration');
    }

    console.log(`\nManaging InterchainTokenService:`);
    console.log(`- Action: ${action}`);

    // For check-status action, we don't need authentication
    if (action === 'check-status') {
        const itsContract = await getITSContract(provider, itsConfig.address);
        
        console.log('\nChecking service status...');
        
        try {
            // Check if paused
            const pausedAbi = [
                {
                    "name": "is_paused",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{ "type": "core::bool" }],
                    "state_mutability": "view"
                }
            ];
            const pausedContract = new Contract(pausedAbi, itsConfig.address, provider);
            const isPaused = await pausedContract.is_paused();
            console.log(`\nService is ${isPaused ? 'PAUSED' : 'ACTIVE'}`);
        } catch (error) {
            console.log('Could not check pause status');
        }

        try {
            // Check owner
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
            console.log(`Owner: ${owner}`);
        } catch (error) {
            console.log('Could not check owner');
        }

        try {
            // Check chain name
            const chainName = await itsContract.chain_name();
            console.log(`Chain Name: ${chainName}`);
        } catch (error) {
            console.log('Could not check chain name');
        }

        return {};
    }

    // For other actions, we need authentication
    validateStarknetOptions(options.env, offline, privateKey, accountAddress);

    let entrypoint: string;
    let calldata: any[];

    switch (action) {
        case 'pause':
            entrypoint = 'set_pause_status';
            calldata = CallData.compile([true]); // paused: bool
            break;
        case 'unpause':
            entrypoint = 'set_pause_status';
            calldata = CallData.compile([false]); // paused: bool
            break;
        case 'transfer-ownership':
            if (!newOwner) {
                throw new Error('New owner address is required for transfer-ownership action');
            }
            entrypoint = 'transfer_ownership';
            calldata = CallData.compile([newOwner]); // new_owner: ContractAddress
            console.log(`- New Owner: ${newOwner}`);
            break;
        case 'set-factory':
            if (!factoryAddress) {
                throw new Error('Factory address is required for set-factory action');
            }
            entrypoint = 'set_factory_address';
            calldata = CallData.compile([factoryAddress]); // factory_address: ContractAddress
            console.log(`- Factory Address: ${factoryAddress}`);
            break;
        default:
            throw new Error(`Invalid action: ${action}`);
    }

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for ${action} on ${chain.name}...`);
        
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
        console.log(`\nGenerating unsigned transaction for ${action} on ${chain.name}...`);
        const calls = [{
            contractAddress: itsConfig.address,
            entrypoint: entrypoint,
            calldata: hexCalldata
        }];
        
        return handleOfflineTransaction(
            options,
            chain.name,
            calls,
            action.replace('-', '_')
        );
    }

    // Execute the transaction
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);
    const itsContract = await getITSContract(provider, itsConfig.address, account);

    // Check if we're the owner (for actions that require ownership)
    if (['pause', 'unpause', 'transfer-ownership', 'set-factory'].includes(action)) {
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
            console.log('Current owner:', owner);
            
            if (owner !== account.address) {
                console.warn(`Warning: Current account (${account.address}) is not the owner.`);
                console.warn('This transaction may fail if only the owner can perform this action.');
            }
        } catch (error) {
            console.log('Could not verify ownership. Proceeding...');
        }
    }

    console.log(`\nExecuting ${entrypoint}...`);
    
    let tx;
    switch (action) {
        case 'pause':
            tx = await itsContract.set_pause_status(true);
            break;
        case 'unpause':
            tx = await itsContract.set_pause_status(false);
            break;
        case 'transfer-ownership':
            tx = await itsContract.transfer_ownership(newOwner);
            break;
        case 'set-factory':
            tx = await itsContract.set_factory_address(factoryAddress);
            break;
    }

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');
    
    const receipt = await tx.wait();
    console.log('Transaction accepted in block:', receipt.block_number);

    // Provide feedback based on action
    switch (action) {
        case 'pause':
            console.log('\nInterchainTokenService has been PAUSED.');
            console.log('No new transfers or deployments will be allowed until unpaused.');
            break;
        case 'unpause':
            console.log('\nInterchainTokenService has been UNPAUSED.');
            console.log('Normal operations have resumed.');
            break;
        case 'transfer-ownership':
            console.log(`\nOwnership transfer initiated to: ${newOwner}`);
            console.log('Note: The new owner may need to accept ownership depending on implementation.');
            break;
        case 'set-factory':
            console.log(`\nInterchainTokenFactory address set to: ${factoryAddress}`);
            console.log('The factory can now deploy tokens through ITS.');
            break;
    }

    return tx.transaction_hash;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-manage-service')
        .description('Manage InterchainTokenService settings and status')
        .requiredOption('--action <action>', 'Action to perform (pause, unpause, transfer-ownership, set-factory, check-status)')
        .option('--newOwner <address>', 'New owner address (required for transfer-ownership)')
        .option('--factoryAddress <address>', 'Factory address (required for set-factory)')
        .addHelpText('after', `
Examples:
  Pause the service:
    $ its-manage-service --action pause

  Unpause the service:
    $ its-manage-service --action unpause

  Transfer ownership:
    $ its-manage-service --action transfer-ownership --newOwner 0x123...

  Set factory address:
    $ its-manage-service --action set-factory --factoryAddress 0x456...

  Check service status:
    $ its-manage-service --action check-status

Note: Most actions require owner privileges.
The 'check-status' action can be performed by anyone.`);

    addStarknetOptions(program);

    program.action(async (options) => {
        // Validate action
        const validActions = ['pause', 'unpause', 'transfer-ownership', 'set-factory', 'check-status'];
        if (!validActions.includes(options.action)) {
            throw new Error(`Action must be one of: ${validActions.join(', ')}`);
        }

        // Validate required parameters
        if (options.action === 'transfer-ownership' && !options.newOwner) {
            throw new Error('--newOwner is required for transfer-ownership action');
        }
        if (options.action === 'set-factory' && !options.factoryAddress) {
            throw new Error('--factoryAddress is required for set-factory action');
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
    manageService: processCommand,
};
