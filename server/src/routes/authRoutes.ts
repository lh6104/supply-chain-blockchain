import { Router } from 'express';
import { 
  getNonce, 
  linkWallet, 
  verifySignature,
  getUser, 
  updateUserProfile,
  getAllUsers,
  addLinkedWallet,
  removeLinkedWallet,
  setPrimaryWallet
} from '../controllers/authController';
import { validateWalletAddress } from '../middleware';

const router = Router();

/**
 * @route   GET /api/auth/nonce/:walletAddress
 * @desc    Get nonce and message for wallet authentication
 * @access  Public
 */
router.get('/nonce/:walletAddress', validateWalletAddress, getNonce);

/**
 * @route   POST /api/auth/link
 * @desc    Verify signature and link wallet to user (primary/first wallet)
 * @access  Public
 */
router.post('/link', linkWallet);

/**
 * @route   POST /api/auth/verify
 * @desc    Verify a signature (for re-authentication)
 * @access  Public
 */
router.post('/verify', verifySignature);

/**
 * @route   GET /api/auth/user/:walletAddress
 * @desc    Get user profile by wallet
 * @access  Public
 */
router.get('/user/:walletAddress', validateWalletAddress, getUser);

/**
 * @route   PUT /api/auth/user/:walletAddress
 * @desc    Update user profile
 * @access  Public (should require auth in production)
 */
router.put('/user/:walletAddress', validateWalletAddress, updateUserProfile);

/**
 * @route   GET /api/auth/users
 * @desc    Get all users (debug)
 * @access  Public (should be protected in production)
 */
router.get('/users', getAllUsers);

// ============================================
// MULTI-WALLET ENDPOINTS
// ============================================

/**
 * @route   POST /api/auth/link-wallet
 * @desc    Add a secondary wallet to existing user account
 * @access  Authenticated (user must provide their userId)
 */
router.post('/link-wallet', addLinkedWallet);

/**
 * @route   DELETE /api/auth/wallet/:address
 * @desc    Remove a linked wallet from user account
 * @access  Authenticated
 */
router.delete('/wallet/:address', removeLinkedWallet);

/**
 * @route   PUT /api/auth/primary-wallet
 * @desc    Set a different wallet as primary
 * @access  Authenticated
 */
router.put('/primary-wallet', setPrimaryWallet);

export default router;
