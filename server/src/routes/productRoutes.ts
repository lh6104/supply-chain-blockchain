import { Router } from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  getProductByChainId,
  linkToChain,
  updateProduct,
  deleteProduct,
  getProductsByManufacturer,
  getProductsBatch
} from '../controllers/productController';
import { validateProductPayload, validateWalletAddress } from '../middleware';

const router = Router();

/**
 * @route   POST /api/products
 * @desc    Create new product metadata
 * @access  Public (should require auth in production)
 */
router.post('/', validateProductPayload, createProduct);

/**
 * @route   GET /api/products
 * @desc    Get all products
 * @access  Public
 */
router.get('/', getAllProducts);

/**
 * @route   POST /api/products/batch
 * @desc    Get multiple products by chain IDs
 * @access  Public
 */
router.post('/batch', getProductsBatch);

/**
 * @route   GET /api/products/chain/:productId
 * @desc    Get product by on-chain ID
 * @access  Public
 */
router.get('/chain/:productId', getProductByChainId);

/**
 * @route   GET /api/products/manufacturer/:address
 * @desc    Get products by manufacturer
 * @access  Public
 */
router.get('/manufacturer/:address', getProductsByManufacturer);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by internal ID
 * @access  Public
 */
router.get('/:id', getProductById);

/**
 * @route   POST /api/products/:id/link
 * @desc    Link product to blockchain ID
 * @access  Public (should require auth in production)
 */
router.post('/:id/link', linkToChain);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product metadata
 * @access  Public (should require auth in production)
 */
router.put('/:id', updateProduct);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product (only if not on chain)
 * @access  Public (should require auth in production)
 */
router.delete('/:id', deleteProduct);

export default router;
