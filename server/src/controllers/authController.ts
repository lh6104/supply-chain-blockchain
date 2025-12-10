import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { userDB, User, LinkedWalletEntry } from '../models';
import { generateId, generateNonce, createSignMessage } from '../utils';
import { asyncHandler, ApiError } from '../middleware';

/**
 * GET /api/auth/nonce/:walletAddress
 * Get or create a nonce for a wallet address (used for signing)
 */
export const getNonce = asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress } = req.params;
  const normalizedAddress = walletAddress.toLowerCase();

  let user = userDB.findByWallet(normalizedAddress);
  let isNewUser = false;

  if (!user) {
    // Create new user with fresh nonce
    isNewUser = true;
    const newUser: User = {
      id: generateId(),
      primaryWallet: normalizedAddress,
      linkedWallets: [{
        address: normalizedAddress,
        isPrimary: true,
        addedAt: new Date(),
        provider: 'MetaMask'
      }],
      nonce: generateNonce(),
      role: 'unregistered',
      profile: {},
      linkedAt: new Date()
    };
    user = userDB.create(newUser);
  }

  // Return the nonce and the message to sign
  const message = createSignMessage(user.nonce, 'link-wallet');

  res.json({
    success: true,
    data: {
      nonce: user.nonce,
      message,
      isNewUser
    }
  });
});

/**
 * POST /api/auth/link
 * Verify signature and link wallet to user profile (primary wallet / first login)
 * 
 * Body: { 
 *   walletAddress: string, 
 *   signature: string,
 *   message: string,
 *   profile?: { name, email, company, location } 
 * }
 */
export const linkWallet = asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress, signature, message, profile } = req.body;

  // Validate required fields
  if (!walletAddress || !signature || !message) {
    throw new ApiError(400, 'walletAddress, signature, and message are required');
  }

  const normalizedAddress = walletAddress.toLowerCase();

  // Find user and their nonce
  const user = userDB.findByWallet(normalizedAddress);
  
  if (!user) {
    throw new ApiError(400, 'Please request a nonce first via GET /api/auth/nonce/:walletAddress');
  }

  // Verify that the message contains the correct nonce
  const expectedMessage = createSignMessage(user.nonce, 'link-wallet');
  if (message !== expectedMessage) {
    throw new ApiError(400, 'Invalid message. Please request a fresh nonce and try again.');
  }

  // ===== CRITICAL: Verify the signature =====
  let recoveredAddress: string;
  
  try {
    recoveredAddress = ethers.verifyMessage(message, signature);
  } catch (err) {
    throw new ApiError(400, 'Invalid signature format');
  }

  if (recoveredAddress.toLowerCase() !== normalizedAddress) {
    throw new ApiError(401, 'Signature verification failed. The signature does not match the wallet address.');
  }

  // ===== Signature verified! Update user =====
  const newNonce = generateNonce();
  
  const updatedUser = userDB.update(normalizedAddress, {
    nonce: newNonce,
    lastLoginAt: new Date(),
    profile: profile ? { ...user.profile, ...profile } : user.profile
  });

  if (!updatedUser) {
    throw new ApiError(500, 'Failed to update user');
  }

  const { nonce, ...safeUser } = updatedUser;

  res.json({
    success: true,
    message: 'Wallet linked successfully',
    data: {
      user: safeUser,
      verified: true
    }
  });
});

/**
 * POST /api/user/link-wallet
 * Add a secondary wallet to an existing user account
 * 
 * This is the key endpoint for "One User - Multiple Wallets"
 * 
 * Body: { 
 *   addressToLink: string,      // The new wallet to add
 *   signature: string,          // Signature from the new wallet
 *   userId: string              // The user ID who is claiming this wallet
 * }
 */
export const addLinkedWallet = asyncHandler(async (req: Request, res: Response) => {
  const { addressToLink, signature, userId } = req.body;

  // Validate required fields
  if (!addressToLink || !signature || !userId) {
    throw new ApiError(400, 'addressToLink, signature, and userId are required');
  }

  const normalizedAddress = addressToLink.toLowerCase();

  // Find the user by ID
  const user = userDB.findById(userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Check if wallet is already linked to ANY user
  if (userDB.isWalletTaken(normalizedAddress)) {
    throw new ApiError(400, 'This wallet is already linked to an account');
  }

  // Build the message that was signed
  // The message format: "Link wallet {address} to ChainGuard account"
  const message = `Link wallet ${addressToLink} to ChainGuard account`;

  // ===== CRITICAL: Verify the signature =====
  let recoveredAddress: string;
  
  try {
    recoveredAddress = ethers.verifyMessage(message, signature);
  } catch (err) {
    throw new ApiError(400, 'Invalid signature format');
  }

  // The signature MUST come from the wallet being linked
  if (recoveredAddress.toLowerCase() !== normalizedAddress) {
    throw new ApiError(401, 'Signature verification failed. The signature must come from the wallet being linked.');
  }

  // ===== Signature verified! Add wallet to user =====
  const walletEntry: LinkedWalletEntry = {
    address: normalizedAddress,
    isPrimary: false,
    addedAt: new Date(),
    provider: 'MetaMask'
  };

  const updatedUser = userDB.addWalletToUser(userId, walletEntry);

  if (!updatedUser) {
    throw new ApiError(500, 'Failed to link wallet. It may already be linked to another account.');
  }

  // Update last login
  userDB.update(user.primaryWallet, { lastLoginAt: new Date() });

  const { nonce, ...safeUser } = updatedUser;

  res.json({
    success: true,
    message: 'Wallet linked successfully',
    data: {
      user: safeUser,
      linkedWallets: updatedUser.linkedWallets
    }
  });
});

/**
 * DELETE /api/user/wallet/:address
 * Remove a linked wallet from user account (cannot remove primary)
 */
export const removeLinkedWallet = asyncHandler(async (req: Request, res: Response) => {
  const { address } = req.params;
  const { userId } = req.body;

  if (!userId) {
    throw new ApiError(400, 'userId is required');
  }

  const normalizedAddress = address.toLowerCase();
  
  const user = userDB.findById(userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Check if this wallet belongs to the user
  const walletBelongsToUser = user.linkedWallets.some(
    w => w.address === normalizedAddress
  );
  
  if (!walletBelongsToUser) {
    throw new ApiError(400, 'This wallet is not linked to your account');
  }

  // Cannot remove primary wallet
  if (user.primaryWallet === normalizedAddress) {
    throw new ApiError(400, 'Cannot remove primary wallet. Set a different wallet as primary first.');
  }

  const updatedUser = userDB.removeWalletFromUser(userId, normalizedAddress);

  if (!updatedUser) {
    throw new ApiError(500, 'Failed to remove wallet');
  }

  const { nonce, ...safeUser } = updatedUser;

  res.json({
    success: true,
    message: 'Wallet removed successfully',
    data: {
      user: safeUser,
      linkedWallets: updatedUser.linkedWallets
    }
  });
});

/**
 * PUT /api/user/primary-wallet
 * Set a different wallet as primary
 */
export const setPrimaryWallet = asyncHandler(async (req: Request, res: Response) => {
  const { userId, walletAddress } = req.body;

  if (!userId || !walletAddress) {
    throw new ApiError(400, 'userId and walletAddress are required');
  }

  const normalizedAddress = walletAddress.toLowerCase();
  
  const updatedUser = userDB.setPrimaryWallet(userId, normalizedAddress);

  if (!updatedUser) {
    throw new ApiError(400, 'Failed to set primary wallet. Wallet may not belong to this user.');
  }

  const { nonce, ...safeUser } = updatedUser;

  res.json({
    success: true,
    message: 'Primary wallet updated',
    data: {
      user: safeUser,
      linkedWallets: updatedUser.linkedWallets
    }
  });
});

/**
 * POST /api/auth/verify
 * Verify a signature without linking (for authentication)
 */
export const verifySignature = asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress, signature, message } = req.body;

  if (!walletAddress || !signature || !message) {
    throw new ApiError(400, 'walletAddress, signature, and message are required');
  }

  const normalizedAddress = walletAddress.toLowerCase();
  const user = userDB.findByWallet(normalizedAddress);
  
  if (!user) {
    throw new ApiError(404, 'User not found. Please link your wallet first.');
  }

  let recoveredAddress: string;
  
  try {
    recoveredAddress = ethers.verifyMessage(message, signature);
  } catch (err) {
    throw new ApiError(400, 'Invalid signature format');
  }

  if (recoveredAddress.toLowerCase() !== normalizedAddress) {
    throw new ApiError(401, 'Signature verification failed');
  }

  const newNonce = generateNonce();
  userDB.update(normalizedAddress, {
    nonce: newNonce,
    lastLoginAt: new Date()
  });

  const { nonce, ...safeUser } = user;

  res.json({
    success: true,
    message: 'Signature verified',
    data: {
      user: safeUser,
      verified: true
    }
  });
});

/**
 * PUT /api/auth/user/:walletAddress
 * Update user profile
 */
export const updateUserProfile = asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress } = req.params;
  const { profile, role } = req.body;

  const user = userDB.findByWallet(walletAddress);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const updates: Partial<User> = {};
  
  if (profile) {
    updates.profile = { ...user.profile, ...profile };
  }
  
  if (role) {
    updates.role = role;
  }

  const updated = userDB.update(walletAddress, updates);

  if (!updated) {
    throw new ApiError(500, 'Failed to update user');
  }

  const { nonce, ...safeUser } = updated;

  res.json({
    success: true,
    data: safeUser
  });
});

/**
 * GET /api/auth/user/:walletAddress
 * Get user profile by wallet address
 */
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress } = req.params;
  const user = userDB.findByWallet(walletAddress);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found' }
    });
  }

  // Don't expose the nonce in public responses
  const { nonce, ...safeUser } = user;

  res.json({
    success: true,
    data: safeUser
  });
});

/**
 * GET /api/auth/users
 * Get all users (admin/debug endpoint)
 */
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = userDB.getAll().map(({ nonce, ...user }) => user);

  res.json({
    success: true,
    data: users,
    count: users.length
  });
});
