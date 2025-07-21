export enum Network {
    DEVNET = 2,
    MAINNET = 0,
    TESTNET = 1,
};

export enum TransactionStatus {
    UNSIGNED  = 0,
    SIGNED    = 1,
    CONFIRMED = 2,
    SETTLED   = 3,
    SLASHED   = 4,
    CANCELLED = 5,
}

export interface WalletEmulatorConfig {
    privateKeyBytes: string;
    gatewayHost: string;
    gatewayPort: number;
    tokenX: string;
    tokenY: string;
    inputAmount: number;
    minOut: number;
    network: Network;
    trackingId: string;
}

// gRPC client types
export interface GrpcClient {
    swap: (request: SwapRequest) => Promise<SwapResponse>;
    submitSignedTransaction: (request: SignedTransactionRequest) => Promise<SignedTransactionResponse>;
    checkTransactionStatus: (request: CheckTransactionStatusRequest) => Promise<CheckTransactionStatusResponse>;
}

export interface SwapRequest {
    user_address: string;
    token_mint_x: string;
    token_mint_y: string;
    amount_in: number;
    min_out: number;
    is_swap_x_to_y: boolean;
    network: Network;
    tracking_id: string;
}

export interface SwapResponse {
    unsigned_transaction: string; // Base64 encoded transaction
    transaction_id: string;
}

export interface SignedTransactionRequest {
    signed_transaction: string; // Base64 encoded signed transaction
    transaction_id: string;  
    tracking_id: string;
}

export interface SignedTransactionResponse {
    transaction_id: string;
    success: boolean;
}

export interface CheckTransactionStatusRequest {
    tracking_id: string;
    transaction_id: string;
}

export interface CheckTransactionStatusResponse {
    transaction_id: string;
    status: TransactionStatus;
}