/**
 * API Client for Supply Chain Backend
 * 
 * This module provides typed functions to interact with the off-chain backend API.
 * All wallet authentication uses cryptographic signatures for security.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Flag to track if backend is available
let backendAvailable: boolean | null = null;

/**
 * Check if backend API is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    backendAvailable = response.ok;
    return backendAvailable;
  } catch (error) {
    console.warn('Backend API is not available:', error);
    backendAvailable = false;
    return false;
  }
}

/**
 * Get cached backend availability status
 */
export function isBackendAvailable(): boolean | null {
  return backendAvailable;
}

// ============================================
// Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    details?: string[];
  };
}

export interface UserProfile {
  name?: string;
  email?: string;
  company?: string;
  location?: string;
  avatar?: string;
}

// Linked wallet entry from backend
export interface LinkedWalletEntry {
  address: string;
  isPrimary: boolean;
  addedAt: string;
  provider?: string;
  lastUsedAt?: string;
}

export interface User {
  id: string;
  primaryWallet: string;
  linkedWallets: LinkedWalletEntry[];
  role: 'owner' | 'rms' | 'manufacturer' | 'distributor' | 'retailer' | 'unregistered';
  profile: UserProfile;
  linkedAt: string;
  lastLoginAt?: string;
}

export interface NonceResponse {
  nonce: string;
  message: string;
  isNewUser: boolean;
}

export interface LinkWalletResponse {
  user: User;
  verified: boolean;
  linkedWallets?: LinkedWalletEntry[];
}

export interface ProductImage {
  url: string;
  caption?: string;
  uploadedAt: string;
}

export interface ProductMetadata {
  id: string;
  productId: number;
  name: string;
  description: string;
  images: ProductImage[];
  manufacturer: string;
  batchNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  ingredients?: string[];
  certifications?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateProductDTO {
  name: string;
  description: string;
  images?: ProductImage[];
  manufacturer: string;
  batchNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  ingredients?: string[];
  certifications?: string[];
}

// ============================================
// Helper Functions
// ============================================

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    console.log(`[API] ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[API] Error ${response.status}:`, data);
      return {
        success: false,
        error: data.error || { message: `Request failed with status ${response.status}` },
      };
    }

    console.log(`[API] Success:`, data);
    return data;
  } catch (error) {
    console.error(`[API] Network error for ${url}:`, error);
    backendAvailable = false;
    return {
      success: false,
      error: { 
        message: error instanceof Error 
          ? `Network error: ${error.message}. Is the backend server running on localhost:3001?` 
          : 'Network error - Backend may be offline' 
      },
    };
  }
}

// ============================================
// Auth API
// ============================================

/**
 * Get nonce and message for wallet signing
 */
export async function getNonce(walletAddress: string): Promise<ApiResponse<NonceResponse>> {
  return fetchApi<NonceResponse>(`/auth/nonce/${walletAddress}`);
}

/**
 * Link wallet by verifying signature
 */
export async function linkWallet(
  walletAddress: string,
  signature: string,
  message: string,
  profile?: UserProfile
): Promise<ApiResponse<LinkWalletResponse>> {
  return fetchApi<LinkWalletResponse>('/auth/link', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress,
      signature,
      message,
      profile,
    }),
  });
}

/**
 * Verify signature for authentication
 */
export async function verifySignature(
  walletAddress: string,
  signature: string,
  message: string
): Promise<ApiResponse<LinkWalletResponse>> {
  return fetchApi<LinkWalletResponse>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress,
      signature,
      message,
    }),
  });
}

/**
 * Get user by wallet address
 */
export async function getUser(walletAddress: string): Promise<ApiResponse<User>> {
  return fetchApi<User>(`/auth/user/${walletAddress}`);
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  walletAddress: string,
  profile: UserProfile,
  role?: string
): Promise<ApiResponse<User>> {
  return fetchApi<User>(`/auth/user/${walletAddress}`, {
    method: 'PUT',
    body: JSON.stringify({ profile, role }),
  });
}

// ============================================
// Multi-Wallet API
// ============================================

/**
 * Add a secondary wallet to an existing user account
 * This is the key function for "One User - Multiple Wallets"
 * 
 * @param addressToLink - The new wallet address to add
 * @param signature - Signature from the new wallet proving ownership
 * @param userId - The user ID who is claiming this wallet
 */
export async function addSecondaryWallet(
  addressToLink: string,
  signature: string,
  userId: string
): Promise<ApiResponse<LinkWalletResponse>> {
  return fetchApi<LinkWalletResponse>('/auth/link-wallet', {
    method: 'POST',
    body: JSON.stringify({
      addressToLink,
      signature,
      userId,
    }),
  });
}

/**
 * Remove a linked wallet from user account
 * Cannot remove the primary wallet
 */
export async function removeSecondaryWallet(
  walletAddress: string,
  userId: string
): Promise<ApiResponse<LinkWalletResponse>> {
  return fetchApi<LinkWalletResponse>(`/auth/wallet/${walletAddress}`, {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Set a different wallet as primary
 */
export async function setPrimaryWallet(
  walletAddress: string,
  userId: string
): Promise<ApiResponse<LinkWalletResponse>> {
  return fetchApi<LinkWalletResponse>('/auth/primary-wallet', {
    method: 'PUT',
    body: JSON.stringify({ userId, walletAddress }),
  });
}

// ============================================
// Products API
// ============================================

/**
 * Create product metadata
 */
export async function createProduct(
  product: CreateProductDTO
): Promise<ApiResponse<ProductMetadata>> {
  return fetchApi<ProductMetadata>('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

/**
 * Get all products
 */
export async function getAllProducts(): Promise<ApiResponse<ProductMetadata[]>> {
  return fetchApi<ProductMetadata[]>('/products');
}

/**
 * Get product by internal ID
 */
export async function getProductById(id: string): Promise<ApiResponse<ProductMetadata>> {
  return fetchApi<ProductMetadata>(`/products/${id}`);
}

/**
 * Get product by on-chain ID
 */
export async function getProductByChainId(
  productId: number
): Promise<ApiResponse<ProductMetadata>> {
  return fetchApi<ProductMetadata>(`/products/chain/${productId}`);
}

/**
 * Get products by manufacturer
 */
export async function getProductsByManufacturer(
  address: string
): Promise<ApiResponse<ProductMetadata[]>> {
  return fetchApi<ProductMetadata[]>(`/products/manufacturer/${address}`);
}

/**
 * Link product to blockchain ID
 */
export async function linkProductToChain(
  id: string,
  productId: number
): Promise<ApiResponse<ProductMetadata>> {
  return fetchApi<ProductMetadata>(`/products/${id}/link`, {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
}

/**
 * Update product metadata
 */
export async function updateProduct(
  id: string,
  updates: Partial<CreateProductDTO>
): Promise<ApiResponse<ProductMetadata>> {
  return fetchApi<ProductMetadata>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete product (only if not linked to chain)
 */
export async function deleteProduct(id: string): Promise<ApiResponse<void>> {
  return fetchApi<void>(`/products/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Batch fetch products by chain IDs
 */
export async function getProductsBatch(
  productIds: number[]
): Promise<ApiResponse<(ProductMetadata | null)[]>> {
  return fetchApi<(ProductMetadata | null)[]>('/products/batch', {
    method: 'POST',
    body: JSON.stringify({ productIds }),
  });
}

// ============================================
// Health Check
// ============================================

export async function healthCheck(): Promise<ApiResponse<{ message: string; timestamp: string }>> {
  return fetchApi<{ message: string; timestamp: string }>('/health');
}
