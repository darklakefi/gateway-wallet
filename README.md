# Darklake Gateway Wallet

A TypeScript wallet emulator that provides multiple operations on the Darklake DEX through a gRPC gateway API, including swap, add liquidity, and quote operations.

## Features

- **Swap Operations**: Execute token swaps through the gateway
- **Add Liquidity**: Add liquidity to pools and receive LP tokens
- **Quote Operations**: Get quotes for add liquidity operations
- **Wallet Management**: Load wallet from private key bytes
- **Transaction Handling**: Sign and broadcast transactions to Solana
- **gRPC Integration**: Modern gRPC-js implementation
- **Multiple Networks**: Support for devnet, testnet, and mainnet
- **Modular Architecture**: Clean separation of concerns with shared utilities

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Solana CLI tools (optional, for key generation)
- gRPC server implementing the gateway.proto interface

## Installation

1. Install dependencies:
```bash
pnpm install
```

2. Build the project:
```bash
pnpm run build
```

## Configuration

1. Create a `.env` file with your configuration:
```env
# Wallet Configuration
PRIVATE_KEY_BYTES="[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]"

# gRPC Gateway Configuration
GATEWAY_HOST=localhost
GATEWAY_PORT=50051

# Swap Parameters
TOKEN_X_MINT="So11111111111111111111111111111111111111112"  # SOL
TOKEN_Y_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC
INPUT_AMOUNT=1000
MIN_OUT=0
NETWORK=2
```

2. Create a private key:
```bash
# Generate a new keypair (optional)
solana-keygen new --outfile key.json

# Copy the array of bytes to PRIVATE_KEY_BYTES
```

## Usage

### Available Scripts

#### Swap Operations
```bash
# Execute a token swap
pnpm run swap
```

#### Add Liquidity Operations
```bash
# Add liquidity to a pool
pnpm run add-liquidity

# Get a quote for adding liquidity
pnpm run quote-liquidity
```

#### Development & Build
```bash
# Development mode (runs index.ts)
pnpm run dev

# Production mode
pnpm start

# Build only
pnpm run build
```

## How It Works

1. **Load Wallet**: The emulator loads a Solana keypair from the `PRIVATE_KEY_BYTES` environment variable
2. **Connect to gRPC Gateway**: Establishes a gRPC connection to the gateway server
3. **Request Swap**: Makes a gRPC call to the `Swap` service with swap parameters
4. **Receive Transaction**: Gets an unsigned Solana transaction from the gateway response
5. **Sign Transaction**: Signs the transaction using the loaded wallet
6. **Submit Transaction**: Sends the signed transaction via gRPC to the `SubmitSignedTransaction` service
7. **Exit**: The program exits after completion

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PRIVATE_KEY_BYTES` | JSON array of private key bytes | Yes | - |
| `GATEWAY_HOST` | gRPC gateway host address | Yes | localhost |
| `GATEWAY_PORT` | gRPC gateway port | Yes | 50051 |
| `TOKEN_X_MINT` | Token X mint address | Yes | - |
| `TOKEN_Y_MINT` | Token Y mint address | Yes | - |
| `INPUT_AMOUNT` | Amount of token X to swap | Yes | 1000 |
| `MIN_OUT` | Minimum output amount | Yes | 0 |
| `NETWORK` | Solana network (0=mainnet, 1=testnet, 2=devnet) | Yes | 2 |

## gRPC Service Interface

The emulator expects a gRPC server implementing the following service (defined in `proto/gateway.proto`):

### SolanaGatewayService
```protobuf
service SolanaGatewayService {
  rpc CreateUnsignedTransaction(CreateUnsignedTransactionRequest) returns (CreateUnsignedTransactionResponse);
  rpc SendSignedTransaction(SendSignedTransactionRequest) returns (SendSignedTransactionResponse);
}
```

### CreateUnsignedTransactionRequest
```protobuf
message CreateUnsignedTransactionRequest {
  string user_address = 1;
  string token_mint_x = 2;
  string token_mint_y = 3;
  uint64 amount_in = 4;
  uint64 min_out = 5;
  string tracking_id = 6;
  Network network = 7;
  bool is_swap_x_to_y = 8;
}
```

### CreateUnsignedTransactionResponse
```protobuf
message CreateUnsignedTransactionResponse {
  string unsigned_transaction = 1; // Base64 encoded transaction
  string order_id = 2;
}
```

### SendSignedTransactionRequest
```protobuf
message SendSignedTransactionRequest {
  string signed_transaction = 1; // Base64 encoded signed transaction
  string order_id = 2;
}
```

### SendSignedTransactionResponse
```protobuf
message SendSignedTransactionResponse {
  bool success = 1;
}
```

## Project Structure

```
gateway-wallet/
├── src/
│   ├── index.ts              # Main entry point with executeMain function
│   ├── swap.ts               # Swap operations
│   ├── add-liquidity.ts      # Add liquidity operations
│   ├── quote-add-liquidity.ts # Quote operations
│   ├── utils.ts              # Shared utility functions
│   └── types.ts              # TypeScript type definitions
├── proto/
│   └── darklake/
│       └── v1/
│           └── api.proto     # gRPC service definition
├── package.json
├── tsconfig.json
└── README.md
```

## Security Notes

- Keep your private key secure and never commit it to version control
- Use environment variables for sensitive configuration
- Consider using a dedicated wallet for testing operations
- Verify gRPC server endpoints before use

## Troubleshooting

### Common Issues

1. **Private key format error**: Ensure `PRIVATE_KEY_BYTES` is a valid JSON array of numbers
2. **gRPC connection failed**: Check your gateway host/port and ensure the gRPC server is running
3. **Transaction signing failed**: Verify the private key is correct and has sufficient funds
4. **Invalid response format**: Check that the gRPC server returns the expected message structure
5. **Network mismatch**: Ensure the `NETWORK` parameter matches your gateway configuration
6. **Proto file not found**: Ensure `proto/gateway.proto` exists and is accessible

## License

MIT 