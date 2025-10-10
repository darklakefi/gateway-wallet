import * as dotenv from 'dotenv';
import { WalletEmulatorConfig } from './types';

// Load environment variables
dotenv.config();

/**
 * Load configuration from environment variables
 */
function loadConfig(): WalletEmulatorConfig {
    return {
        privateKeyBytes: process.env.PRIVATE_KEY_BYTES || '',
        gatewayHost: process.env.GATEWAY_HOST || 'localhost',
        gatewayPort: parseInt(process.env.GATEWAY_PORT || '50051'),
        tokenX: process.env.TOKEN_X_MINT || '',
        tokenY: process.env.TOKEN_Y_MINT || '',
        inputAmount: parseInt(process.env.INPUT_AMOUNT || '1000'),
        minOut: parseInt(process.env.MIN_OUT || '0'),
        network: parseInt(process.env.NETWORK || '1', 10), // Default to DEVNET
        trackingId: "id" + Math.random().toString(16).slice(2),
        // ADD LIQUIDITY
        amountLp: parseInt(process.env.AMOUNT_LP || '0'),
        maxAmountX: parseInt(process.env.MAX_AMOUNT_X || '0'),
        maxAmountY: parseInt(process.env.MAX_AMOUNT_Y || '0'),

        // REF/LABEL
        refCode: process.env.REF_CODE || '',
        label: process.env.LABEL || '',
    };
}

/**
 * Log configuration in a consistent format
 */
function logConfiguration(config: WalletEmulatorConfig, scriptName: string): void {
    console.log(`🚀 Darklake ${scriptName}`);
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
}

/**
 * Handle main function execution with consistent error handling
 */
export async function executeMain(
    scriptName: string,
    executionFunction: () => Promise<void>
): Promise<void> {
    const config = loadConfig();
    logConfiguration(config, scriptName);
    
    try {
        await executionFunction();
        console.log(`✅ ${scriptName} completed successfully`);
    } catch (error) {
        console.error(`❌ ${scriptName} failed:`, error);
        process.exit(1);
    }
    
    // Exit the program
    console.log('👋 Exiting...');
    process.exit(0);
}

// Export the main execution function for use by other scripts
export { loadConfig, logConfiguration };
