'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadWeb3, getContract } from '@/lib/web3';
import { checkIsOwner, getContractOwner } from '@/lib/contractUtils';
import { Icons } from '../../components/Icons';
import { QRCodeSVG } from 'qrcode.react';
import { createProduct, linkProductToChain, getProductByChainId } from '@/lib/api';

interface Medicine {
  id: string;
  name: string;
  description: string;
  stage: string;
}

export default function Products() {
  const router = useRouter();
  const [currentAccount, setCurrentAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [supplyChain, setSupplyChain] = useState<any>(null);
  const [med, setMed] = useState<{ [key: number]: Medicine }>({});
  const [medStage, setMedStage] = useState<{ [key: number]: number }>({});
  const [isOwner, setIsOwner] = useState(false);
  const [roleCounts, setRoleCounts] = useState({ rms: 0, man: 0, dis: 0, ret: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDes, setMedDes] = useState('');
  const [medPrice, setMedPrice] = useState('');
  const [medImage, setMedImage] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QR Modal State
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedProductForQR, setSelectedProductForQR] = useState<Medicine | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedProductForTransfer, setSelectedProductForTransfer] = useState<Medicine | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

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
      
      for (let i = 1; i <= Number(medCtr); i++) {
        const medicine = await contract.methods.MedicineStock(i).call();
        // Try to get metadata from backend API
        let name = `Medicine #${i}`;
        let description = `Created by manufacturer`;
        
        try {
          const metadata = await getProductByChainId(i);
          if (metadata.success && metadata.data) {
            name = metadata.data.name || name;
            description = metadata.data.description || description;
          }
        } catch (e) {
          // Use defaults if backend unavailable
        }
        
        medicines[i] = {
          id: medicine.id.toString(),
          name: name,
          description: description,
          stage: medicine.stage.toString()
        };
        stages[i] = Number(medicine.stage);
      }
      setMed(medicines);
      setMedStage(stages);

      // Check owner status
      const owner = await contract.methods.Owner().call();
      const isOwnerAccount = owner.toLowerCase() === account.toLowerCase();
      setIsOwner(isOwnerAccount);

      // Get role counts and determine user role
      const manCount = await contract.methods.manCtr().call();
      const disCount = await contract.methods.disCtr().call();
      const retCount = await contract.methods.retCtr().call();
      setRoleCounts({
        rms: 1, // Always allow since there's no RMS role
        man: Number(manCount),
        dis: Number(disCount),
        ret: Number(retCount)
      });

      // Determine user's role
      if (isOwnerAccount) {
        setUserRole('ADMIN');
      } else {
        // Check if user is a manufacturer
        for (let i = 1; i <= Number(manCount); i++) {
          const man = await contract.methods.MAN(i).call();
          if (man.addr.toLowerCase() === account.toLowerCase()) {
            setUserRole('MANUFACTURER');
            break;
          }
        }
        // Check if user is a distributor
        for (let i = 1; i <= Number(disCount); i++) {
          const dis = await contract.methods.DIS(i).call();
          if (dis.addr.toLowerCase() === account.toLowerCase()) {
            setUserRole('DISTRIBUTOR');
            break;
          }
        }
        // Check if user is a retailer
        for (let i = 1; i <= Number(retCount); i++) {
          const ret = await contract.methods.RET(i).call();
          if (ret.addr.toLowerCase() === account.toLowerCase()) {
            setUserRole('RETAILER');
            break;
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading blockchain data:', error);
      setLoading(false);
    }
  };

  const getStageNumber = (stage: number): number => {
    return stage;
  };

  const getStageInfo = (stage: number) => {
    const stageConfig = [
      { label: 'Manufactured', color: 'bg-gray-500/10 text-gray-400 border border-gray-500/30', icon: <Icons.Manufacture className="w-3 h-3" /> },
      { label: 'Packed', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/30', icon: <Icons.Products className="w-3 h-3" /> },
      { label: 'Shipped to Dist', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/30', icon: <Icons.Distribution className="w-3 h-3" /> },
      { label: 'Received by Dist', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/30', icon: <Icons.Distribution className="w-3 h-3" /> },
      { label: 'Shipped to Retail', color: 'bg-orange-500/10 text-orange-400 border border-orange-500/30', icon: <Icons.Retail className="w-3 h-3" /> },
      { label: 'Received by Retail', color: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30', icon: <Icons.Retail className="w-3 h-3" /> },
      { label: 'Sold', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30', icon: <Icons.Sold className="w-3 h-3" /> }
    ];
    return stageConfig[stage] || stageConfig[0];
  };

  const allRolesRegistered = roleCounts.man > 0 && roleCounts.dis > 0 && roleCounts.ret > 0;

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
      
      // === HYBRID APPROACH ===
      // Step 1: Save metadata to backend API first
      const apiResponse = await createProduct({
        name: medName,
        description: medDes,
        manufacturer: currentAccount,
        // Images are optional and handled by the backend
      });

      if (!apiResponse.success || !apiResponse.data) {
        throw new Error(apiResponse.error?.message || 'Failed to save product metadata');
      }

      const internalId = apiResponse.data.id;

      // Step 2: Create on-chain record (only stores ID, stage, timestamps)
      // The optimized contract's addMedicine() takes no parameters
      await supplyChain.methods.addMedicine().send({ from: currentAccount });
      
      // Get the new medicine ID
      const medCtr = await supplyChain.methods.medicineCtr().call();
      const chainId = Number(medCtr);

      // Step 3: Link backend record to blockchain ID
      const linkResponse = await linkProductToChain(internalId, chainId);
      
      if (!linkResponse.success) {
        console.warn('Warning: Failed to link records:', linkResponse.error?.message);
      }

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
    setMedPrice('');
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

  // Transfer Modal Functions
  const openTransferModal = (product: Medicine) => {
    setSelectedProductForTransfer(product);
    setShowTransferModal(true);
  };

  const getNextAction = (stage: number) => {
    const actions: { [key: number]: { label: string; method: string; role: string; nextStage: string } } = {
      0: { label: 'Pack Product', method: 'pack', role: 'MANUFACTURER', nextStage: 'Packed' },
      1: { label: 'Ship to Distributor', method: 'shipToDistributor', role: 'MANUFACTURER', nextStage: 'Shipped to Distributor' },
      2: { label: 'Receive Shipment', method: 'receiveByDistributor', role: 'DISTRIBUTOR', nextStage: 'Received by Distributor' },
      3: { label: 'Ship to Retailer', method: 'shipToRetailer', role: 'DISTRIBUTOR', nextStage: 'Shipped to Retailer' },
      4: { label: 'Receive Shipment', method: 'receiveByRetailer', role: 'RETAILER', nextStage: 'Received by Retailer' },
      5: { label: 'Mark as Sold', method: 'sell', role: 'RETAILER', nextStage: 'Sold' },
    };
    return actions[stage] || null;
  };

  const canPerformAction = (stage: number) => {
    const action = getNextAction(stage);
    if (!action) return false;
    return userRole === action.role || userRole === 'ADMIN';
  };

  const handleTransfer = async () => {
    if (!supplyChain || !selectedProductForTransfer) return;
    
    const productId = parseInt(selectedProductForTransfer.id);
    const stage = parseInt(selectedProductForTransfer.stage);
    const action = getNextAction(stage);
    
    if (!action) return;

    try {
      setTransferring(true);
      
      switch (action.method) {
        case 'pack':
          await supplyChain.methods.pack(productId).send({ from: currentAccount });
          break;
        case 'shipToDistributor':
          await supplyChain.methods.shipToDistributor(productId, 1).send({ from: currentAccount });
          break;
        case 'receiveByDistributor':
          await supplyChain.methods.receiveByDistributor(productId).send({ from: currentAccount });
          break;
        case 'shipToRetailer':
          await supplyChain.methods.shipToRetailer(productId, 1).send({ from: currentAccount });
          break;
        case 'receiveByRetailer':
          await supplyChain.methods.receiveByRetailer(productId).send({ from: currentAccount });
          break;
        case 'sell':
          await supplyChain.methods.sell(productId).send({ from: currentAccount });
          break;
      }
      
      setShowTransferModal(false);
      setSelectedProductForTransfer(null);
      await loadBlockchainData();
    } catch (error: any) {
      console.error('Transfer error:', error);
      alert(error?.message || 'Transfer failed. Make sure you have the correct role.');
    } finally {
      setTransferring(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrRef.current || !selectedProductForQR) return;
    
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    // Create a canvas to convert SVG to PNG
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
      
      // Download as PNG
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading products...</p>
        </div>
      </div>
    );
  }

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
          {isOwner && (
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!allRolesRegistered}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Icons.Plus className="w-5 h-5" />
              Create Product
            </button>
          )}
        </div>

        {/* Role Warning */}
        {isOwner && !allRolesRegistered && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Icons.Warning className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-amber-400 font-medium">Setup Required</h3>
              <p className="text-amber-400/80 text-sm">
                Register at least one participant for each role before creating products.
                Missing: {[
                  roleCounts.rms === 0 && 'RMS',
                  roleCounts.man === 0 && 'Manufacturer',
                  roleCounts.dis === 0 && 'Distributor',
                  roleCounts.ret === 0 && 'Retailer'
                ].filter(Boolean).join(', ')}
              </p>
            </div>
            <button
              onClick={() => router.push('/roles')}
              className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-sm font-medium"
            >
              Register Roles
            </button>
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
                <p className="text-sm text-gray-500">Create your first product to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                      <th className="pb-3 font-medium">ID</th>
                      <th className="pb-3 font-medium">Image</th>
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium">Price</th>
                      <th className="pb-3 font-medium">Status</th>
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
                            <span className="w-8 h-8 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center font-bold text-sm">
                              {item.id}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                              <Icons.Products className="w-6 h-6 text-gray-600" />
                            </div>
                          </td>
                          <td className="py-4">
                            <div>
                              <p className="font-medium text-white">{item.name}</p>
                              <p className="text-xs text-gray-500 max-w-[200px] truncate">{item.description}</p>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="text-gray-500">-</span>
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${stageInfo.color}`}>
                              {stageInfo.icon}
                              {stageInfo.label}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center justify-end gap-2">
                              {/* Transfer Button - show if user has an action for this product */}
                              {canPerformAction(medStage[idx] || 0) && (
                                <button
                                  onClick={() => openTransferModal(item)}
                                  className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors text-xs font-medium flex items-center gap-1.5"
                                  title={getNextAction(medStage[idx] || 0)?.label || ''}
                                >
                                  <Icons.Arrow className="w-3 h-3" />
                                  {getNextAction(medStage[idx] || 0)?.label}
                                </button>
                              )}
                              <button
                                onClick={() => openQRModal(item)}
                                className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                title="Get QR Code"
                              >
                                <Icons.QRCode className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => router.push(`/track?id=${item.id}`)}
                                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                                title="Track Product"
                              >
                                <Icons.Track className="w-4 h-4 text-gray-400" />
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#12121a] rounded-2xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Icons.Products className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Create New Product</h2>
                  <p className="text-sm text-gray-500">Enter product details</p>
                </div>
              </div>
              <button
                onClick={() => {
                  resetCreateForm();
                  setShowCreateModal(false);
                }}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Icons.Close className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Product Image (Optional)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-600 transition-colors overflow-hidden"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Icons.Upload className="w-8 h-8 text-gray-600 mb-2" />
                      <span className="text-sm text-gray-500">Click to upload image</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Product Name *</label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Enter product name"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Description *</label>
                <textarea
                  value={medDes}
                  onChange={(e) => setMedDes(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  rows={3}
                  placeholder="Enter product description"
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={medPrice}
                  onChange={(e) => setMedPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="0.00"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setShowCreateModal(false);
                  }}
                  className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !medName || !medDes}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Icons.Plus className="w-5 h-5" />
                      Create Product
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedProductForQR && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#12121a] rounded-2xl border border-gray-800 w-full max-w-md">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Icons.QRCode className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Product QR Code</h2>
                  <p className="text-sm text-gray-500">#{selectedProductForQR.id} - {selectedProductForQR.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setSelectedProductForQR(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Icons.Close className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              {/* QR Code Display */}
              <div className="flex flex-col items-center mb-6">
                <div ref={qrRef} className="bg-white p-4 rounded-xl mb-4">
                  <QRCodeSVG 
                    value={getTrackingUrl(selectedProductForQR.id)}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-sm text-gray-400 text-center">
                  Scan to verify and track this product
                </p>
              </div>

              {/* URL Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-2">Tracking URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getTrackingUrl(selectedProductForQR.id)}
                    className="flex-1 px-4 py-2 bg-[#0a0a0f] border border-gray-800 rounded-lg text-white text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(getTrackingUrl(selectedProductForQR.id))}
                    className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                    title="Copy URL"
                  >
                    <Icons.Copy className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/track?id=${selectedProductForQR.id}`)}
                  className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Icons.Track className="w-5 h-5" />
                  View Details
                </button>
                <button
                  onClick={downloadQRCode}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
                >
                  <Icons.Download className="w-5 h-5" />
                  Download QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Product Modal */}
      {showTransferModal && selectedProductForTransfer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#12121a] rounded-2xl border border-gray-800 w-full max-w-md">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Icons.Arrow className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Transfer Product</h2>
                  <p className="text-sm text-gray-500">{getNextAction(parseInt(selectedProductForTransfer.stage))?.label}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setSelectedProductForTransfer(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Icons.Close className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              {/* Product Info */}
              <div className="bg-[#0a0a0f] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center">
                    <Icons.Products className="w-8 h-8 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{selectedProductForTransfer.name}</h3>
                    <p className="text-sm text-gray-500">ID: {selectedProductForTransfer.id}</p>
                    <p className="text-xs text-gray-600 mt-1">{selectedProductForTransfer.description}</p>
                  </div>
                </div>
              </div>

              {/* Transfer Info */}
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <Icons.Info className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-green-400 font-medium text-sm">Action: {getNextAction(parseInt(selectedProductForTransfer.stage))?.label}</p>
                    <p className="text-green-400/70 text-xs mt-1">
                      Next stage: {getNextAction(parseInt(selectedProductForTransfer.stage))?.nextStage}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedProductForTransfer(null);
                  }}
                  className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleTransfer()}
                  disabled={transferring}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {transferring ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Icons.Arrow className="w-5 h-5" />
                      Confirm Transfer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
