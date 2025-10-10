import { QuoteAddLiquidityRequest, QuoteAddLiquidityResponse } from './types';
import { createGrpcClient, loadWallet } from './utils';
import { executeMain, loadConfig } from './index';

async function executeQuoteAddLiquidity(): Promise<void> {
    try {
        console.log('Starting QuoteAddLiquidity request...');
        
        // Load configuration and wallet
        const config = loadConfig();
        const { publicKey: walletPublicKey } = loadWallet(config.privateKeyBytes);
        
        // Create gRPC client
        console.log('Connecting to gRPC gateway...');
        const grpcClient = createGrpcClient(config);
        
        // Prepare quote add liquidity request
        const quoteAddLiquidityRequest: QuoteAddLiquidityRequest = {
            token_mint_x: config.tokenX,
            token_mint_y: config.tokenY,
            token_x_amount: config.inputAmount,
            token_y_amount: config.inputAmount, // Using same amount for both tokens as example
            slippage_tolerance: 0, // 0.1% slippage tolerance (1000 = 0.1%)
        };
        
        console.log(quoteAddLiquidityRequest);

        console.log('Making QuoteAddLiquidity request to gateway...');
        console.log('Request parameters:', quoteAddLiquidityRequest);
        
        // Make gRPC request to get quote
        const quoteResponse: QuoteAddLiquidityResponse = await grpcClient.quoteAddLiquidity(quoteAddLiquidityRequest);
        
        console.log('✅ QuoteAddLiquidity response received:');
        console.log('LP Token Amount:', quoteResponse.lp_token_amount);
        console.log('LP Token Decimals:', quoteResponse.lp_token_decimals);
        console.log('LP Token Amount Display:', quoteResponse.lp_token_amount_display);
        
    } catch (error) {
        console.error('❌ Error during QuoteAddLiquidity request:', error);
        throw error;
    }
}

// Start the script
executeMain('QuoteAddLiquidity Script', executeQuoteAddLiquidity);
