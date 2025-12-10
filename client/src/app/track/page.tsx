'use client';
import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadWeb3, getContract } from '@/lib/web3';
import { QRCodeSVG } from 'qrcode.react';
import { Sidebar } from '../../components/Sidebar';
import { Icons } from '../../components/Icons';
import { Timeline, TimelineItemData, TimelineItemStatus } from '../../components/Timeline';
import { getProductByChainId } from '../../lib/api';

interface Medicine {
  id: string;
  name: string;
  description: string;
  stage: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  // Off-chain metadata
  hasMetadata?: boolean;
  batchNumber?: string;
  expiryDate?: string;
  manufacturer?: string;
  certifications?: string[];
}

// New stage names matching the updated contract
const stageNames = ["Manufactured", "Packed", "Shipped to Distributor", "Received by Distributor", "Shipped to Retailer", "Received by Retailer", "Sold"];

function TrackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentAccount, setCurrentAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [supplyChain, setSupplyChain] = useState<any>(null);
  const [searchId, setSearchId] = useState('');
  const [product, setProduct] = useState<Medicine | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadWeb3();
    loadBlockchainData();
  }, []);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id && supplyChain) {
      setSearchId(id);
      handleSearch(id);
    }
  }, [searchParams, supplyChain]);

  const loadBlockchainData = async () => {
    try {
      setLoading(true);
      const { contract, account } = await getContract();
      setSupplyChain(contract);
      setCurrentAccount(account);
      setLoading(false);
    } catch (err: any) {
      alert(err?.message || 'Contract not deployed');
      setLoading(false);
    }
  };

  const handleSearch = async (id?: string) => {
    const searchFor = id || searchId;
    if (!searchFor) { alert('Please enter a product ID'); return; }
    setSearching(true);
    try {
      const med = await supplyChain.methods.MedicineStock(parseInt(searchFor)).call();
      
      // Create product object with on-chain data
      const productData: Medicine = {
        id: med.id.toString(),
        name: `Product #${med.id}`,
        description: '',
        stage: Number(med.stage),
        createdBy: med.createdBy,
        createdAt: Number(med.createdAt),
        updatedAt: Number(med.updatedAt),
        hasMetadata: false
      };
      
      // === HYBRID: Fetch off-chain metadata ===
      try {
        const metadataResponse = await getProductByChainId(parseInt(searchFor));
        if (metadataResponse.success && metadataResponse.data) {
          const metadata = metadataResponse.data;
          productData.hasMetadata = true;
          productData.batchNumber = metadata.batchNumber;
          productData.expiryDate = metadata.expiryDate;
          productData.manufacturer = metadata.manufacturer;
          productData.certifications = metadata.certifications;
          if (metadata.name) productData.name = metadata.name;
          if (metadata.description) productData.description = metadata.description;
        }
      } catch (error) {
        console.warn('Could not fetch off-chain metadata:', error);
      }
      
      setProduct(productData);
    } catch (err: any) {
      alert('Product not found');
      setProduct(null);
    }
    finally { setSearching(false); }
  };

  const currentStage = product ? product.stage : -1;

  // Stage definitions with descriptions for new workflow
  const stageDefinitions = [
    { 
      id: 0, 
      label: 'Manufactured', 
      description: 'Product has been manufactured and quality checked',
      icon: <Icons.Manufacture className="w-5 h-5" />, 
      color: 'bg-blue-500',
      actor: 'Manufacturer'
    },
    { 
      id: 1, 
      label: 'Packed', 
      description: 'Product has been packaged for shipping',
      icon: <Icons.Products className="w-5 h-5" />, 
      color: 'bg-cyan-500',
      actor: 'Manufacturer'
    },
    { 
      id: 2, 
      label: 'Shipped to Distributor', 
      description: 'Product has been shipped to the distributor',
      icon: <Icons.Distribution className="w-5 h-5" />, 
      color: 'bg-orange-500',
      actor: 'Manufacturer'
    },
    { 
      id: 3, 
      label: 'Received by Distributor', 
      description: 'Distributor has received and verified the product',
      icon: <Icons.Distribution className="w-5 h-5" />, 
      color: 'bg-yellow-500',
      actor: 'Distributor'
    },
    { 
      id: 4, 
      label: 'Shipped to Retailer', 
      description: 'Product has been shipped to the retail location',
      icon: <Icons.Distribution className="w-5 h-5" />, 
      color: 'bg-purple-500',
      actor: 'Distributor'
    },
    { 
      id: 5, 
      label: 'Received by Retailer', 
      description: 'Retailer has received the product for sale',
      icon: <Icons.Retail className="w-5 h-5" />, 
      color: 'bg-pink-500',
      actor: 'Retailer'
    },
    { 
      id: 6, 
      label: 'Sold', 
      description: 'Product has been sold to the end customer',
      icon: <Icons.Sold className="w-5 h-5" />, 
      color: 'bg-green-500',
      actor: 'Retailer'
    },
  ];

  // Build timeline items from blockchain data
  const timelineItems: TimelineItemData[] = useMemo(() => {
    if (!product) return [];

    return stageDefinitions.map((stage) => {
      let status: TimelineItemStatus = 'pending';
      if (stage.id < currentStage) status = 'completed';
      else if (stage.id === currentStage) status = 'current';

      let timestamp: string | undefined = undefined;
      
      if (status === 'completed' || status === 'current') {
        if (stage.id === 0) {
          timestamp = new Date(product.createdAt * 1000).toLocaleString();
        } else if (stage.id === currentStage) {
          timestamp = new Date(product.updatedAt * 1000).toLocaleString();
        } else {
          timestamp = 'Completed';
        }
      }

      return {
        id: stage.id,
        label: stage.label,
        description: stage.description,
        icon: stage.icon,
        status,
        color: stage.color,
        actor: status !== 'pending' ? {
          name: stage.actor,
          address: stage.id === 0 ? product.createdBy : undefined,
        } : undefined,
        timestamp,
      };
    });
  }, [product, currentStage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      <Sidebar />
      <div className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Track Product</h1>
          <p className="text-gray-400">Trace the complete journey of pharmaceutical products through the supply chain</p>
        </div>

        {/* Search */}
        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 mb-8">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Icons.Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter Product ID (e.g., 1, 2, 3...)"
                className="w-full pl-12 pr-4 py-3 bg-[#0a0a0f] border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={searching}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {searching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Icons.Search className="w-4 h-4" />
                  Track
                </>
              )}
            </button>
          </div>
        </div>

        {/* Product Details */}
        {product && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Product Info + QR */}
            <div className="lg:col-span-1 space-y-6">
              {/* Product Card */}
              <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Product Info</h2>
                  {product.hasMetadata && (
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full font-medium border border-green-500/30">
                      HYBRID
                    </span>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Product ID</p>
                    <p className="text-white font-mono">#{product.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Name</p>
                    <p className="text-white font-medium">{product.name}</p>
                  </div>
                  {product.description && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Description</p>
                      <p className="text-gray-300 text-sm">{product.description}</p>
                    </div>
                  )}
                  {product.batchNumber && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Batch Number</p>
                      <p className="text-white font-mono text-sm">{product.batchNumber}</p>
                    </div>
                  )}
                  {product.expiryDate && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Expiry Date</p>
                      <p className="text-white text-sm">{product.expiryDate}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current Status</p>
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                      currentStage === 6 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {stageNames[currentStage] || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Created By</p>
                    <p className="text-gray-400 font-mono text-xs">
                      {product.createdBy.slice(0, 10)}...{product.createdBy.slice(-8)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Created At</p>
                    <p className="text-gray-300 text-sm">
                      {new Date(product.createdAt * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
                <h2 className="text-lg font-semibold text-white mb-4">QR Code</h2>
                <div className="bg-white p-4 rounded-xl flex items-center justify-center">
                  <QRCodeSVG
                    value={typeof window !== 'undefined' ? `${window.location.origin}/track?id=${product.id}` : `/track?id=${product.id}`}
                    size={180}
                    level="H"
                  />
                </div>
                <p className="text-gray-500 text-xs text-center mt-3">
                  Scan to verify product authenticity
                </p>
              </div>

              {/* Certifications */}
              {product.certifications && product.certifications.length > 0 && (
                <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
                  <h2 className="text-lg font-semibold text-white mb-4">Certifications</h2>
                  <div className="flex flex-wrap gap-2">
                    {product.certifications.map((cert, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-500/10 text-purple-400 text-sm rounded-full border border-purple-500/30">
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Timeline */}
            <div className="lg:col-span-2">
              <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Supply Chain Journey</h2>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Progress:</span>
                    <span className="text-blue-400 font-medium">{Math.round((currentStage / 6) * 100)}%</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${(currentStage / 6) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Timeline */}
                <Timeline items={timelineItems} />
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!product && !searching && (
          <div className="bg-[#12121a] rounded-2xl p-12 border border-gray-800/50 text-center">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icons.Search className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Track a Product</h2>
            <p className="text-gray-400 max-w-md mx-auto mb-6">
              Enter a product ID above to view its complete journey through the pharmaceutical supply chain.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                <span>Pending</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    }>
      <TrackContent />
    </Suspense>
  );
}
