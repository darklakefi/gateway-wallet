import * as dotenv from 'dotenv';
import { Keypair, Transaction } from '@solana/web3.js';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { WalletEmulatorConfig, SwapRequest, SwapResponse, SignedTransactionRequest, SignedTransactionResponse, Network, GrpcClient, CheckTradeStatusRequest, CheckTradeStatusResponse, TradeStatus } from './types';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Configuration
const config: WalletEmulatorConfig = {
    privateKeyBytes: process.env.PRIVATE_KEY_BYTES || '',
    gatewayHost: process.env.GATEWAY_HOST || 'localhost',
    gatewayPort: parseInt(process.env.GATEWAY_PORT || '50051'),
    tokenX: process.env.TOKEN_X_MINT || '',
    tokenY: process.env.TOKEN_Y_MINT || '',
    inputAmount: parseInt(process.env.INPUT_AMOUNT || '1000'),
    minOut: parseInt(process.env.MIN_OUT || '0'),
    network: parseInt(process.env.NETWORK || Network.DEVNET.toString(), 10),
    trackingId: "id" + Math.random().toString(16).slice(2),
};

// Load gRPC proto file
const PROTO_PATH = path.resolve(__dirname, '../proto/gateway.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const gatewayProto = grpc.loadPackageDefinition(packageDefinition) as any;

// Create gRPC client
function createGrpcClient(): GrpcClient {
    const { gateway_solana } = gatewayProto;

    const client = new gateway_solana.SolanaGatewayService(
        `${config.gatewayHost}:${config.gatewayPort}`,
        grpc.credentials.createInsecure()
    );

    return {
        swap: (request: SwapRequest): Promise<SwapResponse> => {
            return new Promise((resolve, reject) => {
                client.CreateUnsignedTransaction(request, (error: any, response: SwapResponse) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(response);
                    }
                });
            });
        },
        submitSignedTransaction: (request: SignedTransactionRequest): Promise<SignedTransactionResponse> => {
            return new Promise((resolve, reject) => {
                client.SendSignedTransaction(request, (error: any, response: SignedTransactionResponse) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(response);
                    }
                });
            });
        },
        checkTradeStatus: (request: CheckTradeStatusRequest): Promise<CheckTradeStatusResponse> => {
            return new Promise((resolve, reject) => {
                client.CheckTradeStatus(request, (error: any, response: CheckTradeStatusResponse) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(response);
                    }
                });
            });
        }
    };
}

async function executeWalletSwap(): Promise<void> {
    try {
        console.log('Starting wallet emulator...');
        
        // Load wallet from private key bytes
        console.log('Loading wallet from private key...');
        const privateKeyArray = JSON.parse(config.privateKeyBytes);
        const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
        const walletPublicKey = keypair.publicKey.toBase58();
        
        console.log('Wallet loaded with public key:', walletPublicKey);
        
        // Create gRPC client
        console.log('Connecting to gRPC gateway...');
        const grpcClient = createGrpcClient();
        
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
        };
        
        console.log('Making swap request to gateway...');
        console.log('Request parameters:', swapRequest);
        
        // Make gRPC request to get unsigned transaction
        const swapResponse: SwapResponse = await grpcClient.swap(swapRequest);
        
        console.log('Received unsigned transaction from gateway');
        
        // Decode and load the unsigned transaction
        // EXPECTS: { unsignedTransaction: string }; // Base64 encoded transaction
        const unsignedTransactionBuffer = Buffer.from(swapResponse.unsigned_transaction, 'base64');
        
        console.log('Signing transaction...');
        
        
        // Parse the JSON string from the buffer
        const transactionJson = unsignedTransactionBuffer;

        // Create transaction from the parsed JSON object
        const transaction = Transaction.from(transactionJson);
        transaction.sign(keypair);

        
        // Serialize the signed transaction
        const signedTransactionBase64 = transaction.serialize().toString('base64');
        
        console.log('Transaction signed successfully');
        
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
        
        await pollTransactionStatus(grpcClient, checkTxRequest);
        
        
    } catch (error) {
        console.error('❌ Error during wallet swap:', error);
        throw error;
    }
}

async function pollTransactionStatus(
    grpcClient: GrpcClient,
    checkTxRequest: CheckTradeStatusRequest,
    maxRetries: number = 4,
    delayMs: number = 500
): Promise<CheckTradeStatusResponse | undefined> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`Attempt ${i + 1}/${maxRetries}: Checking transaction status...`);
            const checkTxResponse: CheckTradeStatusResponse = await grpcClient.checkTradeStatus(checkTxRequest);

            if (checkTxResponse.status === TradeStatus.SETTLED || checkTxResponse.status === TradeStatus.SLASHED || checkTxResponse.status === TradeStatus.CANCELLED) {
                console.log('Trade status is final. Returning response.');
                return checkTxResponse;
            }

            console.log('Trade status:', checkTxResponse.status);

        } catch (error) {
            console.error(`Attempt ${i + 1}/${maxRetries}: Error checking trade status:`, error);
            // If it's the last attempt, re-throw the error or return undefined
            if (i === maxRetries - 1) {
                console.error("Max retries reached. Could not get a successful trade response.");
                return undefined;
            }
        }

        // Wait before the next attempt, unless it's the last attempt
        if (i < maxRetries - 1) {
            console.log(`Waiting ${delayMs}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return undefined;
}

// Main function
async function main() {
    console.log('🚀 Darklake Wallet Emulator');
    console.log('Configuration:', {
        gatewayHost: config.gatewayHost,
        gatewayPort: config.gatewayPort,
        tokenX: config.tokenX,
        tokenY: config.tokenY,
        inputAmount: config.inputAmount,
        minOut: config.minOut,
        network: config.network
    });
    
    try {
        await executeWalletSwap();
        console.log('✅ Wallet emulator completed successfully');
    } catch (error) {
        console.error('❌ Wallet emulator failed:', error);
        process.exit(1);
    }
    
    // Exit the program
    console.log('👋 Exiting...');
    process.exit(0);
}

// Start the wallet emulator
main(); 
