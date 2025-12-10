import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Generate a UUID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generate a random nonce for signature authentication
 * This prevents replay attacks
 */
export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create the message that users sign to authenticate
 * This message format is human-readable in MetaMask
 */
export function createSignMessage(nonce: string, action: string = 'authenticate'): string {
  return `Supply Chain DApp Authentication\n\nAction: ${action}\nNonce: ${nonce}\n\nSign this message to verify your wallet ownership. This does not cost any gas.`;
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Normalize Ethereum address to lowercase
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}
