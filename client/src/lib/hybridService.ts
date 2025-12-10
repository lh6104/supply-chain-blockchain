/**
 * Hybrid Supply Chain Service
 * 
 * This service combines on-chain (blockchain) and off-chain (backend API) data
 * to provide a complete view of products in the supply chain.
 * 
 * FLOW FOR ADDING A PRODUCT:
 * 1. Upload metadata to backend API → get internal ID
 * 2. Write to blockchain → get on-chain medicine ID
 * 3. Link backend record to blockchain ID
 * 
 * FLOW FOR FETCHING PRODUCTS:
 * 1. Get all medicine IDs from blockchain
 * 2. Batch fetch metadata from backend API
 * 3. Merge on-chain and off-chain data
 */

import { 
  createProduct as apiCreateProduct,
  getProductByChainId,
  getProductsBatch,
  linkProductToChain,
  ProductMetadata,
  CreateProductDTO 
} from './api';

// ============================================
// Types for Combined Data
// ============================================

export interface OnChainMedicine {
  id: number;
  createdBy: string;
  stage: number;
  stageName: string;
  createdAt: Date;
  updatedAt: Date;
  RMSid: number;
  MANid: number;
  DISid: number;
  RETid: number;
}

export interface HybridProduct {
  // On-chain data (immutable truth)
  chainId: number;
  createdBy: string;
  stage: number;
  stageName: string;
  createdAt: Date;
  updatedAt: Date;
  RMSid: number;
  MANid: number;
  DISid: number;
  RETid: number;
  
  // Off-chain metadata (from backend)
  metadata?: {
    id: string;
    name: string;
    description: string;
    images: { url: string; caption?: string }[];
    manufacturer: string;
    batchNumber?: string;
    expiryDate?: string;
    ingredients?: string[];
    certifications?: string[];
  };
  
  // Status
  hasMetadata: boolean;
}

// Stage name mapping
const STAGE_NAMES = [
  'Init',
  'Raw Material Supply',
  'Manufacture',
  'Distribution',
  'Retail',
  'Sold'
];

// ============================================
// Helper Functions
// ============================================

function parseBigInt(value: any): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    return parseInt(value, 10);
  }
  return Number(value) || 0;
}

function timestampToDate(timestamp: any): Date {
  const ts = parseBigInt(timestamp);
  return new Date(ts * 1000);
}

// ============================================
// Hybrid Service Functions
// ============================================

/**
 * Create a new product with hybrid storage
 * 
 * @param contract - The SupplyChainOptimized contract instance
 * @param account - The sender's address
 * @param productData - Product metadata to store off-chain
 * @returns The complete hybrid product
 */
export async function createHybridProduct(
  contract: any,
  account: string,
  productData: CreateProductDTO
): Promise<{ success: boolean; chainId?: number; internalId?: string; error?: string }> {
  try {
    // Step 1: Save metadata to backend first
    const apiResponse = await apiCreateProduct(productData);
    
    if (!apiResponse.success || !apiResponse.data) {
      return { 
        success: false, 
        error: apiResponse.error?.message || 'Failed to save product metadata' 
      };
    }
    
    const internalId = apiResponse.data.id;

    // Step 2: Create on-chain record
    const tx = await contract.methods.addMedicine().send({ from: account });
    
    // Get the medicine ID from the event or return value
    let chainId: number;
    
    if (tx.events?.MedicineCreated) {
      chainId = parseBigInt(tx.events.MedicineCreated.returnValues.id);
    } else {
      // Fallback: get the current counter
      const count = await contract.methods.medicineCtr().call();
      chainId = parseBigInt(count);
    }

    // Step 3: Link backend record to blockchain ID
    const linkResponse = await linkProductToChain(internalId, chainId);
    
    if (!linkResponse.success) {
      console.warn('Warning: Failed to link records:', linkResponse.error?.message);
      // Don't fail the whole operation, the product is created
    }

    return {
      success: true,
      chainId,
      internalId
    };

  } catch (error) {
    console.error('Error creating hybrid product:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch a single product with combined on-chain and off-chain data
 */
export async function getHybridProduct(
  contract: any,
  chainId: number
): Promise<HybridProduct | null> {
  try {
    // Get on-chain data
    const onChainData = await contract.methods.getMedicine(chainId).call();
    
    const stage = parseBigInt(onChainData.stage);
    
    const hybridProduct: HybridProduct = {
      chainId,
      createdBy: onChainData.createdBy,
      stage,
      stageName: STAGE_NAMES[stage] || 'Unknown',
      createdAt: timestampToDate(onChainData.createdAt),
      updatedAt: timestampToDate(onChainData.updatedAt),
      RMSid: parseBigInt(onChainData.RMSid),
      MANid: parseBigInt(onChainData.MANid),
      DISid: parseBigInt(onChainData.DISid),
      RETid: parseBigInt(onChainData.RETid),
      hasMetadata: false
    };

    // Try to get off-chain metadata
    const metadataResponse = await getProductByChainId(chainId);
    
    if (metadataResponse.success && metadataResponse.data) {
      const m = metadataResponse.data;
      hybridProduct.metadata = {
        id: m.id,
        name: m.name,
        description: m.description,
        images: m.images,
        manufacturer: m.manufacturer,
        batchNumber: m.batchNumber,
        expiryDate: m.expiryDate,
        ingredients: m.ingredients,
        certifications: m.certifications
      };
      hybridProduct.hasMetadata = true;
    }

    return hybridProduct;

  } catch (error) {
    console.error('Error fetching hybrid product:', error);
    return null;
  }
}

/**
 * Fetch all products with combined data (for dashboard)
 */
export async function getAllHybridProducts(
  contract: any
): Promise<HybridProduct[]> {
  try {
    // Step 1: Get total count from blockchain
    const count = parseBigInt(await contract.methods.medicineCtr().call());
    
    if (count === 0) {
      return [];
    }

    // Step 2: Fetch all on-chain data
    const chainIds = Array.from({ length: count }, (_, i) => i + 1);
    const onChainPromises = chainIds.map(id => 
      contract.methods.getMedicine(id).call()
    );
    const onChainResults = await Promise.all(onChainPromises);

    // Step 3: Batch fetch metadata from backend
    const metadataResponse = await getProductsBatch(chainIds);
    const metadataMap = new Map<number, ProductMetadata>();
    
    if (metadataResponse.success && metadataResponse.data) {
      metadataResponse.data.forEach((m, index) => {
        if (m) {
          metadataMap.set(chainIds[index], m);
        }
      });
    }

    // Step 4: Combine data
    const hybridProducts: HybridProduct[] = onChainResults.map((data, index) => {
      const chainId = chainIds[index];
      const stage = parseBigInt(data.stage);
      const metadata = metadataMap.get(chainId);

      const product: HybridProduct = {
        chainId,
        createdBy: data.createdBy,
        stage,
        stageName: STAGE_NAMES[stage] || 'Unknown',
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt),
        RMSid: parseBigInt(data.RMSid),
        MANid: parseBigInt(data.MANid),
        DISid: parseBigInt(data.DISid),
        RETid: parseBigInt(data.RETid),
        hasMetadata: !!metadata
      };

      if (metadata) {
        product.metadata = {
          id: metadata.id,
          name: metadata.name,
          description: metadata.description,
          images: metadata.images,
          manufacturer: metadata.manufacturer,
          batchNumber: metadata.batchNumber,
          expiryDate: metadata.expiryDate,
          ingredients: metadata.ingredients,
          certifications: metadata.certifications
        };
      }

      return product;
    });

    return hybridProducts;

  } catch (error) {
    console.error('Error fetching all hybrid products:', error);
    return [];
  }
}

/**
 * Get statistics for dashboard
 */
export async function getSupplyChainStats(contract: any) {
  try {
    const [medicineCtr, rmsCtr, manCtr, disCtr, retCtr] = await Promise.all([
      contract.methods.medicineCtr().call(),
      contract.methods.rmsCtr().call(),
      contract.methods.manCtr().call(),
      contract.methods.disCtr().call(),
      contract.methods.retCtr().call()
    ]);

    return {
      totalMedicines: parseBigInt(medicineCtr),
      totalRMS: parseBigInt(rmsCtr),
      totalManufacturers: parseBigInt(manCtr),
      totalDistributors: parseBigInt(disCtr),
      totalRetailers: parseBigInt(retCtr)
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      totalMedicines: 0,
      totalRMS: 0,
      totalManufacturers: 0,
      totalDistributors: 0,
      totalRetailers: 0
    };
  }
}
