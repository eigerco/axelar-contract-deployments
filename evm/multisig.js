'use strict';

const { ethers } = require('hardhat');
const {
    getDefaultProvider,
    utils: { keccak256, formatEther },
    Contract,
    BigNumber,
} = ethers;
const { Command, Option } = require('commander');
const {
    printInfo,
    printWalletInfo,
    isNumber,
    isValidCalldata,
    printWarn,
    isNonEmptyStringArray,
    isNumberArray,
    isValidAddress,
    mainProcessor,
    isValidDecimal,
    prompt,
    isBytes32Array,
    getGasOptions,
} = require('./utils');
const { addBaseOptions } = require('./cli-utils');
const IMultisig = require('@axelar-network/axelar-gmp-sdk-solidity/interfaces/IMultisig.json');
const AxelarGateway = require('@axelar-network/axelar-cgp-solidity/artifacts/contracts/AxelarGateway.sol/AxelarGateway.json');
const IGovernance = require('@axelar-network/axelar-gmp-sdk-solidity/interfaces/IAxelarServiceGovernance.json');
const IInterchainTokenService = require('@axelar-network/interchain-token-service/interfaces/IInterchainTokenService.json');
const ITokenManager = require('@axelar-network/interchain-token-service/interfaces/ITokenManager.json');
const IOperator = require('@axelar-network/interchain-token-service/interfaces/IOperator.json');
const { parseEther } = require('ethers/lib/utils');
const { getWallet, signTransaction, storeSignedTx } = require('./sign-utils');

async function preExecutionChecks(multisigContract, action, wallet, target, calldata, nativeValue, yes) {
    const address = await wallet.getAddress();
    const isSigner = await multisigContract.isSigner(address);

    if (!isSigner) {
        throw new Error(`Caller ${address} is not an authorized multisig signer.`);
    }

    let topic;

    if (action === 'withdraw') {
        topic = multisigContract.interface.encodeFunctionData('withdraw', [target, nativeValue]);
    } else if (action === 'executeMultisigProposal') {
        topic = multisigContract.interface.encodeFunctionData('executeMultisigProposal', [target, calldata, nativeValue]);
    } else {
        topic = multisigContract.interface.encodeFunctionData('executeContract', [target, calldata, nativeValue]);
    }

    const topicHash = keccak256(topic);
    const voteCount = await multisigContract.getSignerVotesCount(topicHash);

    if (voteCount.eq(0)) {
        printWarn(`The vote count for this topic is zero. This action will create a new multisig proposal.`);

        if (prompt(`Proceed with ${action}?`, yes)) {
            return;
        }
    }

    const hasVoted = await multisigContract.hasSignerVoted(address, topicHash);

    if (hasVoted) {
        throw new Error(`Signer ${address} has already voted on this proposal.`);
    }

    const threshold = await multisigContract.signerThreshold();

    if (voteCount.eq(threshold.sub(1))) {
        printWarn(`The vote count is one below the threshold. This action will execute the multisig proposal.`);

        if (prompt(`Proceed with ${action}?`, yes)) {
            // implicit return
        }
    }
}

async function processCommand(_axelar, chain, _chains, options) {
    const {
        env,
        contractName,
        address,
        action,
        symbols,
        tokenIds,
        limits,
        mintLimiter,
        recipient,
        target,
        calldata,
        nativeValue,
        withdrawAmount,
        privateKey,
        yes,
        offline,
    } = options;

    const contracts = chain.contracts;
    const contractConfig = contracts[contractName];

    let multisigAddress;

    if (isValidAddress(address)) {
        multisigAddress = address;
    } else {
        if (!contractConfig?.address) {
            throw new Error(`Contract ${contractName} is not deployed on ${chain.name}`);
        }

        multisigAddress = contractConfig.address;
    }

    const rpc = chain.rpc;
    const provider = getDefaultProvider(rpc);

    const wallet = await getWallet(privateKey, provider, options);
    const { address: walletAddress } = await printWalletInfo(wallet, options);

    printInfo('Contract name', contractName);
    printInfo('Contract address', multisigAddress);

    const multisigContract = new Contract(multisigAddress, IMultisig.abi, wallet);

    const gasOptions = await getGasOptions(chain, options, contractName);

    printInfo('Multisig Action', action);

    if (prompt(`Proceed with action ${action} on chain ${chain.name}?`, yes)) {
        return;
    }

    let tx;

    switch (action) {
        case 'signers': {
            const signerEpoch = await multisigContract.signerEpoch();
            const signers = await multisigContract.signerAccounts();
            const signerThreshold = await multisigContract.signerThreshold();

            printInfo('Signer epoch', signerEpoch);
            printInfo('Signer threshold', signerThreshold);
            printInfo('Signers', signers);

            return;
        }

        case 'setTokenMintLimits': {
            const symbolsArray = JSON.parse(symbols);
            const limitsArray = JSON.parse(limits);

            if (!isNonEmptyStringArray(symbolsArray)) {
                throw new Error(`Invalid token symbols: ${symbols})}`);
            }

            if (!isNumberArray(limitsArray)) {
                throw new Error(`Invalid token limits: ${limits}`);
            }

            if (symbolsArray.length !== limitsArray.length) {
                throw new Error('Token symbols and token limits length mismatch');
            }

            const multisigTarget = chain.contracts.AxelarGateway?.address;

            if (!isValidAddress(multisigTarget)) {
                throw new Error(`Missing AxelarGateway address in the chain info.`);
            }

            const gateway = new Contract(multisigTarget, AxelarGateway.abi, wallet);
            const multisigCalldata = gateway.interface.encodeFunctionData('setTokenMintLimits', [symbolsArray, limitsArray]);

            printInfo('Rate limit tokens', symbolsArray);
            printInfo('Rate limit values', limitsArray);

            if (!offline) {
                await preExecutionChecks(multisigContract, action, wallet, multisigTarget, multisigCalldata, 0, yes);

                // loop over each token
                for (let i = 0; i < symbolsArray.length; i++) {
                    const token = await gateway.tokenAddresses(symbolsArray[i]);
                    const limit = await gateway.tokenMintLimit(symbolsArray[i]);
                    printInfo(`Token ${symbolsArray[i]} address`, token);
                    printInfo(`Token ${symbolsArray[i]} limit`, limit);
                }
            }

            tx = await multisigContract.populateTransaction.executeContract(multisigTarget, multisigCalldata, 0, gasOptions);
            break;
        }

        case 'transferMintLimiter': {
            if (!isValidAddress(mintLimiter)) {
                throw new Error(`Invalid new mint limiter address: ${mintLimiter}`);
            }

            const multisigTarget = chain.contracts.AxelarGateway?.address;

            if (!isValidAddress(multisigTarget)) {
                throw new Error(`Missing AxelarGateway address in the chain info.`);
            }

            const gateway = new Contract(multisigTarget, AxelarGateway.abi, wallet);
            const multisigCalldata = gateway.interface.encodeFunctionData('transferMintLimiter', [mintLimiter]);

            if (!offline) {
                await preExecutionChecks(multisigContract, action, wallet, multisigTarget, multisigCalldata, 0, yes);
            }

            tx = await multisigContract.populateTransaction.executeContract(multisigTarget, multisigCalldata, 0);
            break;
        }

        case 'withdraw': {
            if (!isValidAddress(recipient)) {
                throw new Error(`Invalid recipient address: ${recipient}`);
            }

            if (!isValidDecimal(withdrawAmount)) {
                throw new Error(`Invalid withdraw amount: ${withdrawAmount}`);
            }

            const amount = parseEther(withdrawAmount);

            if (!offline) {
                await preExecutionChecks(multisigContract, action, wallet, recipient, '0x', amount, yes);

                const balance = await provider.getBalance(multisigContract.address);

                if (balance.lt(amount)) {
                    throw new Error(
                        `Contract balance ${formatEther(BigNumber.from(balance))} is less than withdraw amount: ${formatEther(
                            BigNumber.from(amount),
                        )}`,
                    );
                }
            }

            tx = await multisigContract.populateTransaction.withdraw(recipient, amount);
            break;
        }

        case 'executeMultisigProposal': {
            if (!isValidAddress(target)) {
                throw new Error(`Invalid target for execute multisig proposal: ${target}`);
            }

            if (!isValidCalldata(calldata)) {
                throw new Error(`Invalid calldata for execute multisig proposal: ${calldata}`);
            }

            if (calldata === '0x') {
                printWarn(`Calldata for execute multisig proposal is empty.`);

                if (prompt(`Proceed with ${action}?`, yes)) {
                    return;
                }
            }

            if (!isNumber(parseFloat(nativeValue))) {
                throw new Error(`Invalid native value for execute multisig proposal: ${nativeValue}`);
            }

            const governance = chain.contracts.AxelarServiceGovernance?.address;

            if (!isValidAddress(governance)) {
                throw new Error(`Missing AxelarServiceGovernance address in the chain info.`);
            }

            const governanceContract = new Contract(governance, IGovernance.abi, wallet);

            if (!offline) {
                await preExecutionChecks(governanceContract, action, wallet, target, calldata, nativeValue, yes);

                const balance = await provider.getBalance(governance);

                if (balance.lt(nativeValue)) {
                    throw new Error(
                        `AxelarServiceGovernance balance ${formatEther(
                            BigNumber.from(balance),
                        )} is less than native value amount: ${formatEther(BigNumber.from(nativeValue))}`,
                    );
                }
            }

            tx = await governanceContract.populateTransaction.executeMultisigProposal(target, calldata, nativeValue);
            break;
        }

        case 'setFlowLimits': {
            const tokenIdsArray = JSON.parse(tokenIds);
            const limitsArray = JSON.parse(limits);

            if (!isBytes32Array(tokenIdsArray)) {
                throw new Error(`Invalid token symbols: ${tokenIds}`);
            }

            if (!isNumberArray(limitsArray)) {
                throw new Error(`Invalid token limits: ${limits}`);
            }

            if (tokenIdsArray.length !== limitsArray.length) {
                throw new Error('Token ids and token flow limits length mismatch');
            }

            const multisigTarget = chain.contracts.InterchainTokenService?.address;

            if (!isValidAddress(multisigTarget)) {
                throw new Error(`Missing InterchainTokenService address in the chain info.`);
            }

            const its = new Contract(multisigTarget, IInterchainTokenService.abi, wallet);
            const multisigCalldata = its.interface.encodeFunctionData('setFlowLimits', [tokenIdsArray, limitsArray]);

            printInfo('Token Ids', tokenIdsArray);
            printInfo('FLow limit values', limitsArray);

            if (!offline) {
                await preExecutionChecks(multisigContract, action, wallet, multisigTarget, multisigCalldata, 0, yes);
                const operatable = new Contract(multisigTarget, IOperator.abi, wallet);
                const hasOperatorRole = await operatable.isOperator(multisigAddress);

                if (!hasOperatorRole) {
                    throw new Error('Missing Operator role for the used multisig address.');
                }

                // loop over each token
                for (let i = 0; i < tokenIdsArray.length; ++i) {
                    const tokenManagerAddress = await its.validTokenManagerAddress(tokenIdsArray[i]);
                    const tokenManager = new Contract(tokenManagerAddress, ITokenManager.abi, wallet);
                    const currentFlowLimit = await tokenManager.flowLimit();
                    printInfo(`TokenManager address`, tokenManagerAddress);
                    printInfo(`TokenManager current flowLimit`, currentFlowLimit);
                }
            }

            tx = await multisigContract.populateTransaction.executeContract(multisigTarget, multisigCalldata, 0, gasOptions);
            break;
        }
    }

    const { baseTx, signedTx } = await signTransaction(wallet, chain, tx, options);

    if (offline) {
        const filePath = `./tx/signed-tx-${env}-multisig-${action}-${chain.name.toLowerCase()}-address-${walletAddress}-nonce-${
            baseTx.nonce
        }.json`;
        printInfo(`Storing signed Tx offline in file ${filePath}`);

        // Storing the fields in the data that will be stored in file
        const data = {
            msg: `This transaction will perform multisig action ${action} on chain ${chain.name}`,
            unsignedTx: baseTx,
            signedTx,
            status: 'PENDING',
        };

        storeSignedTx(filePath, data);
    }
}

async function main(options) {
    await mainProcessor(options, processCommand, false);
}

if (require.main === module) {
    const program = new Command();

    program.name('multisig').description('Script to manage multisig actions');

    addBaseOptions(program, { address: true });

    program.addOption(new Option('-c, --contractName <contractName>', 'contract name').default('Multisig').makeOptionMandatory(false));
    program.addOption(
        new Option('--action <action>', 'multisig action')
            .choices(['signers', 'setTokenMintLimits', 'transferMintLimiter', 'withdraw', 'executeMultisigProposal', 'setFlowLimits'])
            .makeOptionMandatory(true),
    );
    program.addOption(new Option('--offline', 'run script in offline mode'));
    program.addOption(new Option('--nonceOffset <nonceOffset>', 'The value to add in local nonce if it deviates from actual wallet nonce'));

    // options for setTokenMintLimits
    program.addOption(new Option('--symbols <symbols>', 'token symbols').makeOptionMandatory(false));
    program.addOption(new Option('--limits <limits>', 'token limits').makeOptionMandatory(false));

    // option for transferMintLimiter
    program.addOption(new Option('--mintLimiter <mintLimiter>', 'new mint limiter address').makeOptionMandatory(false));

    // options for withdraw
    program.addOption(new Option('--recipient <recipient>', 'withdraw recipient address').makeOptionMandatory(false));
    program.addOption(new Option('--withdrawAmount <withdrawAmount>', 'withdraw amount').makeOptionMandatory(false));

    // options for executeMultisigProposal
    program.addOption(new Option('--target <target>', 'execute multisig proposal target').makeOptionMandatory(false));
    program.addOption(new Option('--calldata <calldata>', 'execute multisig proposal calldata').makeOptionMandatory(false));
    program.addOption(
        new Option('--nativeValue <nativeValue>', 'execute multisig proposal nativeValue').makeOptionMandatory(false).default(0),
    );

    // option for setFlowLimit in ITS
    program.addOption(new Option('--tokenIds <tokenIds>', 'token ids'));

    program.action((options) => {
        main(options);
    });

    program.parse();
}
