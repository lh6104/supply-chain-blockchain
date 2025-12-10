'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadWeb3, getContract } from '@/lib/web3';
import { Icons } from '../../components/Icons';
import { QRCodeSVG } from 'qrcode.react';
import { createProduct, linkProductToChain, getProductByChainId, ProductMetadata } from '@/lib/api';
import { useRole } from '../../hooks/useRole';

interface Medicine {
  id: string;
  name: string;
  description: string;
  stage: string;
  chainData?: {
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  };
  apiData?: ProductMetadata | null;
}

// New stage names matching the updated contract
const stageNames = ["Manufactured", "Packed", "Shipped to Distributor", "Received by Distributor", "Shipped to Retailer", "Received by Retailer", "Sold"];

export default function Products() {
  const router = useRouter();
  const { role, isManufacturer, getRoleDisplayName } = useRole();
  const [currentAccount, setCurrentAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [supplyChain, setSupplyChain] = useState<any>(null);
  const [med, setMed] = useState<{ [key: number]: Medicine }>({});
  const [medStage, setMedStage] = useState<{ [key: number]: number }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDes, setMedDes] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [medImage, setMedImage] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QR Modal State
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedProductForQR, setSelectedProductForQR] = useState<Medicine | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadWeb3();
    loadBlockchainData();
  }, []);

  const loadBlockchainData = async () => {
    try {
      setLoading(true);
      const { contract, account } = await getContract();
      setSupplyChain(contract);
      setCurrentAccount(account);
      
      const medCtr = await contract.methods.medicineCtr().call();
      const medicines: { [key: number]: Medicine } = {};
      const stages: { [key: number]: number } = {};
      
      // Fetch all medicines from blockchain and API
      for (let i = 1; i <= Number(medCtr); i++) {
        // Get on-chain data (stage, timestamps, etc.)
        const chainMedicine = await contract.methods.MedicineStock(i).call();
        const stageNum = Number(chainMedicine.stage);
        
        // Fetch off-chain metadata from API
        let apiData: ProductMetadata | null = null;
        try {
          const apiResponse = await getProductByChainId(i);
          if (apiResponse.success && apiResponse.data) {
            apiData = apiResponse.data;
          }
        } catch (err) {
          console.warn(`No API metadata found for medicine ${i}`);
        }
        
        // Combine on-chain + off-chain data
        medicines[i] = {
          id: chainMedicine.id.toString(),
          name: apiData?.name || `Product #${i}`,
          description: apiData?.description || 'No description available',
          stage: stageNum.toString(),
          chainData: {
            createdBy: chainMedicine.createdBy,
            createdAt: Number(chainMedicine.createdAt),
            updatedAt: Number(chainMedicine.updatedAt),
          },
          apiData,
        };
        stages[i] = stageNum;
      }
      setMed(medicines);
      setMedStage(stages);

      setLoading(false);
    } catch (error) {
      console.error('Error loading blockchain data:', error);
      setLoading(false);
    }
  };

  const getStageInfo = (stage: number) => {
    const stageConfig = [
      { label: 'Manufactured', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/30', icon: <Icons.Manufacture className="w-3 h-3" /> },
      { label: 'Packed', color: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30', icon: <Icons.Products className="w-3 h-3" /> },
      { label: 'Shipped to Dist.', color: 'bg-orange-500/10 text-orange-400 border border-orange-500/30', icon: <Icons.Distribution className="w-3 h-3" /> },
      { label: 'At Distributor', color: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30', icon: <Icons.Distribution className="w-3 h-3" /> },
      { label: 'Shipped to Ret.', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/30', icon: <Icons.Distribution className="w-3 h-3" /> },
      { label: 'At Retailer', color: 'bg-pink-500/10 text-pink-400 border border-pink-500/30', icon: <Icons.Retail className="w-3 h-3" /> },
      { label: 'Sold', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30', icon: <Icons.Sold className="w-3 h-3" /> }
    ];
    return stageConfig[stage] || stageConfig[0];
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setMedImage(base64String);
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplyChain || !medName || !medDes) return;

    try {
      setIsSubmitting(true);
      
      // === HYBRID APPROACH (2-Step Process) ===
      
      // Step 1: Save metadata to backend API (Off-chain)
      console.log('Step 1: Saving metadata to backend API...');
      const apiResponse = await createProduct({
        name: medName,
        description: medDes,
        manufacturer: currentAccount,
        batchNumber: batchNumber || undefined,
      });

      if (!apiResponse.success || !apiResponse.data) {
        throw new Error(apiResponse.error?.message || 'Failed to save product metadata to server');
      }

      const internalId = apiResponse.data.id;
      console.log('Step 1 Success: Internal ID =', internalId);

      // Step 2: Create on-chain record (On-chain)
      // The contract's addMedicine() requires onlyManufacturer
      console.log('Step 2: Creating on-chain record...');
      try {
        await supplyChain.methods.addMedicine().send({ from: currentAccount });
      } catch (txError: any) {
        console.error('Transaction failed:', txError);
        const errorMessage = txError?.message?.includes('User denied')
          ? 'Transaction was rejected by user'
          : txError?.message?.includes('Only manufacturer')
          ? 'Only registered Manufacturers can create products'
          : 'Blockchain transaction failed. Please try again.';
        throw new Error(errorMessage);
      }
      
      // Get the new medicine ID from the counter
      const medCtr = await supplyChain.methods.medicineCtr().call();
      const chainId = Number(medCtr);
      console.log('Step 2 Success: Chain ID =', chainId);

      // Step 3: Link backend record to blockchain ID
      console.log('Step 3: Linking records...');
      const linkResponse = await linkProductToChain(internalId, chainId);
      
      if (!linkResponse.success) {
        console.warn('Warning: Failed to link records:', linkResponse.error?.message);
      }

      console.log('Product created successfully!');
      
      // Reset form and close modal
      resetCreateForm();
      setShowCreateModal(false);
      await loadBlockchainData();
    } catch (error) {
      console.error('Error creating product:', error);
      alert(error instanceof Error ? error.message : 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setMedName('');
    setMedDes('');
    setBatchNumber('');
    setMedImage('');
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openQRModal = (product: Medicine) => {
    setSelectedProductForQR(product);
    setShowQRModal(true);
  };

  const downloadQRCode = () => {
    if (!qrRef.current || !selectedProductForQR) return;
    
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      
      const link = document.createElement('a');
      link.download = `product-${selectedProductForQR.id}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = svgUrl;
  };

  const getTrackingUrl = (productId: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/track?id=${productId}`;
    }
    return `/track?id=${productId}`;
  };

  if (loading || role === 'LOADING') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading products...</p>
        </div>
      </div>
    );
  }

  const canCreateProduct = isManufacturer();

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="p-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-xl transition-colors"
        >
          <Icons.ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Products</h1>
            <p className="text-gray-400">Manage pharmaceutical products in the supply chain</p>
          </div>
          {/* Create Product Button with Permission Check */}
          <div className="relative group">
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!canCreateProduct}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Icons.Plus className="w-5 h-5" />
              Create Product
            </button>
            {/* Tooltip for non-manufacturers */}
            {!canCreateProduct && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="flex items-center gap-2">
                  <Icons.Lock className="w-4 h-4 text-amber-400" />
                  Only Manufacturers can create products
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-700"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Role Info Banner for non-manufacturers */}
        {!canCreateProduct && (
          <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Icons.Participants className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-blue-400 font-medium">Your Role: {getRoleDisplayName()}</h3>
              <p className="text-blue-400/80 text-sm">
                {role === 'OWNER' && 'As the Owner, you can register participants but not create products. Register a Manufacturer to create products.'}
                {role === 'DISTRIBUTOR' && 'As a Distributor, you can receive shipments and forward products to retailers.'}
                {role === 'RETAILER' && 'As a Retailer, you can receive products and sell them to customers.'}
                {role === 'UNREGISTERED' && 'You are not registered in the supply chain. Contact the Owner to get registered.'}
              </p>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Icons.Products className="w-5 h-5 text-blue-400" />
              All Products
            </h3>
            <span className="text-sm text-gray-400">{Object.keys(med).length} items</span>
          </div>
          <div className="p-4">
            {Object.keys(med).length === 0 ? (
              <div className="text-center py-12">
                <Icons.Products className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No products yet</p>
                <p className="text-sm text-gray-500">
                  {canCreateProduct 
                    ? 'Create your first product to get started' 
                    : 'Products will appear here once a Manufacturer creates them'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                      <th className="pb-3 font-medium">ID</th>
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium">Batch</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Created</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(med).map(key => {
                      const idx = parseInt(key);
                      const item = med[idx];
                      const stageInfo = getStageInfo(medStage[idx] || 0);
                      return (
                        <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                          <td className="py-4">
                            <span className="text-white font-mono">#{item.id}</span>
                          </td>
                          <td className="py-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-white font-medium">{item.name}</p>
                                {item.apiData && (
                                  <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 text-[10px] rounded font-medium">
                                    HYBRID
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-500 text-sm truncate max-w-xs">{item.description}</p>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="text-gray-400 text-sm">
                              {item.apiData?.batchNumber || '-'}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${stageInfo.color}`}>
                              {stageInfo.icon}
                              {stageInfo.label}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className="text-gray-500 text-sm">
                              {item.chainData?.createdAt 
                                ? new Date(item.chainData.createdAt * 1000).toLocaleDateString()
                                : '-'}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openQRModal(item)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                title="View QR Code"
                              >
                                <Icons.QRCode className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => router.push(`/track?id=${item.id}`)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                title="Track Product"
                              >
                                <Icons.Track className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#12121a] rounded-2xl border border-gray-800 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Create New Product</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Aspirin 500mg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={medDes}
                  onChange={(e) => setMedDes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Describe the pharmaceutical product..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Batch Number
                </label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder="e.g., BATCH-2024-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Product Image (Optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-gray-700 border-dashed rounded-xl text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
                >
                  {imagePreview ? 'Change Image' : 'Click to upload image'}
                </button>
                {imagePreview && (
                  <div className="mt-2 relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => { setMedImage(''); setImagePreview(''); }}
                      className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white"
                    >
                      <Icons.Close className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !medName || !medDes}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Product'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedProductForQR && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#12121a] rounded-2xl border border-gray-800 w-full max-w-sm mx-4">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Product QR Code</h2>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="text-center mb-4">
                <h3 className="text-white font-medium">{selectedProductForQR.name}</h3>
                <p className="text-gray-400 text-sm">ID: #{selectedProductForQR.id}</p>
              </div>
              <div ref={qrRef} className="bg-white p-4 rounded-xl flex items-center justify-center mb-4">
                <QRCodeSVG
                  value={getTrackingUrl(selectedProductForQR.id)}
                  size={200}
                  level="H"
                />
              </div>
              <p className="text-gray-500 text-xs text-center mb-4">
                Scan this QR code to track the product
              </p>
              <button
                onClick={downloadQRCode}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Icons.Download className="w-4 h-4" />
                Download QR Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
