'use strict';

import { Command } from 'commander';
import { hash, stark, constants, Account, ec, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../common';
import { getStarknetProvider } from './utils';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';

import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import { StarknetClient } from '@ledgerhq/hw-app-starknet';
import { UnsignedTransaction } from './types';

/**
 * Sign transaction with Ledger
 */
async function signWithLedger(
    transactionFile: string,
    ledgerPath: string,
    chainId: constants.StarknetChainId
): Promise<void> {
    console.log('📱 Initializing Ledger connection...');

    // Read unsigned transaction
    const transactionData = fs.readFileSync(transactionFile, 'utf8');
    const transaction = JSON.parse(transactionData) as UnsignedTransaction;

    console.log('\n📄 Transaction Details:');
    console.log(`  Type: ${transaction.type}`);
    console.log(`  Sender: ${transaction.sender_address}`);
    console.log(`  Nonce: ${transaction.nonce}`);

    if (transaction.type === 'INVOKE') {
        console.log(`  Calls: ${transaction.calls.length}`);
        transaction.calls.forEach((call, i) => {
            console.log(`    Call ${i + 1}:`);
            console.log(`      Contract: ${call.contractAddress}`);
            console.log(`      Entrypoint: ${call.entrypoint}`);
            console.log(`      Calldata length: ${call.calldata.length}`);
        });
    }

    let transport;
    let app;

    try {
        // Connect to Ledger
        console.log('\n🔌 Connecting to Ledger device...');
        transport = await TransportNodeHid.create();
        app = new StarknetClient(transport);

        // Get app version to verify connection
        const version = await app.getAppVersion();
        console.log(`✅ Connected to Starknet app v${version.major}.${version.minor}.${version.patch}`);

        // Get public key for verification
        console.log(`\n🔑 Using derivation path: ${ledgerPath}`);
        const pubKey = await app.getPubKey(ledgerPath);
        console.log(`Public key: 0x${Buffer.from(pubKey.publicKey).toString('hex')}`);

        // Sign the transaction hash
        console.log('\n✍️  Please review and sign the transaction on your Ledger device...');
        console.log('⚠️  Note: You will see the transaction hash on your device screen.');

        const signature = await app.signTx(ledgerPath, transaction.calls,
            {
                accountAddress: transaction.sender_address,
                tip: transaction.tip,
                resourceBounds: transaction.resource_bounds,
                chainId: chainId,
                nonce: transaction.nonce, // TODO: Set correct one by querying contract. Will it work if a lot of calls are made to the contract?
                nonceDataAvailabilityMode: transaction.nonce_data_availability_mode,
                feeDataAvailabilityMode: transaction.fee_data_availability_mode,
            });

        // Check if signature contains an error
        if (signature.errorMessage && signature.returnCode !== 36864 && signature.errorMessage !== "No error") {
            throw new Error(`${signature.errorMessage || 'Unknown error'} (return code: ${signature.returnCode})`);
        }

        console.log('\n✅ Transaction signed successfully!');

        // Create signed transaction object
        // Handle different signature formats from Ledger
        let signatureArray: string[];
        if (signature.r && signature.s && signature.h) {
            // Convert Buffer byte arrays to hex strings (field elements)
            if (!Buffer.isBuffer(signature.h) || !Buffer.isBuffer(signature.s) || !Buffer.isBuffer(signature.r)) {
                throw new Error('Unexpected signature format - H, S or R are not buffers');
            }

            // Convert to hex strings with 0x prefix
            const h = '0x' + signature.h.toString('hex');
            const r = '0x' + signature.r.toString('hex');
            const s = '0x' + signature.s.toString('hex');

            signatureArray = [r, s];
            console.log(`\n📝 Signature:`);
            console.log(`  TX Hash: ${h}`);
            console.log(`  R: ${r}`);
            console.log(`  S: ${s}`);
        } else {
            throw new Error(`Unexpected signature format: ${JSON.stringify(signature)}`);
        }

        const signedTransaction = {
            ...transaction,
            signature: signatureArray
        };

        // Save signed transaction
        const dir = path.dirname(transactionFile);
        const basename = path.basename(transactionFile, '.json');
        const signedFile = path.join(dir, `${basename}_signed.json`);

        fs.writeFileSync(signedFile, JSON.stringify(signedTransaction, null, 2));
        console.log(`\n💾 Signed transaction saved to: ${signedFile}`);

        console.log('\n📋 Next steps:');
        console.log('1. For single-signature accounts: Use broadcast-transaction.ts to submit');
        console.log('2. For multisig accounts: Collect more signatures with combine-signatures.ts');

    } catch (error: any) {
        if (error.message?.includes('0x6985')) {
            console.error('❌ Transaction rejected on device');
        } else if (error.message?.includes('0x6e00')) {
            console.error('❌ Starknet app not open on device');
        } else {
            console.error('❌ Error signing transaction:', error.message);
        }
        throw error;
    } finally {
        if (transport) {
            await transport.close();
        }
    }
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('sign-transaction')
        .description('Sign Starknet transaction with Ledger hardware wallet')
        .version('1.0.0')
        .argument('<transactionFile>', 'path to unsigned transaction JSON file')
        .option('-p, --ledger-path <path>', 'Ledger derivation path', "m/44'/9004'/0'/0/0")
        .option('-e, --env <env>', 'environment (mainnet, testnet, devnet)', 'mainnet')
        .parse();

    const [transactionFile] = program.args;
    const options = program.opts();

    if (!fs.existsSync(transactionFile)) {
        console.error(`❌ Transaction file not found: ${transactionFile}`);
        process.exit(1);
    }

    // Get chain ID from config
    const config = loadConfig(options.env);
    const chain = config.chains[STARKNET_CHAIN];

    if (!chain) {
        console.error(`❌ ${STARKNET_CHAIN} chain not found in ${options.env} configuration`);
        process.exit(1);
    }

    // Determine chain ID based on environment
    let chainId: constants.StarknetChainId;
    switch (options.env) {
        case 'mainnet':
            chainId = constants.StarknetChainId.SN_MAIN;
            break;
        case 'testnet':
            chainId = constants.StarknetChainId.SN_SEPOLIA;
            break;
        default:
            // For devnet/stagenet, we might need to get it from the provider
            const provider = getStarknetProvider(chain);
            const chainIdHex = await provider.getChainId();
            chainId = chainIdHex as constants.StarknetChainId;
    }

    try {
        await signWithLedger(transactionFile, options.ledgerPath, chainId);
    } catch (error: any) {
        console.error('\n❌ Signing failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

export { signWithLedger };
