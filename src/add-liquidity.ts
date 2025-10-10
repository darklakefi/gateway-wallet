import { AddLiquidityRequest, AddLiquidityResponse, Network } from './types';
import { createGrpcClient, loadWallet, signTransaction, createConnection, broadcastTransaction, waitForConfirmation } from './utils';
import { executeMain, loadConfig } from './index';

async function executeAddLiquidity(): Promise<void> {
    try {
        console.log('Starting AddLiquidity request...');
        
        // Load configuration and wallet
        const config = loadConfig();
        const { keypair, publicKey: walletPublicKey } = loadWallet(config.privateKeyBytes);
        
        // Create gRPC client
        console.log('Connecting to gRPC gateway...');
        const grpcClient = createGrpcClient(config);
        
        // Prepare add liquidity request
        const addLiquidityRequest: AddLiquidityRequest = {
            token_mint_x: config.tokenX,
            token_mint_y: config.tokenY,
            user_address: walletPublicKey,
            amount_lp: config.amountLp, // LP token amount to mint
            max_amount_x: config.maxAmountX, // Maximum amount of token X to add
            max_amount_y: config.maxAmountY, // Maximum amount of token Y to add
            ref_code: config.refCode,
            label: config.label,
        };
        
        console.log('Making AddLiquidity request to gateway...');
        console.log('Request parameters:', addLiquidityRequest);
        
        // Make gRPC request to get unsigned transaction
        const addLiquidityResponse: AddLiquidityResponse = await grpcClient.addLiquidity(addLiquidityRequest);
        
        console.log(addLiquidityResponse);

        console.log('Received unsigned transaction from gateway');
        
        // Sign the transaction
        const signedTransactionBase64 = signTransaction(addLiquidityResponse.unsigned_transaction, keypair);
        
        // Create Solana connection
        const connection = createConnection(config.network);
        
        // Broadcast the signed transaction to the blockchain
        const signature = await broadcastTransaction(signedTransactionBase64, connection, config.network);
        
        // Wait for confirmation
        await waitForConfirmation(signature, connection);
        
    } catch (error) {
        console.error('❌ Error during AddLiquidity execution:', error);
        throw error;
    }
}

// Start the script
executeMain('AddLiquidity Script', executeAddLiquidity);
