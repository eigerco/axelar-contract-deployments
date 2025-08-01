const { Command, Option } = require('commander');
const { Transaction } = require('@mysten/sui/transactions');
const { loadConfig, getChainConfig } = require('../common/utils');
const {
    addBaseOptions,
    addOptionsToCommands,
    parseSuiUnitAmount,
    getWallet,
    printWalletInfo,
    broadcast,
    findOwnedObjectIdByType,
    saveGeneratedTx,
} = require('./utils');
const { SUI_PACKAGE_ID } = require('@axelar-network/axelar-cgp-sui');

function operatorMoveCall(contractConfig, gasServiceConfig, operatorCapId, tx, moveCall) {
    const operatorId = contractConfig.objects.Operators;
    const gasCollectorCapId = gasServiceConfig.objects.OperatorCap;

    const [cap, borrowObj] = tx.moveCall({
        target: `${contractConfig.address}::operators::loan_cap`,
        arguments: [tx.object(operatorId), tx.object(operatorCapId), tx.object(gasCollectorCapId)],
        typeArguments: [`${gasServiceConfig.address}::operator_cap::OperatorCap`],
    });

    moveCall(cap);

    tx.moveCall({
        target: `${contractConfig.address}::operators::restore_cap`,
        arguments: [tx.object(operatorId), tx.object(operatorCapId), cap, borrowObj],
        typeArguments: [`${gasServiceConfig.address}::operator_cap::OperatorCap`],
    });

    return tx;
}

async function collectGas(keypair, client, gasServiceConfig, contractConfig, args, options) {
    const [amount] = args;
    const receiver = options.receiver || keypair.toSuiAddress();

    const operatorCapId = await findOwnedObjectIdByType(
        client,
        keypair.toSuiAddress(),
        `${contractConfig.address}::operators::OperatorCap`,
    );
    const tx = new Transaction();

    operatorMoveCall(contractConfig, gasServiceConfig, operatorCapId, tx, (cap) => {
        tx.moveCall({
            target: `${gasServiceConfig.address}::gas_service::collect_gas`,
            arguments: [tx.object(gasServiceConfig.objects.GasService), cap, tx.pure.address(receiver), tx.pure.u64(amount)],
            typeArguments: [`${SUI_PACKAGE_ID}::sui::SUI`],
        });
    });

    return {
        tx,
        message: 'Gas Collected',
    };
}

async function refund(keypair, client, gasServiceConfig, contractConfig, args, options) {
    const [messageId] = args;
    const amount = options.amount;
    const receiver = options.receiver || keypair.toSuiAddress();
    const operatorCapId = await findOwnedObjectIdByType(
        client,
        keypair.toSuiAddress(),
        `${contractConfig.address}::operators::OperatorCap`,
    );

    const tx = new Transaction();

    operatorMoveCall(contractConfig, gasServiceConfig, operatorCapId, tx, (cap) => {
        tx.moveCall({
            target: `${gasServiceConfig.address}::gas_service::refund`,
            arguments: [
                tx.object(gasServiceConfig.objects.GasService),
                cap,
                tx.pure.string(messageId),
                tx.pure.address(receiver),
                tx.pure.u64(amount),
            ],
            typeArguments: [`${SUI_PACKAGE_ID}::sui::SUI`],
        });
    });

    return {
        tx,
        message: 'Refunded Gas',
    };
}

async function storeCap(keypair, client, gasServiceConfig, contractConfig, args, options) {
    const [capId] = args;
    const operatorCapId = capId || gasServiceConfig.objects.OperatorCap;
    const ownerCapId = contractConfig.objects.OwnerCap;
    const operatorId = contractConfig.objects.Operators;

    const tx = new Transaction();

    tx.moveCall({
        target: `${contractConfig.address}::operators::store_cap`,
        arguments: [tx.object(operatorId), tx.object(ownerCapId), tx.object(operatorCapId)],
        typeArguments: [`${gasServiceConfig.address}::operator_cap::OperatorCap`],
    });

    return {
        tx,
        message: 'Stored Capability',
    };
}

async function addOperator(keypair, client, gasServiceConfig, contractConfig, args, options) {
    const [newOperatorAddress] = args;

    const operatorsObjectId = contractConfig.objects.Operators;
    const ownerCapObjectId = options.ownerCapId || contractConfig.objects.OwnerCap;

    const tx = new Transaction();

    tx.moveCall({
        target: `${contractConfig.address}::operators::add_operator`,
        arguments: [tx.object(operatorsObjectId), tx.object(ownerCapObjectId), tx.pure.address(newOperatorAddress)],
    });

    return {
        tx,
        message: 'Added Operator',
    };
}

async function removeCap(keypair, client, gasServiceConfig, contractConfig, args, options) {
    const [capId] = args;

    const gasServiceAddress = gasServiceConfig.address;
    const operatorsObjectId = contractConfig.objects.Operators;
    const ownerCapObjectId = options.ownerCapId || contractConfig.objects.OwnerCap;
    const capReceiver = options.receiver || keypair.toSuiAddress();

    const tx = new Transaction();

    const cap = tx.moveCall({
        target: `${contractConfig.address}::operators::remove_cap`,
        arguments: [tx.object(operatorsObjectId), tx.object(ownerCapObjectId), tx.object(capId)],
        typeArguments: [`${gasServiceAddress}::operator_cap::OperatorCap`],
    });

    tx.transferObjects([cap], capReceiver);

    return {
        tx,
        message: 'Removed Capability',
    };
}

async function removeOperator(keypair, client, gasServiceConfig, contractConfig, args, options) {
    const [operatorAddress] = args;

    const operatorsObjectId = contractConfig.objects.Operators;
    const ownerCapObjectId = options.ownerCapId || contractConfig.objects.OwnerCap;

    const tx = new Transaction();

    tx.moveCall({
        target: `${contractConfig.address}::operators::remove_operator`,
        arguments: [tx.object(operatorsObjectId), tx.object(ownerCapObjectId), tx.pure.address(operatorAddress)],
    });

    return {
        tx,
        message: 'Removed Operator',
    };
}

async function mainProcessor(processor, args, options) {
    const config = loadConfig(options.env);

    const chain = getChainConfig(config.chains, options.chainName);
    const contractConfig = chain.contracts.Operators;
    const gasServiceConfig = chain.contracts.GasService;

    if (!contractConfig) {
        throw new Error('Operators package not found.');
    }

    if (!gasServiceConfig) {
        throw new Error('Gas service package not found.');
    }

    const [keypair, client] = getWallet(chain, options);
    await printWalletInfo(keypair, client, chain, options);

    const { tx, message } = await processor(keypair, client, gasServiceConfig, contractConfig, args, options);

    if (options.offline) {
        const sender = options.sender || keypair.toSuiAddress();
        tx.setSender(sender);
        await saveGeneratedTx(tx, message, client, options);
    } else {
        await broadcast(client, keypair, tx, message, options);
    }
}

if (require.main === module) {
    const program = new Command('operators');

    program.description('Operators contract operations.');

    program.addCommand(
        new Command('add')
            .command('add <newOperatorAddress>')
            .description('Add an operator')
            .addOption(new Option('--ownerCap <ownerCapId>', 'ID of the owner capability'))
            .action((newOperatorAddress, options) => mainProcessor(addOperator, [newOperatorAddress], options)),
    );

    program.addCommand(
        new Command('remove')
            .command('remove <operatorAddress>')
            .description('Remove an operator')
            .addOption(new Option('--ownerCap <ownerCapId>', 'ID of the owner capability'))
            .action((operatorAddress, options) => mainProcessor(removeOperator, [operatorAddress], options)),
    );

    program.addCommand(
        new Command('collectGas')
            .command('collectGas')
            .description('Collect gas from the gas service')
            .addOption(new Option('--receiver <receiver>', 'Address of the receiver'))
            .requiredOption('--amount <amount>', 'Amount to add gas', parseSuiUnitAmount)
            .action((options) => mainProcessor(collectGas, [options.amount], options)),
    );

    program.addCommand(
        new Command('storeCap')
            .command('storeCap')
            .description('Store a capability')
            .addOption(new Option('--capId <capId>', 'ID of the capability to store'))
            .action((options) => mainProcessor(storeCap, [], options)),
    );

    program.addCommand(
        new Command('removeCap')
            .command('removeCap <capId>')
            .description('Remove a capability')
            .addOption(new Option('--ownerCap <ownerCapId>', 'ID of the owner capability'))
            .addOption(new Option('--receiver <receiver>', 'The removed cap receiver address'))
            .action((capId, options) => mainProcessor(removeCap, [capId], options)),
    );

    program.addCommand(
        new Command('refund')
            .command('refund <messageId>')
            .description('Refund gas from the gas service')
            .addOption(new Option('--receiver <receiver>', 'Address of the receiver'))
            .requiredOption('--amount <amount>', 'Amount to refund', parseSuiUnitAmount)
            .action((messageId, options) => mainProcessor(refund, [messageId], options)),
    );

    addOptionsToCommands(program, addBaseOptions, { offline: true });

    program.parse();
}
