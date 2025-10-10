import { Keypair, VersionedMessage, VersionedTransaction, Connection } from '@solana/web3.js';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { WalletEmulatorConfig, Network, GrpcClient, CheckTradeStatusRequest, CheckTradeStatusResponse, TradeStatus } from './types';
import * as path from 'path';

// Solana RPC endpoints
export const RPC_ENDPOINTS = {
    [Network.MAINNET]: 'https://api.mainnet-beta.solana.com',
    [Network.TESTNET]: 'https://api.testnet.solana.com',
    [Network.DEVNET]: 'https://api.devnet.solana.com',
};


/**
 * Load gRPC proto file and create gateway proto
 */
export function loadGatewayProto() {
    const PROTO_PATH = path.resolve(__dirname, '../proto/darklake/v1/api.proto');
    
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    });

    return grpc.loadPackageDefinition(packageDefinition) as any;
}

/**
 * Create gRPC client with all service methods
 */
export function createGrpcClient(config: WalletEmulatorConfig): GrpcClient {
    const gatewayProto = loadGatewayProto();
    const { v1 } = gatewayProto.darklake;

    const client = new v1.SolanaGatewayService(
        `${config.gatewayHost}:${config.gatewayPort}`,
        grpc.credentials.createInsecure()
    );

    return {
        swap: (request: any): Promise<any> => {
            return new Promise((resolve, reject) => {
                client.CreateUnsignedTransaction(request, (error: any, response: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(response);
                    }
                });
            });
        },
        submitSignedTransaction: (request: any): Promise<any> => {
            return new Promise((resolve, reject) => {
                client.SendSignedTransaction(request, (error: any, response: any) => {
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
        getTradesListByUser: (request: any): Promise<any> => {
            return new Promise((resolve, reject) => {
                client.GetTradesListByUser(request, (error: any, response: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(response);
                    }
                });
            });
        },
        quoteAddLiquidity: (request: any): Promise<any> => {
            return new Promise((resolve, reject) => {
                client.QuoteAddLiquidity(request, (error: any, response: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(response);
                    }
                });
            });
        },
        addLiquidity: (request: any): Promise<any> => {
            return new Promise((resolve, reject) => {
                client.AddLiquidity(request, (error: any, response: any) => {
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

/**
 * Load wallet from private key bytes
 */
export function loadWallet(privateKeyBytes: string): { keypair: Keypair; publicKey: string } {
    console.log('Loading wallet from private key...');
    const privateKeyArray = JSON.parse(privateKeyBytes);
    const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    const walletPublicKey = keypair.publicKey.toBase58();
    
    console.log('Wallet loaded with public key:', walletPublicKey);
    
    return { keypair, publicKey: walletPublicKey };
}

/**
 * Sign a transaction with the provided keypair
 */
export function signTransaction(unsignedTransactionBase64: string, keypair: Keypair): string {
    console.log('Signing transaction...');
    
    // Decode and load the unsigned transaction
    const unsignedTransactionBuffer = Buffer.from(unsignedTransactionBase64, 'base64');
    const message = unsignedTransactionBuffer.slice(1);

    // Create transaction from the parsed JSON object
    const versionedMessage = VersionedMessage.deserialize(message);

    // Create placeholder signatures array with the correct length
    const numRequiredSignatures = versionedMessage.header.numRequiredSignatures;
    const placeholderSignatures = Array.from({ length: numRequiredSignatures }, () => new Uint8Array(64)); // 64 bytes per signature
    
    const versionedTx = new VersionedTransaction(versionedMessage, placeholderSignatures);
    versionedTx.sign([keypair]);
    
    // Serialize the signed transaction
    const serializedTx = versionedTx.serialize();
    const signedTransactionBase64 = Buffer.from(serializedTx).toString('base64');
    
    console.log('Transaction signed successfully');
    
    return signedTransactionBase64;
}

/**
 * Create a Solana connection for the specified network
 */
export function createConnection(network: Network): Connection {
    const rpcEndpoint = RPC_ENDPOINTS[network];
    console.log('RPC endpoint:', rpcEndpoint);
    console.log(`Connecting to Solana ${Network[network]} at ${rpcEndpoint}`);
    return new Connection(rpcEndpoint, 'confirmed');
}

/**
 * Broadcast a signed transaction to the Solana network
 */
export async function broadcastTransaction(
    signedTransactionBase64: string, 
    connection: Connection, 
    network: Network
): Promise<string> {
    // Decode the signed transaction
    const signedTransactionBuffer = Buffer.from(signedTransactionBase64, 'base64');
    const versionedTx = VersionedTransaction.deserialize(signedTransactionBuffer);
    
    console.log('Broadcasting signed transaction to Solana blockchain...');
    
    const signature = await connection.sendTransaction(versionedTx);
    
    console.log('✅ Transaction broadcasted successfully!');
    console.log('Transaction signature:', signature);
    console.log(`View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=${Network[network].toLowerCase()}`);
    
    return signature;
}

/**
 * Wait for transaction confirmation
 */
export async function waitForConfirmation(
    signature: string, 
    connection: Connection
): Promise<boolean> {
    console.log('Waiting for transaction confirmation...');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
        console.error('❌ Transaction failed:', confirmation.value.err);
        return false;
    } else {
        console.log('✅ Transaction confirmed successfully!');
        console.log('Confirmation result:', confirmation.value);
        return true;
    }
}

/**
 * Poll transaction status with retries
 */
export async function pollTransactionStatus(
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

