import { Request, Response, NextFunction } from 'express';
import { isValidAddress } from '../utils';

/**
 * Validate that a wallet address is present and valid
 */
export const validateWalletAddress = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const walletAddress = req.body.walletAddress || req.params.walletAddress;

  if (!walletAddress) {
    return res.status(400).json({
      success: false,
      error: { message: 'Wallet address is required' }
    });
  }

  if (!isValidAddress(walletAddress)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid wallet address format' }
    });
  }

  next();
};

/**
 * Validate product creation payload
 */
export const validateProductPayload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { name, description, manufacturer } = req.body;

  const errors: string[] = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (!description || typeof description !== 'string') {
    errors.push('Product description is required');
  }

  if (!manufacturer || !isValidAddress(manufacturer)) {
    errors.push('Valid manufacturer wallet address is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', details: errors }
    });
  }

  next();
};
