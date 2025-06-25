'use strict';

import { Command } from 'commander';
import {
    CallData,
    Contract,
    Call,
    num,
    encode,
    cairo,
    CairoEnum,
    CairoOption,
    CairoOptionVariant,
    Account
} from 'starknet';
import * as fs from 'fs';
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
    Config,
    ChainConfig,
    StarknetCommandOptions,
    OfflineTransactionResult
} from './types';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { StarknetClient } from '@ledgerhq/hw-app-starknet';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';

// Signer type enum matching the contract
enum SignerType {
    Starknet = 0,
    Secp256k1 = 1,
    Secp256r1 = 2,
    Eip191 = 3,
    Webauthn = 4
}

// Interface for command options
interface MultisigCommandOptions extends StarknetCommandOptions {
    contractAddress: string;
    ledgerPath?: string;
    threshold?: number;
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
 * Verify Ledger connection and get public key
 */
async function verifyLedgerConnection(ledgerPath: string): Promise<string> {
    console.log('📱 Verifying Ledger connection...');
    
    let transport;
    let app;
    
    try {
        transport = await TransportNodeHid.create();
        app = new StarknetClient(transport);
        
        const version = await app.getAppVersion();
        console.log(`✅ Connected to Starknet app v${version.major}.${version.minor}.${version.patch}`);
        
        // Get public key for verification
        const { starkKey } = await app.getStarkKey(ledgerPath, false);
        const publicKeyHex = encode.addHexPrefix(encode.buf2hex(starkKey));
        
        console.log(`🔑 Public key: ${publicKeyHex}`);
        
        return publicKeyHex;
        
    } catch (error: any) {
        if (error.message?.includes('0x6e00')) {
            throw new Error('Starknet app not open on device');
        }
        throw error;
    } finally {
        if (transport) {
            await transport.close();
        }
    }
}

/**
 * Parse signer from string input
 */
function parseSigner(signerStr: string, signerType: string = 'starknet'): any {
    const type = signerType.toLowerCase();

    switch (type) {
        case 'starknet':
            return {
                variant: {
                    Starknet: {
                        pubkey: signerStr
                    }
                }
            };
        case 'secp256k1':
            return {
                variant: {
                    Secp256k1: {
                        pubkey_hash: {
                            address: signerStr
                        }
                    }
                }
            };
        case 'secp256r1':
            return {
                variant: {
                    Secp256r1: {
                        pubkey: signerStr
                    }
                }
            };
        case 'eip191':
            return {
                variant: {
                    Eip191: {
                        eth_address: {
                            address: signerStr
                        }
                    }
                }
            };
        case 'webauthn':
            throw new Error('Webauthn signer parsing not implemented in this script');
        default:
            throw new Error(`Unknown signer type: ${type}`);
    }
}

/**
 * Parse multiple signers from comma-separated string
 */
function parseSigners(signersStr: string, signerType: string = 'starknet'): any[] {
    return signersStr.split(',').map(s => parseSigner(s.trim(), signerType));
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
    config: Config,
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
    config: Config,
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
        console.log(`  ${index + 1}. ${guid}`);
    });
}

/**
 * Check if address is a signer
 */
async function isSigner(
    config: Config,
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<void> {
    const provider = getStarknetProvider(chain);
    const { abi } = await provider.getClassAt(options.contractAddress);
    const multisigContract = new Contract(abi, options.contractAddress, provider);

    if (!options.signers || !options.signerType) {
        throw new Error('Signer and signer type required');
    }

    console.log(`\nChecking if signer exists in multisig at ${options.contractAddress}...`);
    const signer = parseSigner(options.signers, options.signerType);
    const result = await multisigContract.is_signer(signer);

    console.log(`Is signer: ${result}`);
}

/**
 * Change multisig threshold
 */
async function changeThreshold(
    config: Config,
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        offline,
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
        console.log(`\nEstimating gas for change_threshold...`);
        const provider = getStarknetProvider(chain);
        // For estimate, use dummy account since we only need gas estimation
        const dummyAccount = getStarknetAccount('0x1', options.contractAddress!, provider);
        await estimateGasAndDisplayArgs(dummyAccount, calls);
        return {};
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
    config: Config,
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
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

    const signersArray = parseSigners(signers, signerType || 'starknet');

    console.log(`\nAdding ${signersArray.length} signers with new threshold ${threshold}`);

    const calldata = CallData.compile([threshold, signersArray]);
    const hexCalldata = calldata.map(item => num.toHex(item));

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'add_signers',
        calldata: hexCalldata
    }];

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for add_signers...`);
        const provider = getStarknetProvider(chain);
        // For estimate, use dummy account since we only need gas estimation
        const dummyAccount = getStarknetAccount('0x1', options.contractAddress!, provider);
        await estimateGasAndDisplayArgs(dummyAccount, calls);
        return {};
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
    config: Config,
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
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

    const signersArray = parseSigners(signers, signerType || 'starknet');

    console.log(`\nRemoving ${signersArray.length} signers with new threshold ${threshold}`);

    const calldata = CallData.compile([threshold, signersArray]);
    const hexCalldata = calldata.map(item => num.toHex(item));

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'remove_signers',
        calldata: hexCalldata
    }];

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for remove_signers...`);
        const provider = getStarknetProvider(chain);
        // For estimate, use dummy account since we only need gas estimation
        const dummyAccount = getStarknetAccount('0x1', options.contractAddress!, provider);
        await estimateGasAndDisplayArgs(dummyAccount, calls);
        return {};
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
    config: Config,
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
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

    const signerRemove = parseSigner(signerToRemove, signerType || 'starknet');
    const signerAdd = parseSigner(signerToAdd, signerType || 'starknet');

    console.log(`\nReplacing signer in multisig at ${contractAddress}`);

    const calldata = CallData.compile([signerRemove, signerAdd]);
    const hexCalldata = calldata.map(item => num.toHex(item));

    const calls: Call[] = [{
        contractAddress,
        entrypoint: 'replace_signer',
        calldata: hexCalldata
    }];

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for replace_signer...`);
        const provider = getStarknetProvider(chain);
        // For estimate, use dummy account since we only need gas estimation
        const dummyAccount = getStarknetAccount('0x1', options.contractAddress!, provider);
        await estimateGasAndDisplayArgs(dummyAccount, calls);
        return {};
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
    config: Config,
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
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
        console.log(`\nEstimating gas for toggle_escape...`);
        const provider = getStarknetProvider(chain);
        // For estimate, use dummy account since we only need gas estimation
        const dummyAccount = getStarknetAccount('0x1', options.contractAddress!, provider);
        await estimateGasAndDisplayArgs(dummyAccount, calls);
        return {};
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
    config: Config,
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
    config: Config,
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
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
        console.log(`\nEstimating gas for trigger_escape...`);
        const provider = getStarknetProvider(chain);
        // For estimate, use dummy account since we only need gas estimation
        const dummyAccount = getStarknetAccount('0x1', options.contractAddress!, provider);
        await estimateGasAndDisplayArgs(dummyAccount, calls);
        return {};
    }

    // Handle offline mode
    if (offline) {
        return handleOfflineTransaction(options, chain.name, calls, 'trigger_escape');
    }

    // Always generate offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');
    return handleOfflineTransaction(options, chain.name, calls, 'trigger_escape');
}

/**
 * Execute escape
 */
async function executeEscape(
    config: Config,
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
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
        console.log(`\nEstimating gas for execute_escape...`);
        const provider = getStarknetProvider(chain);
        // For estimate, use dummy account since we only need gas estimation
        const dummyAccount = getStarknetAccount('0x1', options.contractAddress!, provider);
        await estimateGasAndDisplayArgs(dummyAccount, calls);
        return {};
    }

    // Handle offline mode
    if (offline) {
        return handleOfflineTransaction(options, chain.name, calls, 'execute_escape');
    }

    // Always generate offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');
    return handleOfflineTransaction(options, chain.name, calls, 'execute_escape');
}

/**
 * Cancel escape
 */
async function cancelEscape(
    config: Config,
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
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
        console.log(`\nEstimating gas for cancel_escape...`);
        const provider = getStarknetProvider(chain);
        // For estimate, use dummy account since we only need gas estimation
        const dummyAccount = getStarknetAccount('0x1', options.contractAddress!, provider);
        await estimateGasAndDisplayArgs(dummyAccount, calls);
        return {};
    }

    // Handle offline mode
    if (offline) {
        return handleOfflineTransaction(options, chain.name, calls, 'cancel_escape');
    }

    // Always generate offline transaction for Ledger signing
    console.log('\n📝 Generating unsigned transaction for Ledger signing...');
    return handleOfflineTransaction(options, chain.name, calls, 'cancel_escape');
}

/**
 * Get escape status
 */
async function getEscape(
    config: Config,
    chain: ChainConfig & { name: string },
    options: MultisigCommandOptions
): Promise<void> {
    const provider = getStarknetProvider(chain);
    const { abi } = await provider.getClassAt(options.contractAddress);
    const multisigContract = new Contract(abi, options.contractAddress, provider);

    console.log(`\nGetting escape status for multisig at ${options.contractAddress}...`);
    const [escape, status] = await multisigContract.get_escape();

    console.log('\nEscape Status:');
    console.log(`  Ready At: ${escape.ready_at}`);
    console.log(`  Call Hash: ${escape.call_hash}`);
    console.log(`  Status: ${status}`);
}

/**
 * Get escape enabled status
 */
async function getEscapeEnabled(
    config: Config,
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
            await getThreshold(config, { ...chain, name: STARKNET_CHAIN }, options);
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
            await getSigners(config, { ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to get signers: ${error.message}`);
            process.exit(1);
        }
    });

    const isSignerCmd = program
        .command('is-signer')
        .description('Check if an address is a signer')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address')
        .requiredOption('-s, --signers <signers>', 'Signer address to check')
        .option('-t, --signer-type <type>', 'Signer type (starknet, secp256k1, secp256r1, eip191)', 'starknet');

    addStarknetOptions(isSignerCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    isSignerCmd.action(async (options) => {
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await isSigner(config, { ...chain, name: STARKNET_CHAIN }, options);
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

    addStarknetOptions(changeThresholdCmd, { ignorePrivateKey: true, ignoreAccountAddress: true, offlineSupport: true, onlineLedgerSupport: true });

    changeThresholdCmd.action(async (options) => {
        validateStarknetOptions(options.env, true, undefined, options.contractAddress);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await changeThreshold(config, { ...chain, name: STARKNET_CHAIN }, options);
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
        .option('--signer-type <type>', 'Signer type (starknet, secp256k1, secp256r1, eip191)', 'starknet')
        .requiredOption('-p, --ledger-path <path>', 'Ledger derivation path');

    addStarknetOptions(addSignersCmd, { ignorePrivateKey: true, ignoreAccountAddress: true, offlineSupport: true, onlineLedgerSupport: true });

    addSignersCmd.action(async (options) => {
        validateStarknetOptions(options.env, true, undefined, options.contractAddress);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await addSigners(config, { ...chain, name: STARKNET_CHAIN }, options);
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

    addStarknetOptions(removeSignersCmd, { ignorePrivateKey: true, ignoreAccountAddress: true, offlineSupport: true, onlineLedgerSupport: true });

    removeSignersCmd.action(async (options) => {
        validateStarknetOptions(options.env, true, undefined, options.contractAddress);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await removeSigners(config, { ...chain, name: STARKNET_CHAIN }, options);
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

    addStarknetOptions(replaceSignerCmd, { ignorePrivateKey: true, ignoreAccountAddress: true, offlineSupport: true, onlineLedgerSupport: true });

    replaceSignerCmd.action(async (options) => {
        validateStarknetOptions(options.env, true, undefined, options.contractAddress);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await replaceSigner(config, { ...chain, name: STARKNET_CHAIN }, options);
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

    addStarknetOptions(toggleEscapeCmd, { ignorePrivateKey: true, ignoreAccountAddress: true, offlineSupport: true, onlineLedgerSupport: true });

    toggleEscapeCmd.action(async (options) => {
        validateStarknetOptions(options.env, true, undefined, options.contractAddress);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await toggleEscape(config, { ...chain, name: STARKNET_CHAIN }, options);
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
            await getGuardian(config, { ...chain, name: STARKNET_CHAIN }, options);
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

    addStarknetOptions(triggerEscapeCmd, { ignorePrivateKey: true, ignoreAccountAddress: true, offlineSupport: true, onlineLedgerSupport: true });

    triggerEscapeCmd.action(async (options) => {
        validateStarknetOptions(options.env, true, undefined, options.contractAddress);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await triggerEscape(config, { ...chain, name: STARKNET_CHAIN }, options);
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

    addStarknetOptions(executeEscapeCmd, { ignorePrivateKey: true, ignoreAccountAddress: true, offlineSupport: true, onlineLedgerSupport: true });

    executeEscapeCmd.action(async (options) => {
        validateStarknetOptions(options.env, true, undefined, options.contractAddress);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await executeEscape(config, { ...chain, name: STARKNET_CHAIN }, options);
        } catch (error: any) {
            console.error(`❌ Failed to execute escape: ${error.message}`);
            process.exit(1);
        }
    });

    const cancelEscapeCmd = program
        .command('cancel-escape')
        .description('Cancel ongoing escape')
        .requiredOption('-c, --contract-address <address>', 'Multisig contract address');

    addStarknetOptions(cancelEscapeCmd, { ignorePrivateKey: true, ignoreAccountAddress: true, offlineSupport: true, onlineLedgerSupport: true });

    cancelEscapeCmd.action(async (options) => {
        validateStarknetOptions(options.env, true, undefined, options.contractAddress);
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            await cancelEscape(config, { ...chain, name: STARKNET_CHAIN }, options);
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
            await getEscape(config, { ...chain, name: STARKNET_CHAIN }, options);
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
            await getEscapeEnabled(config, { ...chain, name: STARKNET_CHAIN }, options);
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
