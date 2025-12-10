/**
 * User Model - Represents a linked wallet user
 * 
 * This stores user profiles linked to their Ethereum wallet addresses.
 * Supports ONE USER - MULTIPLE WALLETS pattern.
 * The nonce is used for signature-based authentication (prevents replay attacks).
 */

export type UserRole = 'owner' | 'rms' | 'manufacturer' | 'distributor' | 'retailer' | 'unregistered';

export interface UserProfile {
  name?: string;
  email?: string;
  company?: string;
  location?: string;
  avatar?: string;
}

// Individual linked wallet entry
export interface LinkedWalletEntry {
  address: string;           // Ethereum address (lowercase)
  isPrimary: boolean;        // Is this the primary wallet?
  addedAt: Date;             // When this wallet was linked
  provider?: string;         // Which wallet provider (MetaMask, etc.)
  lastUsedAt?: Date;         // Last time this wallet was used for auth
}

export interface User {
  id: string;
  primaryWallet: string;       // Primary wallet address (for quick lookup)
  linkedWallets: LinkedWalletEntry[];  // All linked wallets
  nonce: string;               // Random nonce for signature verification
  role: UserRole;              // Role in the supply chain
  profile: UserProfile;        // Additional user metadata
  linkedAt: Date;              // When the account was first created
  lastLoginAt?: Date;          // Last successful authentication
}

/**
 * In-Memory Database for Users
 * 
 * We maintain two indexes:
 * 1. users: Map<walletAddress, User> - For finding user by any wallet
 * 2. usersByPrimary: Map<primaryWallet, User> - For finding by primary wallet
 * 
 * Key insight: Multiple wallet addresses can point to the SAME user.
 */
class UserDatabase {
  // Primary storage: userId -> User
  private usersById: Map<string, User> = new Map();
  
  // Index: walletAddress (any) -> userId
  private walletIndex: Map<string, string> = new Map();

  /**
   * Create a new user with their first (primary) wallet
   */
  create(user: User): User {
    const normalizedPrimary = user.primaryWallet.toLowerCase();
    
    // Ensure the primary wallet is in linkedWallets
    if (!user.linkedWallets.some(w => w.address.toLowerCase() === normalizedPrimary)) {
      user.linkedWallets.unshift({
        address: normalizedPrimary,
        isPrimary: true,
        addedAt: new Date(),
        provider: 'MetaMask'
      });
    }
    
    // Normalize all addresses
    user.primaryWallet = normalizedPrimary;
    user.linkedWallets = user.linkedWallets.map(w => ({
      ...w,
      address: w.address.toLowerCase()
    }));
    
    // Store by ID
    this.usersById.set(user.id, user);
    
    // Index all linked wallets
    for (const wallet of user.linkedWallets) {
      this.walletIndex.set(wallet.address.toLowerCase(), user.id);
    }
    
    return user;
  }

  /**
   * Find user by ANY of their linked wallet addresses
   */
  findByWallet(walletAddress: string): User | undefined {
    const userId = this.walletIndex.get(walletAddress.toLowerCase());
    if (!userId) return undefined;
    return this.usersById.get(userId);
  }

  /**
   * Find user by their ID
   */
  findById(id: string): User | undefined {
    return this.usersById.get(id);
  }

  /**
   * Check if a wallet address is already used by any user
   */
  isWalletTaken(walletAddress: string): boolean {
    return this.walletIndex.has(walletAddress.toLowerCase());
  }

  /**
   * Add a new wallet to an existing user
   * Returns the updated user or undefined if wallet is already taken
   */
  addWalletToUser(userId: string, walletEntry: LinkedWalletEntry): User | undefined {
    const user = this.usersById.get(userId);
    if (!user) return undefined;
    
    const normalizedAddress = walletEntry.address.toLowerCase();
    
    // Check if wallet is already taken
    if (this.walletIndex.has(normalizedAddress)) {
      return undefined; // Wallet already linked to someone
    }
    
    // Add wallet to user
    user.linkedWallets.push({
      ...walletEntry,
      address: normalizedAddress,
      addedAt: new Date()
    });
    
    // Update index
    this.walletIndex.set(normalizedAddress, userId);
    
    // Update storage
    this.usersById.set(userId, user);
    
    return user;
  }

  /**
   * Remove a wallet from a user (cannot remove primary)
   */
  removeWalletFromUser(userId: string, walletAddress: string): User | undefined {
    const user = this.usersById.get(userId);
    if (!user) return undefined;
    
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Cannot remove primary wallet
    if (user.primaryWallet === normalizedAddress) {
      return undefined;
    }
    
    // Remove from user's list
    user.linkedWallets = user.linkedWallets.filter(
      w => w.address !== normalizedAddress
    );
    
    // Remove from index
    this.walletIndex.delete(normalizedAddress);
    
    // Update storage
    this.usersById.set(userId, user);
    
    return user;
  }

  /**
   * Set a different wallet as primary
   */
  setPrimaryWallet(userId: string, walletAddress: string): User | undefined {
    const user = this.usersById.get(userId);
    if (!user) return undefined;
    
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Check if wallet belongs to this user
    const walletEntry = user.linkedWallets.find(w => w.address === normalizedAddress);
    if (!walletEntry) return undefined;
    
    // Update primary flags
    user.primaryWallet = normalizedAddress;
    user.linkedWallets = user.linkedWallets.map(w => ({
      ...w,
      isPrimary: w.address === normalizedAddress
    }));
    
    this.usersById.set(userId, user);
    
    return user;
  }

  /**
   * Update user properties
   */
  update(walletAddress: string, updates: Partial<User>): User | undefined {
    const user = this.findByWallet(walletAddress);
    if (!user) return undefined;
    
    const updated = { ...user, ...updates };
    this.usersById.set(user.id, updated);
    return updated;
  }

  /**
   * Update nonce for a user (by any wallet)
   */
  updateNonce(walletAddress: string, nonce: string): User | undefined {
    return this.update(walletAddress, { nonce });
  }

  /**
   * Delete user and all their wallet associations
   */
  delete(walletAddress: string): boolean {
    const user = this.findByWallet(walletAddress);
    if (!user) return false;
    
    // Remove all wallet indexes
    for (const wallet of user.linkedWallets) {
      this.walletIndex.delete(wallet.address);
    }
    
    // Remove user
    this.usersById.delete(user.id);
    
    return true;
  }

  /**
   * Get all users
   */
  getAll(): User[] {
    return Array.from(this.usersById.values());
  }

  /**
   * Count users
   */
  count(): number {
    return this.usersById.size;
  }
}

// Export singleton instance
export const userDB = new UserDatabase();
