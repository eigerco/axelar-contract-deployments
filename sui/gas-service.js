const { Command } = require('commander');
const { Transaction } = require('@mysten/sui/transactions');
const { bcs } = require('@mysten/sui/bcs');
const { ethers } = require('hardhat');
const { SUI_PACKAGE_ID, TxBuilder } = require('@axelar-network/axelar-cgp-sui');
const {
    utils: { arrayify },
} = ethers;
const { saveConfig, loadConfig, printError, getChainConfig } = require('../common/utils');
const {
    getWallet,
    printWalletInfo,
    broadcast,
    getFormattedAmount,
    addOptionsToCommands,
    addBaseOptions,
    parseSuiUnitAmount,
} = require('./utils');

async function payGas(keypair, client, gasServiceConfig, args, options, contracts) {
    const walletAddress = keypair.toSuiAddress();

    const gasServicePackageId = gasServiceConfig.address;
    const axelarGatewayPackageId = contracts.AxelarGateway.address;

    const { params } = options;
    const refundAddress = options.refundAddress || walletAddress;

    const [destinationChain, destinationAddress, payload] = args;
    const unitAmount = options.amount;

    let channel = options.channel;

    const tx = new Transaction();

    // Create a temporary channel if one wasn't provided
    if (!options.channel) {
        [channel] = tx.moveCall({
            target: `${axelarGatewayPackageId}::channel::new`,
            arguments: [],
        });
    }

    const [coin] = tx.splitCoins(tx.gas, [unitAmount]);

    const [messageTicket] = tx.moveCall({
        target: `${axelarGatewayPackageId}::gateway::prepare_message`,
        arguments: [
            channel,
            tx.pure(bcs.string().serialize(destinationChain).toBytes()), // Destination chain
            tx.pure(bcs.string().serialize(destinationAddress).toBytes()), // Destination address
            tx.pure(bcs.vector(bcs.u8()).serialize(arrayify(payload)).toBytes()), // Payload
        ],
    });

    tx.moveCall({
        target: `${gasServicePackageId}::gas_service::pay_gas`,
        arguments: [
            tx.object(gasServiceConfig.objects.GasService),
            messageTicket,
            coin, // Coin<SUI>
            tx.pure.address(refundAddress), // Refund address
            tx.pure(bcs.vector(bcs.u8()).serialize(arrayify(params)).toBytes()), // Params
        ],
        typeArguments: [`${SUI_PACKAGE_ID}::sui::SUI`],
    });

    tx.moveCall({
        target: `${axelarGatewayPackageId}::gateway::send_message`,
        arguments: [tx.object(contracts.AxelarGateway.objects.Gateway), messageTicket],
    });

    if (!options.channel) {
        tx.moveCall({
            target: `${axelarGatewayPackageId}::channel::destroy`,
            arguments: [channel],
        });
    }

    await broadcast(client, keypair, tx, 'Gas Paid', options);
}

async function addGas(keypair, client, gasServiceConfig, args, options) {
    const walletAddress = keypair.toSuiAddress();

    const gasServicePackageId = gasServiceConfig.address;

    const params = options.params || '0x';
    const refundAddress = options.refundAddress || walletAddress;

    const [messageId] = args;
    const unitAmount = options.amount;

    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [unitAmount]);

    tx.moveCall({
        target: `${gasServicePackageId}::gas_service::add_gas`,
        arguments: [
            tx.object(gasServiceConfig.objects.GasService),
            coin, // Coin<SUI>
            tx.pure(bcs.string().serialize(messageId).toBytes()), // Message ID for the contract call
            tx.pure.address(refundAddress), // Refund address
            tx.pure(bcs.vector(bcs.u8()).serialize(arrayify(params)).toBytes()), // Params
        ],
        typeArguments: [`${SUI_PACKAGE_ID}::sui::SUI`],
    });

    await broadcast(client, keypair, tx, 'Gas Added', options);
}

async function collectGas(keypair, client, gasServiceConfig, args, options) {
    const walletAddress = keypair.toSuiAddress();

    const gasServicePackageId = gasServiceConfig.address;

    const unitAmount = options.amount;
    const receiver = options.receiver || walletAddress;

    const balanceQuery = new TxBuilder(client);
    await balanceQuery.moveCall({
        target: `${gasServicePackageId}::gas_service::balance`,
        arguments: [gasServiceConfig.objects.GasService],
        typeArguments: [`${SUI_PACKAGE_ID}::sui::SUI`],
    });
    const result = await balanceQuery.devInspect(walletAddress);
    const gasServiceBalance = bcs.U64.parse(new Uint8Array(result.results[0].returnValues[0][0]));

    // Check if the gas service balance is sufficient
    if (gasServiceBalance < unitAmount) {
        printError('Insufficient gas service balance', `${getFormattedAmount(gasServiceBalance)} < ${getFormattedAmount(unitAmount)}`);
        return;
    }

    const tx = new Transaction();

    tx.moveCall({
        target: `${gasServicePackageId}::gas_service::collect_gas`,
        arguments: [
            tx.object(gasServiceConfig.objects.GasService),
            tx.object(gasServiceConfig.objects.OperatorCap),
            tx.pure.address(receiver), // Receiver address
            tx.pure.u64(unitAmount), // Amount
        ],
        typeArguments: [`${SUI_PACKAGE_ID}::sui::SUI`],
    });

    await broadcast(client, keypair, tx, 'Gas Collected', options);
}

async function refund(keypair, client, gasServiceConfig, args, options) {
    const walletAddress = keypair.toSuiAddress();

    const gasServicePackageId = gasServiceConfig.address;

    const [messageId] = args;
    const unitAmount = options.amount;
    const receiver = options.receiver || walletAddress;

    const balanceQuery = new TxBuilder(client);
    await balanceQuery.moveCall({
        target: `${gasServicePackageId}::gas_service::balance`,
        arguments: [gasServiceConfig.objects.GasService],
        typeArguments: [`${SUI_PACKAGE_ID}::sui::SUI`],
    });
    const result = await balanceQuery.devInspect(walletAddress);
    const gasServiceBalance = bcs.U64.parse(new Uint8Array(result.results[0].returnValues[0][0]));

    // Check if the gas service balance is sufficient
    if (gasServiceBalance < unitAmount) {
        printError('Insufficient gas service balance', `${getFormattedAmount(gasServiceBalance)} < ${getFormattedAmount(unitAmount)}`);
        return;
    }

    const tx = new Transaction();
    tx.moveCall({
        target: `${gasServicePackageId}::gas_service::refund`,
        arguments: [
            tx.object(gasServiceConfig.objects.GasService),
            tx.object(gasServiceConfig.objects.OperatorCap),
            tx.pure(bcs.string().serialize(messageId).toBytes()), // Message ID for the contract call
            tx.pure.address(receiver), // Refund address
            tx.pure.u64(unitAmount), // Amount
        ],
        typeArguments: [`${SUI_PACKAGE_ID}::sui::SUI`],
    });

    await broadcast(client, keypair, tx, 'Gas Refunded', options);
}

async function processCommand(command, chain, args, options) {
    const [keypair, client] = getWallet(chain, options);

    await printWalletInfo(keypair, client, chain, options);

    if (!chain.contracts.GasService) {
        throw new Error('GasService contract not found');
    }

    await command(keypair, client, chain.contracts.GasService, args, options, chain.contracts);
}

async function mainProcessor(options, args, processor, command) {
    const config = loadConfig(options.env);
    const chain = getChainConfig(config.chains, options.chainName);
    await processor(command, chain, args, options);
    saveConfig(config, options.env);
}

if (require.main === module) {
    const program = new Command();

    program.name('gas-service').description('Interact with the gas service contract.');

    const payGasCmd = new Command()
        .command('payGas <destinationChain> <destinationAddress> <payload>')
        .description('Send a contract call with gas for it payed.')
        .option('--refundAddress <refundAddress>', 'Refund address. Default is the sender address.')
        .requiredOption('--amount <amount>', 'Amount to pay gas', parseSuiUnitAmount)
        .option('--channel <channel>', 'Existing channel ID to initiate a cross-chain message over')
        .option('--params <params>', 'Params. Default is empty.', '0x')
        .action((destinationChain, destinationAddress, payload, options) => {
            mainProcessor(options, [destinationChain, destinationAddress, payload], processCommand, payGas);
        });

    const addGasCmd = new Command()
        .command('addGas <message_id>')
        .description('Add gas for the existing contract call.')
        .option('--refundAddress <refundAddress>', 'Refund address.')
        .requiredOption('--amount <amount>', 'Amount to add gas', parseSuiUnitAmount)
        .option('--params <params>', 'Params. Default is empty.')
        .action((messageId, options) => {
            mainProcessor(options, [messageId], processCommand, addGas);
        });

    const collectGasCmd = new Command()
        .command('collectGas')
        .description('Collect gas from the gas service contract.')
        .option('--receiver <receiver>', 'Receiver address. Default is the sender address.')
        .requiredOption('--amount <amount>', 'Amount to collect gas', parseSuiUnitAmount)
        .action((options) => {
            mainProcessor(options, [], processCommand, collectGas);
        });

    const refundCmd = new Command()
        .command('refund <messageId>')
        .description('Refund gas from the gas service contract.')
        .option('--receiver <receiver>', 'Receiver address. Default is the sender address.')
        .requiredOption('--amount <amount>', 'Amount to refund gas', parseSuiUnitAmount)
        .action((messageId, options) => {
            mainProcessor(options, [messageId], processCommand, refund);
        });

    program.addCommand(payGasCmd);
    program.addCommand(addGasCmd);
    program.addCommand(collectGasCmd);
    program.addCommand(refundCmd);

    addOptionsToCommands(program, addBaseOptions);

    program.parse();
}
