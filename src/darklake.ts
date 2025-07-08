import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Cluster, PublicKey } from '@solana/web3.js';
import DarklakeIDL from './darklake-idl.json';
import { Darklake as DarklakeType } from './darklake-type'

// Type definition for the Darklake program
export interface Darklake {
    programId: PublicKey;
    methods: {
        swap: (args: any) => any;
        settle: (args: any) => any;
    };
}

// Re-export the generated IDL and type
export { DarklakeIDL };

export type { DarklakeType };

// The programId is imported from the program IDL.
export const DARKLAKE_PROGRAM_ID = new PublicKey(DarklakeIDL.address);

// This is a helper function to get the Darklake Anchor program.
export function getDarklakeProgram(provider: AnchorProvider) {
    return new Program(DarklakeIDL as any, provider);
}

// This is a helper function to get the program ID for the Darklake program depending on the cluster.
export function getDarklakeProgramId(cluster: Cluster | 'localnet') {
    switch (cluster) {
        case 'localnet':
            return new PublicKey(
                'CQW1DNS35zc9F8KvzYjf2ZKtmRp6ntxNdfRo2dZTXp2B',
            );
        case 'devnet':
        case 'testnet':
            // This is the program ID for the Darklake program on devnet and testnet.
            return DARKLAKE_PROGRAM_ID;
        case 'mainnet-beta':
        default:
            return DARKLAKE_PROGRAM_ID;
    }
} 