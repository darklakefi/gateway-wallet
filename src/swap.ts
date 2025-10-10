import { SwapRequest, SwapResponse, SignedTransactionRequest, SignedTransactionResponse, Network, GrpcClient, CheckTradeStatusRequest, GetTradesListByUserRequest, GetTradesListByUserResponse } from './types';
import { createGrpcClient, loadWallet, signTransaction, pollTransactionStatus } from './utils';
import { executeMain, loadConfig } from './index';

async function executeWalletSwap(): Promise<void> {
    try {
        console.log('Starting wallet emulator...');
        
        // Load configuration and wallet
        const config = loadConfig();
        const { keypair, publicKey: walletPublicKey } = loadWallet(config.privateKeyBytes);
        
        // Create gRPC client
        console.log('Connecting to gRPC gateway...');
        const grpcClient = createGrpcClient(config);
        
        // Prepare swap request
        const swapRequest: SwapRequest = {
            user_address: walletPublicKey,
            token_mint_x: config.tokenX,
            token_mint_y: config.tokenY,
            amount_in: config.inputAmount,
            min_out: config.minOut,
            is_swap_x_to_y: true,
            network: Network.DEVNET, // config.network,
            tracking_id: config.trackingId,
            ref_code: config.refCode,
            label: config.label,
        };
        
        console.log('Making swap request to gateway...');
        console.log('Request parameters:', swapRequest);
        
        // Make gRPC request to get unsigned transaction
        const swapResponse: SwapResponse = await grpcClient.swap(swapRequest);
        
        console.log('Received unsigned transaction from gateway');
        
        // Sign the transaction
        const signedTransactionBase64 = signTransaction(swapResponse.unsigned_transaction, keypair);
        
        // Prepare signed transaction request
        const signedTxRequest: SignedTransactionRequest = {
            signed_transaction: signedTransactionBase64,
            trade_id: swapResponse.trade_id,
            tracking_id: config.trackingId,
        };
        // Send the signed transaction to the Solana network
        console.log('Sending signed transaction to Solana network...');


        console.log('Submitting signed transaction to gateway...');
        
        // Submit signed transaction
        const signedTxResponse: SignedTransactionResponse = await grpcClient.submitSignedTransaction(signedTxRequest);
        
        
        if (signedTxResponse.success) {
            console.log('✅ Swap completed successfully!');
        } else {
            console.log('❌ Swap failed:', signedTxResponse);
        }
        
        console.log('Checking transaction status...');

        const checkTxRequest: CheckTradeStatusRequest = {
            tracking_id: config.trackingId,
            trade_id: swapResponse.trade_id,
        };
        
        await pollTransactionStatus(grpcClient, checkTxRequest, 5, 1000);

        const getTradesRequest: GetTradesListByUserRequest = {
            user_address: walletPublicKey,
            page_size: 10,
            page_number: 1,
        };
        
        const getTradesResponse: GetTradesListByUserResponse = await grpcClient.getTradesListByUser(getTradesRequest);
        
        console.log('Trades list:');
        console.dir(getTradesResponse, { depth: null });
        
    } catch (error) {
        console.error('❌ Error during wallet swap:', error);
        throw error;
    }
}


// Start the wallet emulator
executeMain('Wallet Emulator', executeWalletSwap); 
