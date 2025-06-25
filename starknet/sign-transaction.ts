'use strict';

import { Command } from 'commander';
import { hash, stark, constants, encode, ETransactionVersion3, EDataAvailabilityMode, Calldata } from 'starknet';
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
    chainId: constants.StarknetChainId,
    multisig: boolean
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
        console.log(`  Calldata length: ${transaction.calldata.length}`);
        // console.log(`  Calldata: ${transaction.calldata.slice(0, 10).join(', ')}${transaction.calldata.length > 10 ? '...' : ''}`);
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
        const { starkKey } = await app.getStarkKey(ledgerPath, false);
        const publicKeyHex = encode.addHexPrefix(encode.buf2hex(starkKey));
        console.log(`Public key: ${publicKeyHex}`);

        // Sign the transaction hash
        console.log('\n✍️  Please review and sign the transaction on your Ledger device...');
        console.log('⚠️  Note: You will see the transaction hash on your device screen.');

        // Check if this is a multicall transaction
        if (transaction.multicall_info && transaction.multicall_info.length > 0) {
            console.log('\n📋 Multicall Transaction Details:');
            console.log(`Number of calls: ${transaction.multicall_info.length}`);
            transaction.multicall_info.forEach((call, index) => {
                console.log(`\nCall ${index + 1}:`);
                console.log(`  Contract: ${call.contract_address}`);
                console.log(`  Function: ${call.entrypoint}`);
                console.log(`  Arguments: ${call.calldata.length} parameters`);
            });
        } else {
            // Single call transaction
            if (!transaction.entrypoint_name || !transaction.contract_address) {
                throw new Error('Transaction missing original entrypoint_name or contract_address required for Ledger signing');
            }
            console.log('\n📋 Transaction Details:');
            console.log(`  Contract: ${transaction.contract_address}`);
            console.log(`  Function: ${transaction.entrypoint_name}`);
        }

        // Calculate and log the transaction hash for debugging
        const txHash = hash.calculateInvokeTransactionHash({
            senderAddress: transaction.sender_address,
            version: ETransactionVersion3.V3,
            compiledCalldata: transaction.calldata as Calldata,
            chainId: chainId,
            nonce: transaction.nonce,
            resourceBounds: transaction.resource_bounds,
            tip: transaction.tip,
            paymasterData: transaction.paymaster_data,
            accountDeploymentData: transaction.account_deployment_data,
            nonceDataAvailabilityMode: stark.intDAM(transaction.nonce_data_availability_mode as EDataAvailabilityMode),
            feeDataAvailabilityMode: stark.intDAM(transaction.fee_data_availability_mode as EDataAvailabilityMode),
        });

        console.log(`\n🔍 Transaction hash to be signed: ${txHash}`);

        const signature = await app.signHash(ledgerPath, txHash);

        // Check if signature contains an error
        if (signature.errorMessage && signature.returnCode !== 36864 && signature.errorMessage !== "No error") {
            throw new Error(`${signature.errorMessage || 'Unknown error'} (return code: ${signature.returnCode})`);
        }

        console.log('\n✅ Transaction signed successfully!');

        // Create signed transaction object
        // Handle different signature formats from Ledger
        let signatureArray: string[];
        if (signature.r && signature.s) {
            // Convert Buffer byte arrays to hex strings (field elements)
            let r: string, s: string;

            // Handle both Buffer and direct data array formats
            if (Buffer.isBuffer(signature.r) && Buffer.isBuffer(signature.s)) {
                r = `0x${signature.r.toString('hex')}`;
                s = `0x${signature.s.toString('hex')}`;
            } else if (signature.r.data && signature.s.data) {
                // Handle the format {"type":"Buffer","data":[...]}
                r = `0x${Buffer.from(signature.r.data).toString('hex')}`;
                s = `0x${Buffer.from(signature.s.data).toString('hex')}`;
            } else {
                throw new Error('Unexpected signature format - R and S are not in expected format');
            }

            // Ensure consistent formatting using stark.signatureToHexArray
            const formattedSignature = stark.signatureToHexArray([r, s]);

            if (multisig) {
                // For multisig accounts, include public key in signature
                signatureArray = ['1', '0', publicKeyHex, ...formattedSignature];
                console.log(`\n📝 Signature (Multisig format):`);
                console.log(`  Public Key: ${publicKeyHex}`);
                console.log(`  R: ${formattedSignature[0]}`);
                console.log(`  S: ${formattedSignature[1]}`);
            } else {
                // For single-signature accounts
                signatureArray = formattedSignature;
                console.log(`\n📝 Signature:`);
                console.log(`  R: ${formattedSignature[0]}`);
                console.log(`  S: ${formattedSignature[1]}`);
            }
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
        if (multisig) {
            console.log('1. If more signatures needed: Use combine-signatures.ts to combine with other signers');
            console.log('2. If threshold met: Use broadcast-transaction.ts to submit the transaction');
        } else {
            console.log('Use broadcast-transaction.ts to submit the signed transaction');
        }

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
        .requiredOption('-p, --ledger-path <path>', 'Ledger derivation path (e.g. "m/2645\'/1195502025\'/1148870696\'/1\'/0\'/0")')
        .option('-e, --env <env>', 'environment (mainnet, testnet, devnet)', 'mainnet')
        .option('--multisig', 'enable multisig mode (include public key in signature)', true)
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
        await signWithLedger(transactionFile, options.ledgerPath, chainId, options.multisig);
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
