import { Request, Response } from 'express';
import { productDB, ProductMetadata, CreateProductDTO } from '../models';
import { generateId } from '../utils';
import { asyncHandler, ApiError } from '../middleware';

/**
 * POST /api/products
 * Create new product metadata (before linking to blockchain)
 */
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const dto: CreateProductDTO = req.body;

  const product: ProductMetadata = {
    id: generateId(),
    productId: 0, // Will be set when linked to blockchain
    name: dto.name.trim(),
    description: dto.description,
    images: dto.images || [],
    manufacturer: dto.manufacturer.toLowerCase(),
    batchNumber: dto.batchNumber,
    manufacturingDate: dto.manufacturingDate ? new Date(dto.manufacturingDate) : undefined,
    expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
    ingredients: dto.ingredients,
    certifications: dto.certifications,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: dto.manufacturer.toLowerCase()
  };

  const created = productDB.create(product);

  res.status(201).json({
    success: true,
    message: 'Product metadata created. Ready to link to blockchain.',
    data: created
  });
});

/**
 * GET /api/products
 * Get all products
 */
export const getAllProducts = asyncHandler(async (req: Request, res: Response) => {
  const products = productDB.getAll();

  res.json({
    success: true,
    data: products,
    count: products.length
  });
});

/**
 * GET /api/products/:id
 * Get product by internal ID
 */
export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const product = productDB.findById(id);

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  res.json({
    success: true,
    data: product
  });
});

/**
 * GET /api/products/chain/:productId
 * Get product by on-chain product ID
 */
export const getProductByChainId = asyncHandler(async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId, 10);

  if (isNaN(productId)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  const product = productDB.findByProductId(productId);

  if (!product) {
    throw new ApiError(404, 'Product metadata not found for this chain ID');
  }

  res.json({
    success: true,
    data: product
  });
});

/**
 * POST /api/products/:id/link
 * Link product metadata to on-chain product ID
 * Body: { productId: number }
 */
export const linkToChain = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { productId } = req.body;

  if (typeof productId !== 'number' || productId < 1) {
    throw new ApiError(400, 'Valid productId (number >= 1) is required');
  }

  // Check if this chain ID is already linked
  const existing = productDB.findByProductId(productId);
  if (existing) {
    throw new ApiError(409, `Chain ID ${productId} is already linked to another product`);
  }

  const updated = productDB.linkToChain(id, productId);

  if (!updated) {
    throw new ApiError(404, 'Product not found');
  }

  res.json({
    success: true,
    message: `Product linked to chain ID: ${productId}`,
    data: updated
  });
});

/**
 * PUT /api/products/:id
 * Update product metadata
 */
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove fields that shouldn't be updated directly
  delete updates.id;
  delete updates.productId;
  delete updates.createdAt;
  delete updates.createdBy;

  const updated = productDB.update(id, updates);

  if (!updated) {
    throw new ApiError(404, 'Product not found');
  }

  res.json({
    success: true,
    data: updated
  });
});

/**
 * DELETE /api/products/:id
 * Delete product metadata (only if not linked to chain)
 */
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const product = productDB.findById(id);

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  if (product.productId) {
    throw new ApiError(400, 'Cannot delete product that is linked to blockchain');
  }

  productDB.delete(id);

  res.json({
    success: true,
    message: 'Product deleted'
  });
});

/**
 * GET /api/products/manufacturer/:address
 * Get all products by manufacturer
 */
export const getProductsByManufacturer = asyncHandler(async (req: Request, res: Response) => {
  const { address } = req.params;
  const products = productDB.findByManufacturer(address);

  res.json({
    success: true,
    data: products,
    count: products.length
  });
});

/**
 * POST /api/products/batch
 * Get multiple products by their chain IDs
 * Body: { productIds: number[] }
 */
export const getProductsBatch = asyncHandler(async (req: Request, res: Response) => {
  const { productIds } = req.body;

  if (!Array.isArray(productIds)) {
    throw new ApiError(400, 'productIds must be an array');
  }

  const products: (ProductMetadata | null)[] = productIds.map((id: number) => {
    return productDB.findByProductId(id) || null;
  });

  res.json({
    success: true,
    data: products,
    found: products.filter(p => p !== null).length,
    total: productIds.length
  });
});
