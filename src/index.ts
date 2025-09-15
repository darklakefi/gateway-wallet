import * as dotenv from 'dotenv';
import { Keypair, VersionedTransaction, VersionedMessage } from '@solana/web3.js';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { WalletEmulatorConfig, SwapRequest, SwapResponse, SignedTransactionRequest, SignedTransactionResponse, Network, GrpcClient, CheckTradeStatusRequest, CheckTradeStatusResponse, TradeStatus, GetTradesListByUserRequest, GetTradesListByUserResponse } from './types';
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
    refCode: process.env.REF_CODE || '',
    label: process.env.LABEL || '',
};

// Load gRPC proto file
const PROTO_PATH = path.resolve(__dirname, '../proto/darklake/v1/api.proto');

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
    const { v1 } = gatewayProto.darklake;

    const client = new v1.SolanaGatewayService(
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
        },
        getTradesListByUser: (request: GetTradesListByUserRequest): Promise<GetTradesListByUserResponse> => {
            return new Promise((resolve, reject) => {
                client.GetTradesListByUser(request, (error: any, response: GetTradesListByUserResponse) => {
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
            ref_code: config.refCode,
            label: config.label,
        };
        
        console.log('Making swap request to gateway...');
        console.log('Request parameters:', swapRequest);
        
        // Make gRPC request to get unsigned transaction
        const swapResponse: SwapResponse = await grpcClient.swap(swapRequest);
        
        console.log('Received unsigned transaction from gateway');
        
        // Decode and load the unsigned transaction
        // EXPECTS: { unsignedTransaction: string }; // Base64 encoded transaction
        const unsignedTransactionBuffer = Buffer.from(swapResponse.unsigned_transaction, 'base64');
        
        console.log('Transaction buffer length:', unsignedTransactionBuffer.length);
        
        console.log('Signing transaction...');
        
        // Try different approaches to deserialize the transaction
        let versionedTransaction: VersionedTransaction;
        
        try {
            // First try: Direct VersionedTransaction deserialization
            console.log('Trying direct VersionedTransaction.deserialize...');
            versionedTransaction = VersionedTransaction.deserialize(unsignedTransactionBuffer);
            console.log('Successfully deserialized as VersionedTransaction directly');
        } catch (error1) {
            console.log('Direct VersionedTransaction failed:', error1 instanceof Error ? error1.message : String(error1));
            
            try {
                // Second try: VersionedMessage deserialization
                console.log('Trying VersionedMessage.deserialize...');
        const versionedMessage = VersionedMessage.deserialize(unsignedTransactionBuffer);
                console.log('Successfully deserialized as VersionedMessage');
                
                // Create a VersionedTransaction with the deserialized message and empty signatures
                const signatures = new Array(versionedMessage.header.numRequiredSignatures).fill(null);
                versionedTransaction = new VersionedTransaction(versionedMessage, signatures);
                console.log('Created VersionedTransaction from VersionedMessage with empty signatures');
            } catch (error2) {
                console.log('VersionedMessage deserialization failed:', error2 instanceof Error ? error2.message : String(error2));
                
                try {
                    // Third try: Legacy Transaction
                    console.log('Trying legacy Transaction.from...');
                    const { Transaction } = await import('@solana/web3.js');
                    const legacyTransaction = Transaction.from(unsignedTransactionBuffer);
                    console.log('Successfully deserialized as legacy Transaction');
                    
                    // Sign the legacy transaction
                    legacyTransaction.sign(keypair);
                    
                    // Serialize the signed transaction
                    const signedTransactionBase64 = legacyTransaction.serialize().toString('base64');
                    
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
                    
                    await pollTransactionStatus(grpcClient, checkTxRequest, 5, 1000);
                    return;
                } catch (error3) {
                    console.log('Legacy Transaction deserialization failed:', error3 instanceof Error ? error3.message : String(error3));
                    
                    // Fourth try: Manual parsing approach
                    try {
                        console.log('Trying manual parsing approach...');
                        
                        // The gateway is sending us just the message part, not a complete transaction
                        // We need to manually parse the message and create a proper VersionedTransaction
                        
                        console.log('Gateway sent message-only transaction, trying to construct VersionedTransaction...');
                        
                        // Let's try to manually construct a VersionedTransaction
                        // The structure should be: [signatures][message]
                        // But we're getting just the message part
                        
                        // The issue might be that we're not correctly parsing the versioned message
                        // Let's try to parse the message directly first
                        try {
                            console.log('Trying to parse the message directly...');
                            
                            // The buffer we received might be just the message part
                            // Let's try to parse it as a VersionedMessage first
                            const message = VersionedMessage.deserialize(unsignedTransactionBuffer);
                            console.log('Successfully parsed as VersionedMessage');
                            console.log('Message header:', message.header);
                            console.log('Message account keys count:', message.staticAccountKeys.length);
                            console.log('Message type:', message.constructor.name);
                            
                            // Now create a VersionedTransaction with this message
                            const signatures = new Array(message.header.numRequiredSignatures).fill(null);
                            versionedTransaction = new VersionedTransaction(message, signatures);
                            console.log('Successfully created VersionedTransaction from parsed message');
                            
                        } catch (parseError) {
                            console.log('Direct message parsing failed:', parseError instanceof Error ? parseError.message : String(parseError));
                            
                            // Let's try the original approach with empty signatures
                            console.log('Trying with empty signatures approach...');
                            
                            // Create a buffer that includes empty signatures
                            const numSignatures = 1; // We expect 1 signature
                            const signatureLength = 64; // Each signature is 64 bytes
                            const totalSignatureLength = numSignatures * signatureLength;
                            
                            // Create a new buffer: [empty_signatures][message]
                            const fullTransactionBuffer = Buffer.alloc(totalSignatureLength + unsignedTransactionBuffer.length);
                            
                            // Fill with empty signatures first
                            fullTransactionBuffer.fill(0, 0, totalSignatureLength);
                            
                            // Then add the message
                            unsignedTransactionBuffer.copy(fullTransactionBuffer, totalSignatureLength);
                            
                            console.log('Created full transaction buffer with empty signatures');
                            
                            // Try to deserialize this
                            versionedTransaction = VersionedTransaction.deserialize(fullTransactionBuffer);
                            console.log('Successfully deserialized manually constructed VersionedTransaction');
                        }
                        
                    } catch (error4) {
                        console.log('Manual parsing failed:', error4 instanceof Error ? error4.message : String(error4));
                        
                        // Final attempt: Let's try to understand what the gateway actually sent us
                        console.log('Analyzing transaction structure...');
                        console.log('Transaction appears to be a versioned message without signatures');
                        console.log('This suggests the gateway is sending us an unsigned message that needs to be wrapped in a transaction');
                        
                        // Maybe we need to create a new transaction from scratch using the message
                        // But first, let's see if we can extract any useful information
                        
                        throw new Error('Unable to deserialize transaction - gateway may be sending unsupported format');
                    }
                }
            }
        }
        
        // Check if our wallet is in the required signers
        const walletPubKey = keypair.publicKey;
        const requiredSigners = versionedTransaction.message.staticAccountKeys.slice(0, versionedTransaction.message.header.numRequiredSignatures);
        const isWalletRequiredSigner = requiredSigners.some(key => key.equals(walletPubKey));
        
        if (!isWalletRequiredSigner) {
            // If the transaction has no required signatures, we might not need to sign it
            if (versionedTransaction.message.header.numRequiredSignatures === 0) {
                console.log('Transaction has no required signatures, proceeding without signing...');
            } else {
                console.log('Transaction requires signatures but wallet is not a signer');
                throw new Error('Cannot sign transaction - wallet is not a required signer');
            }
        } else {
            // Sign the versioned transaction
            console.log('Signing transaction with wallet keypair...');
            versionedTransaction.sign([keypair]);
        }
        
        // Serialize the signed transaction
        const signedTransactionBase64 = Buffer.from(versionedTransaction.serialize()).toString('base64');
        
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
        network: config.network,
        refCode: config.refCode,
        label: config.label,
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
