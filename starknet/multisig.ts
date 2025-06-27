import { Command } from 'commander';
import {
    CallData,
    Contract,
    Call,
    num,
    encode,
} from 'starknet';
import { loadConfig } from '../common';
import { addStarknetOptions } from './cli-utils';
import {
    getStarknetProvider,
    getStarknetAccount,
    handleOfflineTransaction,
    validateStarknetOptions,
    estimateGasAndDisplayArgs
} from './utils';
import {
    ChainConfig,
    StarknetCommandOptions,
    OfflineTransactionResult
} from './types';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { StarknetClient } from '@ledgerhq/hw-app-starknet';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';

// Enum for signer types matching Cairo contract
enum SignerType {
    Starknet = 0,
    Secp256k1 = 1,
    Secp256r1 = 2,
    Eip191 = 3,
    Webauthn = 4
}

// Map string signer type to enum
function getSignerTypeValue(signerType: string): number {
    const type = signerType.toLowerCase();
    switch (type) {
        case 'starknet':
            return SignerType.Starknet;
        case 'secp256k1':
            return SignerType.Secp256k1;
        case 'secp256r1':
            return SignerType.Secp256r1;
        case 'eip191':
            return SignerType.Eip191;
        case 'webauthn':
            return SignerType.Webauthn;
        default:
            throw new Error(`Unknown signer type: ${type}`);
    }
}

// Interface for command options
interface MultisigCommandOptions extends StarknetCommandOptions {
    contractAddress: string;
    ledgerPath?: string;
    threshold?: number;
    signer?: string;
    signers?: string;
    signerToRemove?: string;
    signerToAdd?: string;
    signerType?: string;
    isEnabled?: boolean;
    securityPeriod?: string;
    expiryPeriod?: string;
    guardian?: string;
    selector?: string;
    calldata?: string;
}


/**
 * Prepare multisig options - set account address and validate
 */
function prepareMultisigOptions(options: MultisigCommandOptions): void {
    // For multisig, account address is the contract address
    if (!options.accountAddress) {
        options.accountAddress = options.contractAddress;
    }

    // Skip private key validation for estimation
    if (!options.estimate) {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
    }
}

/**
 * Common function to handle gas estimation for multisig operations
 */
async function handleGasEstimation(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions,
    contractAddress: string,
    entrypoint: string,
    calldata: any[]
): Promise<Record<string, never>> {
    console.log(`\nEstimating gas for ${entrypoint} on ${chain.name}...`);

    const provider = getStarknetProvider(chain);
    // For multisig, the account address is the contract address itself
    const accountAddress = options.accountAddress || contractAddress;
    // Use a dummy private key for estimation since we're just simulating
    const dummyPrivateKey = '0x1';
    const account = getStarknetAccount(dummyPrivateKey, accountAddress, provider);
    const calls: Call[] = [{
        contractAddress,
        entrypoint,
        calldata
    }];

    await estimateGasAndDisplayArgs(account, calls);
    return {}; // Return empty for estimation
}

/**
 * Get Ledger public key
 */
async function getLedgerPublicKey(ledgerPath: string): Promise<void> {
    console.log('📱 Initializing Ledger connection...');

    let transport;
    let app;

    try {
        transport = await TransportNodeHid.create();
        app = new StarknetClient(transport);

        const version = await app.getAppVersion();
        console.log(`✅ Connected to Starknet app v${version.major}.${version.minor}.${version.patch}`);

        console.log(`\n🔑 Getting public key for path: ${ledgerPath}`);
        const { starkKey } = await app.getStarkKey(ledgerPath, false);
        const publicKeyHex = encode.addHexPrefix(encode.buf2hex(starkKey));

        console.log(`\n📋 Ledger Public Key: ${publicKeyHex}`);
        console.log(`\n💡 This public key can be used as a Starknet signer in the multisig`);

    } catch (error: any) {
        if (error.message?.includes('0x6e00')) {
            console.error('❌ Starknet app not open on device');
        } else {
            console.error('❌ Error getting public key:', error.message);
        }
        throw error;
    } finally {
        if (transport) {
            await transport.close();
        }
    }
}

/**
 * Get multisig threshold
 */
async function getThreshold(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<void> {
    const provider = getStarknetProvider(chain);
    const { abi } = await provider.getClassAt(options.contractAddress);
    const multisigContract = new Contract(abi, options.contractAddress, provider);

    console.log(`\nGetting threshold for multisig at ${options.contractAddress}...`);
    const threshold = await multisigContract.get_threshold();
    console.log(`Threshold: ${threshold}`);
}

/**
 * Get multisig signers
 */
async function getSigners(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<void> {
    const provider = getStarknetProvider(chain);
    const { abi } = await provider.getClassAt(options.contractAddress);
    const multisigContract = new Contract(abi, options.contractAddress, provider);

    console.log(`\nGetting signers for multisig at ${options.contractAddress}...`);
    const signerGuids = await multisigContract.get_signer_guids();

    console.log(`\nSigners (${signerGuids.length} total):`);
    signerGuids.forEach((guid: any, index: number) => {
        console.log(`  ${index + 1}. ${num.toHex(guid)}`);
    });
}

/**
 * Check if address is a signer
 */
async function isSigner(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<void> {
    const provider = getStarknetProvider(chain);
    const { abi } = await provider.getClassAt(options.contractAddress);
    const multisigContract = new Contract(abi, options.contractAddress, provider);

    if (!options.signer || !options.signerType) {
        throw new Error('Signer and signer type required');
    }

    console.log(`\nChecking if signer exists in multisig at ${options.contractAddress}...`);
    console.log(`  Signer: ${options.signer}`);
    console.log(`  Type: ${options.signerType}`);

    // Get the numeric value for the signer type
    const signerTypeValue = getSignerTypeValue(options.signerType);

    // Pass as tuple [signer_type, signer_data]
    const result = await multisigContract.is_signer(CallData.compile([
        signerTypeValue,
        options.signer
    ]));

    console.log(`Is signer: ${result}`);
}

/**
 * Change multisig threshold
 */
async function changeThreshold(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        estimate,
        threshold,
        contractAddress
    } = options;

    if (!threshold) {
        throw new Error('New threshold required');
    }

    console.log(`\nChanging threshold to ${threshold} for multisig at ${contractAddress}`);

    const calldata = CallData.compile([threshold]);
    const hexCalldata = calldata.map(item => num.toHex(item));

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'change_threshold',
        calldata: hexCalldata
    }];

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, contractAddress, 'change_threshold', hexCalldata);
    }

    // Always generate offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');

    // Set accountAddress to contractAddress since they're the same for multisig
    const offlineOptions = { ...options, accountAddress: options.contractAddress };
    return handleOfflineTransaction(offlineOptions, chain.name, calls, 'change_threshold');
}

/**
 * Add signers to multisig
 */
async function addSigners(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        estimate,
        threshold,
        signers,
        signerType,
        contractAddress
    } = options;

    if (!threshold || !signers) {
        throw new Error('New threshold and signers required');
    }

    console.log(`\nAdding signers with new threshold ${threshold}`);

    // Parse signers in the same format as is_signer
    const signersList = signers.split(',').map(s => s.trim());
    const signerTypeValue = getSignerTypeValue(signerType || 'starknet');
    
    // Build the calldata: [threshold, array_length, ...signers]
    // Each signer is a tuple [signer_type, signer_data]
    const calldataArray: any[] = [threshold, signersList.length];
    
    // Add each signer as [type, data]
    for (const signerData of signersList) {
        calldataArray.push(signerTypeValue);
        calldataArray.push(signerData);
    }
    
    const calldata = CallData.compile(calldataArray);
    const hexCalldata = calldata.map(item => num.toHex(item));

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'add_signers',
        calldata: hexCalldata
    }];

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, contractAddress, 'add_signers', hexCalldata);
    }

    // Always generate offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');

    // Set accountAddress to contractAddress since they're the same for multisig
    const offlineOptions = { ...options, accountAddress: options.contractAddress };
    return handleOfflineTransaction(offlineOptions, chain.name, calls, 'add_signers');
}

/**
 * Remove signers from multisig
 */
async function removeSigners(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        offline,
        estimate,
        threshold,
        signers,
        signerType,
        contractAddress
    } = options;

    if (!threshold || !signers) {
        throw new Error('New threshold and signers required');
    }

    console.log(`\nRemoving signers with new threshold ${threshold}`);

    // Parse signers in the same format as is_signer
    const signersList = signers.split(',').map(s => s.trim());
    const signerTypeValue = getSignerTypeValue(signerType || 'starknet');
    
    // Build the calldata: [threshold, array_length, ...signers]
    // Each signer is a tuple [signer_type, signer_data]
    const calldataArray: any[] = [threshold, signersList.length];
    
    // Add each signer as [type, data]
    for (const signerData of signersList) {
        calldataArray.push(signerTypeValue);
        calldataArray.push(signerData);
    }
    
    const calldata = CallData.compile(calldataArray);
    const hexCalldata = calldata.map(item => num.toHex(item));

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'remove_signers',
        calldata: hexCalldata
    }];

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, contractAddress, 'remove_signers', hexCalldata);
    }

    // Handle offline mode
    if (offline) {
        return handleOfflineTransaction(options, chain.name, calls, 'remove_signers');
    }

    // Always generate offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');
    return handleOfflineTransaction(options, chain.name, calls, 'remove_signers');
}

/**
 * Replace signer in multisig
 */
async function replaceSigner(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        offline,
        estimate,
        signerToRemove,
        signerToAdd,
        signerType,
        contractAddress
    } = options;

    if (!signerToRemove || !signerToAdd) {
        throw new Error('Both signer to remove and signer to add required');
    }

    console.log(`\nReplacing signer in multisig at ${contractAddress}`);

    // Parse signers in the same format as is_signer
    const signerTypeValue = getSignerTypeValue(signerType || 'starknet');
    
    // Build the calldata: [signer_to_remove_type, signer_to_remove_data, signer_to_add_type, signer_to_add_data]
    const calldata = CallData.compile([
        signerTypeValue,
        signerToRemove,
        signerTypeValue,
        signerToAdd
    ]);
    const hexCalldata = calldata.map(item => num.toHex(item));

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'replace_signer',
        calldata: hexCalldata
    }];

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, contractAddress, 'replace_signer', hexCalldata);
    }

    // Handle offline mode
    if (offline) {
        return handleOfflineTransaction(options, chain.name, calls, 'replace_signer');
    }

    // Always generate offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');
    return handleOfflineTransaction(options, chain.name, calls, 'replace_signer');
}

/**
 * Toggle escape (guardian recovery)
 */
async function toggleEscape(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        offline,
        estimate,
        isEnabled,
        securityPeriod,
        expiryPeriod,
        guardian,
        contractAddress
    } = options;

    if (isEnabled === undefined || !securityPeriod || !expiryPeriod || !guardian) {
        throw new Error('All parameters required: isEnabled, securityPeriod, expiryPeriod, guardian');
    }

    console.log(`\nToggling escape recovery:`);
    console.log(`  Enabled: ${isEnabled}`);
    console.log(`  Security Period: ${securityPeriod} seconds`);
    console.log(`  Expiry Period: ${expiryPeriod} seconds`);
    console.log(`  Guardian: ${guardian}`);

    const calldata = CallData.compile([
        isEnabled,
        securityPeriod,
        expiryPeriod,
        guardian
    ]);
    const hexCalldata = calldata.map(item => num.toHex(item));

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'toggle_escape',
        calldata: hexCalldata
    }];

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, contractAddress, 'toggle_escape', hexCalldata);
    }

    // Handle offline mode
    if (offline) {
        return handleOfflineTransaction(options, chain.name, calls, 'toggle_escape');
    }

    // Always generate offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');
    return handleOfflineTransaction(options, chain.name, calls, 'toggle_escape');
}

/**
 * Get guardian address
 */
async function getGuardian(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<void> {
    const provider = getStarknetProvider(chain);
    const { abi } = await provider.getClassAt(options.contractAddress);
    const multisigContract = new Contract(abi, options.contractAddress, provider);

    console.log(`\nGetting guardian for multisig at ${options.contractAddress}...`);
    const guardian = await multisigContract.get_guardian();
    console.log(`Guardian: ${guardian}`);
}

/**
 * Trigger escape
 */
async function triggerEscape(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        offline,
        estimate,
        selector,
        calldata,
        contractAddress
    } = options;

    if (!selector) {
        throw new Error('Selector required for escape call');
    }

    console.log(`\nTriggering escape with selector: ${selector}`);

    const escapeCalldata = calldata ? calldata.split(',').map(s => s.trim()) : [];
    const escapeCall = {
        selector,
        calldata: escapeCalldata
    };

    const compiledCalldata = CallData.compile([escapeCall]);
    const hexCalldata = compiledCalldata.map(item => num.toHex(item));

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'trigger_escape',
        calldata: hexCalldata
    }];

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, contractAddress, 'trigger_escape', hexCalldata);
    }

    // Handle offline mode
    if (offline) {
        return handleOfflineTransaction(options, chain.name, calls, 'trigger_escape');
    }

    // Check if we have credentials for online execution
    if (options.privateKey && options.accountAddress) {
        // Online execution
        const provider = getStarknetProvider(chain);
        const account = getStarknetAccount(options.privateKey, options.accountAddress, provider);
        
        // Get contract ABI and execute
        const { abi } = await provider.getClassAt(contractAddress);
        const multisigContract = new Contract(abi, contractAddress, provider);
        multisigContract.connect(account);
        
        const response = await multisigContract.trigger_escape(escapeCall);
        await account.waitForTransaction(response.transaction_hash);
        
        console.log(`✅ Escape triggered successfully!`);
        console.log(`Transaction Hash: ${response.transaction_hash}`);
        
        return response;
    }

    // Default to offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');
    return handleOfflineTransaction(options, chain.name, calls, 'trigger_escape');
}

/**
 * Execute escape
 */
async function executeEscape(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        offline,
        estimate,
        selector,
        calldata,
        contractAddress
    } = options;

    if (!selector) {
        throw new Error('Selector required for escape call');
    }

    console.log(`\nExecuting escape with selector: ${selector}`);

    const escapeCalldata = calldata ? calldata.split(',').map(s => s.trim()) : [];
    const escapeCall = {
        selector,
        calldata: escapeCalldata
    };

    const compiledCalldata = CallData.compile([escapeCall]);
    const hexCalldata = compiledCalldata.map(item => num.toHex(item));

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'execute_escape',
        calldata: hexCalldata
    }];

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, contractAddress, 'execute_escape', hexCalldata);
    }

    // Handle offline mode
    if (offline) {
        return handleOfflineTransaction(options, chain.name, calls, 'execute_escape');
    }

    // Check if we have credentials for online execution
    if (options.privateKey && options.accountAddress) {
        // Online execution
        const provider = getStarknetProvider(chain);
        const account = getStarknetAccount(options.privateKey, options.accountAddress, provider);
        
        // Get contract ABI and execute
        const { abi } = await provider.getClassAt(contractAddress);
        const multisigContract = new Contract(abi, contractAddress, provider);
        multisigContract.connect(account);
        
        const response = await multisigContract.execute_escape(escapeCall);
        await account.waitForTransaction(response.transaction_hash);
        
        console.log(`✅ Escape executed successfully!`);
        console.log(`Transaction Hash: ${response.transaction_hash}`);
        
        return response;
    }

    // Default to offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');
    return handleOfflineTransaction(options, chain.name, calls, 'execute_escape');
}

/**
 * Cancel escape
 */
async function cancelEscape(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        offline,
        estimate,
        contractAddress
    } = options;

    console.log(`\nCanceling escape for multisig at ${contractAddress}`);

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'cancel_escape',
        calldata: []
    }];

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, contractAddress, 'cancel_escape', []);
    }

    // Handle offline mode
    if (offline) {
        return handleOfflineTransaction(options, chain.name, calls, 'cancel_escape');
    }

    // Check if we have credentials for online execution
    if (options.privateKey && options.accountAddress) {
        // Online execution
        const provider = getStarknetProvider(chain);
        const account = getStarknetAccount(options.privateKey, options.accountAddress, provider);
        
        // Get contract ABI and execute
        const { abi } = await provider.getClassAt(contractAddress);
        const multisigContract = new Contract(abi, contractAddress, provider);
        multisigContract.connect(account);
        
        const response = await multisigContract.cancel_escape();
        await account.waitForTransaction(response.transaction_hash);
        
        console.log(`✅ Escape cancelled successfully!`);
        console.log(`Transaction Hash: ${response.transaction_hash}`);
        
        return response;
    }

    // Default to offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');
    return handleOfflineTransaction(options, chain.name, calls, 'cancel_escape');
}

/**
 * Get escape status
 */
async function getEscape(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<void> {
    const provider = getStarknetProvider(chain);
    const { abi } = await provider.getClassAt(options.contractAddress);
    const multisigContract = new Contract(abi, options.contractAddress, provider);

    console.log(`\nGetting escape status for multisig at ${options.contractAddress}...`);
    const result = await multisigContract.get_escape();

    // The result might be a single object or tuple, let's handle both cases
    let escape, status;
    if (Array.isArray(result)) {
        [escape, status] = result;
    } else if (result.escape && result.status !== undefined) {
        escape = result.escape;
        status = result.status;
    } else {
        // Assume the result is the escape object itself
        escape = result;
        status = 'Unknown';
    }

    console.log('\nEscape Status:');
    console.log(`  Ready At: ${escape?.ready_at || 'N/A'}`);
    console.log(`  Call Hash: ${escape?.call_hash || 'N/A'}`);
    console.log(`  Status: ${status}`);
}

/**
 * Get escape enabled status
 */
async function getEscapeEnabled(
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<void> {
    const provider = getStarknetProvider(chain);
    const { abi } = await provider.getClassAt(options.contractAddress);
    const multisigContract = new Contract(abi, options.contractAddress, provider);

    console.log(`\nGetting escape enabled status for multisig at ${options.contractAddress}...`);
    const escapeEnabled = await multisigContract.get_escape_enabled();

    console.log('\nEscape Configuration:');
    console.log(`  Is Enabled: ${escapeEnabled.is_enabled}`);
    console.log(`  Security Period: ${escapeEnabled.security_period} seconds`);
    console.log(`  Expiry Period: ${escapeEnabled.expiry_period} seconds`);
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('multisig')
        .description('Control Argent multisig v0.2.0 account on Starknet')
        .version('1.0.0');

    // Subcommand: get-ledger-pubkey
    const getLedgerPubkeyCmd = program
        .command('get-ledger-pubkey')
        .description('Get Ledger public key for a given derivation path')
        .requiredOption('-p, --ledger-path <path>', 'Ledger derivation path (e.g. "m/2645\'/1195502025\'/1148870696\'/1\'/0\'/0")')
        .action(async (options) => {
            try {
                await getLedgerPublicKey(options.ledgerPath);
            } catch (error: any) {
                console.error(`❌ Failed to get Ledger public key: ${error.message}`);
                process.exit(1);
            }
        });

    // Read commands
    const getThresholdCmd = program
        .command('get-threshold')
        .description('Get current multisig threshold')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address');

    addStarknetOptions(getThresholdCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    getThresholdCmd.action(async (options) => {
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await getThreshold({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to get threshold: ${error.message}`);
            process.exit(1);
        }
    });

    const getSignersCmd = program
        .command('get-signers')
        .description('Get list of signer GUIDs')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address');

    addStarknetOptions(getSignersCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    getSignersCmd.action(async (options) => {
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await getSigners({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to get signers: ${error.message}`);
            process.exit(1);
        }
    });

    const isSignerCmd = program
        .command('is-signer')
        .description('Check if an address is a signer')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address')
        .requiredOption('-s, --signer <signer>', 'Signer pubkey to check')
        .option('-t, --signer-type <type>', 'Signer type (starknet, secp256k1, secp256r1, eip191)', 'starknet');

    addStarknetOptions(isSignerCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    isSignerCmd.action(async (options) => {
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await isSigner({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to check signer: ${error.message}`);
            process.exit(1);
        }
    });

    // Write commands
    const changeThresholdCmd = program
        .command('change-threshold')
        .description('Change multisig threshold')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address')
        .requiredOption('-t, --threshold <number>', 'New threshold', parseInt);

    addStarknetOptions(changeThresholdCmd, { offlineSupport: true });

    changeThresholdCmd.action(async (options) => {
        prepareMultisigOptions(options);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await changeThreshold({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to change threshold: ${error.message}`);
            process.exit(1);
        }
    });

    const addSignersCmd = program
        .command('add-signers')
        .description('Add new signers with new threshold')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address')
        .requiredOption('-t, --threshold <number>', 'New threshold', parseInt)
        .requiredOption('-s, --signers <signers>', 'Comma-separated list of signers to add')
        .option('--signer-type <type>', 'Signer type (starknet, secp256k1, secp256r1, eip191)', 'starknet');

    addStarknetOptions(addSignersCmd, { offlineSupport: true });

    addSignersCmd.action(async (options) => {
        prepareMultisigOptions(options);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await addSigners({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to add signers: ${error.message}`);
            process.exit(1);
        }
    });

    const removeSignersCmd = program
        .command('remove-signers')
        .description('Remove signers with new threshold')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address')
        .requiredOption('-t, --threshold <number>', 'New threshold', parseInt)
        .requiredOption('-s, --signers <signers>', 'Comma-separated list of signers to remove')
        .option('--signer-type <type>', 'Signer type (starknet, secp256k1, secp256r1, eip191)', 'starknet');

    addStarknetOptions(removeSignersCmd, { offlineSupport: true });

    removeSignersCmd.action(async (options) => {
        prepareMultisigOptions(options);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await removeSigners({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to remove signers: ${error.message}`);
            process.exit(1);
        }
    });

    const replaceSignerCmd = program
        .command('replace-signer')
        .description('Replace one signer with another')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address')
        .requiredOption('--signer-to-remove <address>', 'Signer to remove')
        .requiredOption('--signer-to-add <address>', 'Signer to add')
        .option('--signer-type <type>', 'Signer type (starknet, secp256k1, secp256r1, eip191)', 'starknet');

    addStarknetOptions(replaceSignerCmd, { offlineSupport: true });

    replaceSignerCmd.action(async (options) => {
        prepareMultisigOptions(options);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await replaceSigner({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to replace signer: ${error.message}`);
            process.exit(1);
        }
    });

    // Guardian/Recovery commands
    const toggleEscapeCmd = program
        .command('toggle-escape')
        .description('Enable/disable guardian recovery')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address')
        .requiredOption('--is-enabled <boolean>', 'Enable (true) or disable (false)', (val) => val === 'true')
        .requiredOption('--security-period <seconds>', 'Security period in seconds')
        .requiredOption('--expiry-period <seconds>', 'Expiry period in seconds')
        .requiredOption('--guardian <address>', 'Guardian address');

    addStarknetOptions(toggleEscapeCmd, { offlineSupport: true });

    toggleEscapeCmd.action(async (options) => {
        prepareMultisigOptions(options);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await toggleEscape({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to toggle escape: ${error.message}`);
            process.exit(1);
        }
    });

    const getGuardianCmd = program
        .command('get-guardian')
        .description('Get current guardian address')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address');

    addStarknetOptions(getGuardianCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    getGuardianCmd.action(async (options) => {
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await getGuardian({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to get guardian: ${error.message}`);
            process.exit(1);
        }
    });

    const triggerEscapeCmd = program
        .command('trigger-escape')
        .description('Trigger escape/recovery (guardian only)')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address')
        .requiredOption('--selector <selector>', 'Function selector to call')
        .option('--calldata <data>', 'Comma-separated calldata');

    addStarknetOptions(triggerEscapeCmd, { offlineSupport: true });

    triggerEscapeCmd.action(async (options) => {
        prepareMultisigOptions(options);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await triggerEscape({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to trigger escape: ${error.message}`);
            process.exit(1);
        }
    });

    const executeEscapeCmd = program
        .command('execute-escape')
        .description('Execute escape after security period')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address')
        .requiredOption('--selector <selector>', 'Function selector to call')
        .option('--calldata <data>', 'Comma-separated calldata');

    addStarknetOptions(executeEscapeCmd, { offlineSupport: true });

    executeEscapeCmd.action(async (options) => {
        prepareMultisigOptions(options);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await executeEscape({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to execute escape: ${error.message}`);
            process.exit(1);
        }
    });

    const cancelEscapeCmd = program
        .command('cancel-escape')
        .description('Cancel ongoing escape')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address');

    addStarknetOptions(cancelEscapeCmd, { offlineSupport: true });

    cancelEscapeCmd.action(async (options) => {
        prepareMultisigOptions(options);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await cancelEscape({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to cancel escape: ${error.message}`);
            process.exit(1);
        }
    });

    const getEscapeCmd = program
        .command('get-escape')
        .description('Get current escape status')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address');

    addStarknetOptions(getEscapeCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    getEscapeCmd.action(async (options) => {
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await getEscape({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to get escape: ${error.message}`);
            process.exit(1);
        }
    });

    const getEscapeEnabledCmd = program
        .command('get-escape-enabled')
        .description('Get escape configuration')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address');

    addStarknetOptions(getEscapeEnabledCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    getEscapeEnabledCmd.action(async (options) => {
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await getEscapeEnabled({ ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to get escape enabled: ${error.message}`);
            process.exit(1);
        }
    });

    program.parse();
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

export {
    getLedgerPublicKey,
    getThreshold,
    getSigners,
    isSigner,
    changeThreshold,
    addSigners,
    removeSigners,
    replaceSigner,
    toggleEscape,
    getGuardian,
    triggerEscape,
    executeEscape,
    cancelEscape,
    getEscape,
    getEscapeEnabled
};
