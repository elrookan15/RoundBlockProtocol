/**
 * RoundBlock Protocol Root Exports & Types
 */

export interface RoundBlockConfig {
  network: string;
  rpcUrl: string;
}

export const DEFAULT_CONFIG: RoundBlockConfig = {
  network: "devnet",
  rpcUrl: "https://api.devnet.solana.com",
};
