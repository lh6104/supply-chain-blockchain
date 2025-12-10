/**
 * Product Metadata Model - Off-chain product information
 * 
 * This stores the "heavy" metadata that would be expensive to store on-chain.
 * The productId links to the on-chain medicine ID in the smart contract.
 */

export type ProductStage = 
  | 'init' 
  | 'raw_material_supply' 
  | 'manufacture' 
  | 'distribution' 
  | 'retail' 
  | 'sold';

export interface ProductImage {
  url: string;
  caption?: string;
  uploadedAt: Date;
}

export interface ProductMetadata {
  id: string;                   // Internal database ID (UUID)
  productId: number;            // On-chain medicine ID (links to smart contract)
  name: string;                 // Product name
  description: string;          // Detailed description
  images: ProductImage[];       // Product images
  manufacturer: string;         // Manufacturer wallet address
  batchNumber?: string;         // Batch/lot number
  manufacturingDate?: Date;     // When it was manufactured
  expiryDate?: Date;            // Expiration date
  ingredients?: string[];       // List of ingredients/components
  certifications?: string[];    // Quality certifications
  createdAt: Date;              // When metadata was created
  updatedAt: Date;              // Last update timestamp
  createdBy: string;            // Wallet address of creator
}

export interface CreateProductDTO {
  name: string;
  description: string;
  images?: ProductImage[];
  manufacturer: string;
  batchNumber?: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  ingredients?: string[];
  certifications?: string[];
}

export interface UpdateProductDTO {
  name?: string;
  description?: string;
  images?: ProductImage[];
  batchNumber?: string;
  expiryDate?: Date;
  ingredients?: string[];
  certifications?: string[];
}

/**
 * In-Memory Database for Product Metadata
 */
class ProductDatabase {
  private products: Map<string, ProductMetadata> = new Map();
  private productIdIndex: Map<number, string> = new Map(); // productId -> id

  create(product: ProductMetadata): ProductMetadata {
    this.products.set(product.id, product);
    if (product.productId) {
      this.productIdIndex.set(product.productId, product.id);
    }
    return product;
  }

  findById(id: string): ProductMetadata | undefined {
    return this.products.get(id);
  }

  findByProductId(productId: number): ProductMetadata | undefined {
    const id = this.productIdIndex.get(productId);
    if (!id) return undefined;
    return this.products.get(id);
  }

  findByManufacturer(manufacturer: string): ProductMetadata[] {
    const results: ProductMetadata[] = [];
    for (const product of this.products.values()) {
      if (product.manufacturer.toLowerCase() === manufacturer.toLowerCase()) {
        results.push(product);
      }
    }
    return results;
  }

  update(id: string, updates: UpdateProductDTO): ProductMetadata | undefined {
    const existing = this.products.get(id);
    if (!existing) return undefined;

    const updated: ProductMetadata = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.products.set(id, updated);
    return updated;
  }

  linkToChain(id: string, productId: number): ProductMetadata | undefined {
    const existing = this.products.get(id);
    if (!existing) return undefined;

    existing.productId = productId;
    existing.updatedAt = new Date();
    this.productIdIndex.set(productId, id);
    return existing;
  }

  delete(id: string): boolean {
    const product = this.products.get(id);
    if (product && product.productId) {
      this.productIdIndex.delete(product.productId);
    }
    return this.products.delete(id);
  }

  getAll(): ProductMetadata[] {
    return Array.from(this.products.values());
  }

  count(): number {
    return this.products.size;
  }

  // Get products that haven't been linked to blockchain yet
  getUnlinked(): ProductMetadata[] {
    return Array.from(this.products.values()).filter(p => !p.productId);
  }
}

// Export singleton instance
export const productDB = new ProductDatabase();
