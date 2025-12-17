'use client';
import { useEffect, useState, useCallback } from "react";
import Web3 from "web3";
import SupplyChainABI from "../../artifacts/contracts/SupplyChain.sol/SupplyChain.json";
import { useRouter } from 'next/navigation';
import { Sidebar } from "../../components/Sidebar";
import { Icons } from "../../components/Icons";
import deployments from "../../deployments.json";
import { getProductsBatch, healthCheck } from "../../lib/api";

const getContractAddress = (): string => {
  const network1337 = deployments.networks["1337"];
  if (network1337?.SupplyChain?.address) {
    return network1337.SupplyChain.address;
  }
  return "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
};

interface Medicine {
  id: number;
  name: string;
  description: string;
  stage: number;
  manufacturer?: string;
  createdAt?: number;
}

interface Counts {
  manufacturers: number;
  distributors: number;
  retailers: number;
  medicines: number;
}

interface ApiStatus {
  connected: boolean;
  message: string;
}

const stageNames = ["Manufactured", "Packed", "Shipped to Distributor", "Received by Distributor", "Shipped to Retailer", "Received by Retailer", "Sold"];

export default function Dashboard() {
  const router = useRouter();
  const [currentAccount, setCurrentAccount] = useState<string>("");
  const [loader, setLoader] = useState<boolean>(true);
  const [counts, setCounts] = useState<Counts>({
    manufacturers: 0,
    distributors: 0,
    retailers: 0,
    medicines: 0,
  });
  const [recentMedicines, setRecentMedicines] = useState<Medicine[]>([]);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ connected: false, message: 'Checking...' });

  // Check backend API health
  const checkApiHealth = useCallback(async () => {
    try {
      const response = await healthCheck();
      if (response.success) {
        setApiStatus({ connected: true, message: 'Backend API connected' });
      } else {
        setApiStatus({ connected: false, message: 'Backend API offline' });
      }
    } catch {
      setApiStatus({ connected: false, message: 'Backend API unreachable' });
    }
  }, []);

  const loadBlockchainData = useCallback(async () => {
    setLoader(true);
    if (typeof window !== 'undefined' && window.ethereum) {
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.getAccounts();
      
      if (accounts.length === 0) {
        router.push('/');
        return;
      }

      setCurrentAccount(accounts[0]);
      const supplyChain = new web3.eth.Contract(
        SupplyChainABI.abi as any,
        getContractAddress()
      );

      const manCtr = await supplyChain.methods.manCtr().call();
      const disCtr = await supplyChain.methods.disCtr().call();
      const retCtr = await supplyChain.methods.retCtr().call();
      const medCtr = await supplyChain.methods.medicineCtr().call();

      setCounts({
        manufacturers: Number(manCtr),
        distributors: Number(disCtr),
        retailers: Number(retCtr),
        medicines: Number(medCtr),
      });

      // Load recent medicines from blockchain
      const meds: Medicine[] = [];
      const medCount = Number(medCtr);
      const start = Math.max(1, medCount - 4);
      const chainIds: number[] = [];
      
      for (let i = medCount; i >= start; i--) {
        const med = await supplyChain.methods.MedicineStock(i).call() as {
          id: bigint;
          manufacturer: string;
          stage: bigint;
          createdAt: bigint;
        };
        meds.push({
          id: Number(med.id),
          name: `Medicine #${med.id}`,
          description: `Created by ${med.manufacturer.slice(0, 6)}...${med.manufacturer.slice(-4)}`,
          stage: Number(med.stage),
          manufacturer: med.manufacturer,
          createdAt: Number(med.createdAt)
        });
        chainIds.push(Number(med.id));
      }

      // === HYBRID: Fetch off-chain metadata from backend ===
      if (chainIds.length > 0) {
        try {
          const metadataResponse = await getProductsBatch(chainIds);
          if (metadataResponse.success && metadataResponse.data) {
            // Merge off-chain metadata with on-chain data
            metadataResponse.data.forEach((metadata: any, index: number) => {
              if (metadata && meds[index]) {
                // If backend has name/description, use those (richer data)
                if (metadata.name) meds[index].name = metadata.name;
                if (metadata.description) meds[index].description = metadata.description;
              }
            });
          }
        } catch (error) {
          console.warn('Could not fetch off-chain metadata:', error);
        }
      }

      setRecentMedicines(meds);
      setLoader(false);
    } else {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    loadBlockchainData();
    checkApiHealth();
  }, [loadBlockchainData, checkApiHealth]);

  if (loader) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Manufacturers", value: counts.manufacturers, icon: <Icons.Manufacture className="w-8 h-8" />, color: "from-blue-500 to-cyan-500" },
    { label: "Distributors", value: counts.distributors, icon: <Icons.Distribution className="w-8 h-8" />, color: "from-purple-500 to-pink-500" },
    { label: "Retailers", value: counts.retailers, icon: <Icons.Retail className="w-8 h-8" />, color: "from-green-500 to-emerald-500" },
    { label: "Products", value: counts.medicines, icon: <Icons.Products className="w-8 h-8" />, color: "from-orange-500 to-amber-500" },
  ];

  const getStageColor = (stage: number) => {
    const colors = [
      "bg-gray-500",
      "bg-orange-500",
      "bg-blue-500",
      "bg-purple-500",
      "bg-green-500",
      "bg-emerald-500"
    ];
    return colors[stage] || colors[0];
  };

  const getStageIcon = (stage: number) => {
    const icons = [
      <Icons.Order key="order" className="w-4 h-4" />,
      <Icons.RawMaterial key="raw" className="w-4 h-4" />,
      <Icons.Manufacture key="manu" className="w-4 h-4" />,
      <Icons.Distribution key="dist" className="w-4 h-4" />,
      <Icons.Retail key="retail" className="w-4 h-4" />,
      <Icons.Sold key="sold" className="w-4 h-4" />
    ];
    return icons[stage] || icons[0];
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      <Sidebar currentAccount={currentAccount} />

      {/* Main Content */}
      <div className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard Overview</h1>
            <p className="text-gray-400">Welcome back! Here&apos;s your supply chain summary.</p>
          </div>
          {/* API Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            apiStatus.connected 
              ? 'bg-green-500/10 border border-green-500/30' 
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              apiStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className={`text-xs font-medium ${
              apiStatus.connected ? 'text-green-400' : 'text-red-400'
            }`}>
              {apiStatus.connected ? 'Hybrid Mode' : 'Blockchain Only'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-gray-700/50 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white`}>
                  {stat.icon}
                </div>
                <span className="text-3xl font-bold text-white">{stat.value}</span>
              </div>
              <h3 className="text-gray-400 text-sm font-medium">{stat.label}</h3>
            </div>
          ))}
        </div>

        {/* Total Products Card */}
        <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white text-xl font-semibold mb-1">Total Products</h2>
              <p className="text-blue-100 text-sm">Products registered in the supply chain</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-5xl font-bold text-white">{counts.medicines}</span>
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                <Icons.Products className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => router.push('/roles')}
            className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-blue-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
              <Icons.Participants className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-white font-semibold mb-1">Manage Participants</h3>
            <p className="text-gray-400 text-sm">Add suppliers, manufacturers, distributors & retailers</p>
          </button>

          <button
            onClick={() => router.push('/addmed')}
            className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-green-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
              <Icons.Products className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-white font-semibold mb-1">Manage Products</h3>
            <p className="text-gray-400 text-sm">Create and track pharmaceutical products</p>
          </button>

          <button
            onClick={() => router.push('/track')}
            className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-purple-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
              <Icons.Track className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-white font-semibold mb-1">Track Products</h3>
            <p className="text-gray-400 text-sm">View complete product history & QR codes</p>
          </button>
        </div>

        {/* Recent Products */}
        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Recent Products</h2>
            <button 
              onClick={() => router.push('/addmed')}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              View All →
            </button>
          </div>
          
          {recentMedicines.length === 0 ? (
            <div className="text-center py-12">
              <Icons.Products className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No products registered yet</p>
              <button 
                onClick={() => router.push('/addmed')}
                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Create First Product
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentMedicines.map((med) => (
                <div 
                  key={med.id}
                  className="flex items-center justify-between p-4 bg-[#0a0a0f] rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <span className="text-blue-400 font-bold">#{med.id}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium">{med.name}</h4>
                      </div>
                      <p className="text-gray-500 text-sm truncate max-w-xs">{med.description}</p>
                      {med.manufacturer && (
                        <p className="text-gray-600 text-xs mt-1">By: {med.manufacturer.slice(0, 6)}...{med.manufacturer.slice(-4)}</p>
                      )}
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStageColor(med.stage)} bg-opacity-20`}>
                    {getStageIcon(med.stage)}
                    <span className="text-white text-sm font-medium">{stageNames[med.stage]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
