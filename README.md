# 🔗 Pharmaceutical Supply Chain Blockchain DApp

**Course:** Blockchain Technology UET-VNU

A decentralized pharmaceutical supply chain management system built on Ethereum blockchain. Track medicines from manufacturer to consumer with complete transparency and immutability.

## ✨ Features

- **Role-Based Access Control (RBAC)** - 4 distinct roles with specific permissions
- **7-Stage Supply Chain Workflow** - Complete medicine lifecycle tracking
- **QR Code Generation** - Scan to verify product authenticity
- **Real-time Tracking** - View complete product journey on blockchain
- **MetaMask Integration** - Secure wallet-based authentication

---

## 🚀 Quick Start (3 Steps)

### Prerequisites
- **Node.js v18+** - [Download](https://nodejs.org/)
- **MetaMask** browser extension - [Install](https://metamask.io/)

### Step 1: Install Dependencies

```bash
# Clone the repository
git clone https://github.com/user/Supply-Chain-Blockchain.git
cd Supply-Chain-Blockchain

# Install all dependencies
cd smart-contracts && npm install && cd ..
cd client && npm install && cd ..
```

### Step 2: Start the Project (2 Terminals)

#### Terminal 1: Start Blockchain Node

```bash
cd smart-contracts
npx hardhat node
```

> ⚠️ Keep this terminal open! You'll see 20 test accounts with private keys.

#### Terminal 2: Deploy & Seed (Recommended)

```bash
cd smart-contracts

# Option A: Quick Start (Deploy + Register all roles + Create sample medicine)
npx hardhat run scripts/seed.ts --network localhost

# Option B: Deploy only (Manual setup required)
npx hardhat run scripts/deploy.ts --network localhost
```

#### Terminal 3: Start Frontend

```bash
cd client
npm run dev
```

✅ **Frontend running at:** http://localhost:3000

> 💡 **Using `seed.ts`** automatically registers Manufacturer, Distributor, Retailer and creates a sample medicine - no manual setup needed!

### Step 3: Configure MetaMask

#### 3.1 Add Hardhat Network

1. Open MetaMask → Networks → **Add Network** → **Add network manually**
2. Enter these details:

| Field | Value |
|-------|-------|
| Network Name | `Hardhat Local` |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `1337` |
| Currency Symbol | `ETH` |

3. Click **Save** and switch to this network

#### 3.2 Import Test Accounts

Import these accounts into MetaMask for testing:

| Role | Account | Private Key |
|------|---------|-------------|
| **Owner** | `0xf39F...2266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| **Manufacturer** | `0x7099...79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| **Distributor** | `0x3C44...93BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| **Retailer** | `0x90F7...b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |

**To import:** MetaMask → Account icon → **Import Account** → Paste private key

---

## 🎬 Demo Workflow

### Complete Demo Flow (5 minutes)

Follow this workflow to demonstrate the entire supply chain:

#### Step 1: Owner Registers Participants

1. **Connect as Owner** (Account #0: `0xf39F...2266`)
2. Go to **Participants** page (`/roles`)
3. Register participants:
   - Add Manufacturer: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Add Distributor: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
   - Add Retailer: `0x90F79bf6EB2c4f870365E785982E1f101E93b906`

#### Step 2: Manufacturer Creates Product

1. **Switch to Manufacturer** account in MetaMask
2. Refresh the page (role will update)
3. Go to **Products** page (`/addmed`)
4. Click **Add New Medicine**
5. Fill in medicine details and click **Create**

#### Step 3: Progress Through Supply Chain

Use the **My Tasks** page (`/tasks`) to advance the medicine:

| Step | Account | Action |
|------|---------|--------|
| 1 | Manufacturer | **Pack** the medicine |
| 2 | Manufacturer | **Ship to Distributor** |
| 3 | Distributor | **Receive** the shipment |
| 4 | Distributor | **Ship to Retailer** |
| 5 | Retailer | **Receive** the shipment |
| 6 | Retailer | **Sell** to customer |

#### Step 4: Track & Verify

1. Go to **Track** page (`/track`)
2. Enter the Medicine ID
3. View the complete journey timeline
4. Scan QR code to verify authenticity

---

## 📊 System Overview

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Owner** | Register Manufacturers, Distributors, Retailers |
| **Manufacturer** | Create medicines, Pack, Ship to Distributor |
| **Distributor** | Receive from Manufacturer, Ship to Retailer |
| **Retailer** | Receive from Distributor, Sell to Consumer |

### Supply Chain Stages

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│ MANUFACTURED │────▶│    PACKED    │────▶│ SHIPPED_TO_DISTRIBUTOR│
└──────────────┘     └──────────────┘     └──────────────────────┘
                                                     │
                     ┌───────────────────────────────┘
                     ▼
┌──────────────────────────┐     ┌─────────────────────┐
│ RECEIVED_BY_DISTRIBUTOR  │────▶│ SHIPPED_TO_RETAILER │
└──────────────────────────┘     └─────────────────────┘
                                            │
                     ┌──────────────────────┘
                     ▼
┌──────────────────────────┐     ┌──────────────┐
│  RECEIVED_BY_RETAILER    │────▶│     SOLD     │
└──────────────────────────┘     └──────────────┘
```

---

## 🏗 Project Structure

```
Supply-Chain-Blockchain/
├── smart-contracts/          # Blockchain layer
│   ├── contracts/            # Solidity smart contracts
│   │   └── SupplyChain.sol   # Main contract with RBAC
│   ├── scripts/              # Deployment scripts
│   └── hardhat.config.ts     # Hardhat configuration
│
├── client/                   # Frontend (Next.js 14)
│   ├── src/app/              # App Router pages
│   │   ├── dashboard/        # Role-based dashboard
│   │   ├── roles/            # Register participants
│   │   ├── addmed/           # Create medicines
│   │   ├── tasks/            # Role-specific actions
│   │   └── track/            # Track medicine journey
│   ├── src/components/       # React components
│   ├── src/hooks/            # Custom hooks (useRole)
│   └── src/lib/              # Web3 utilities
│
└── server/                   # Backend API (optional)
    └── src/                  # Express.js server
```

---

## 🔧 Troubleshooting

### "Failed to fetch" Error

The contract address might be stale. Fix:
```bash
cd smart-contracts
npx hardhat run scripts/deploy.ts --network localhost
```
Then refresh the browser.

### "Only owner can call" Error

You're not connected with the Owner account. Fix:
1. Switch to Account #0 in MetaMask: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
2. Refresh the page

### Transactions Stuck/Failing

If you restarted the Hardhat node:
1. Re-deploy contract: `npx hardhat run scripts/deploy.ts --network localhost`
2. In MetaMask: Settings → Advanced → **Clear activity tab data**
3. Refresh browser

### Wrong Network

Make sure MetaMask is connected to:
- Network: **Hardhat Local**
- Chain ID: **1337**
- RPC URL: **http://127.0.0.1:8545**

### Role Not Detected

After switching accounts in MetaMask:
1. Refresh the page
2. Reconnect wallet if prompted
3. Role badge in sidebar should update

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Ethereum (Hardhat Local) |
| Smart Contract | Solidity 0.8.28 |
| Frontend | Next.js 14, React, TailwindCSS |
| Web3 | Web3.js, MetaMask |
| Backend | Node.js, Express (optional) |

---

## 🧭 Hướng phát triển tương lai

- Triển khai production: cấu hình nhiều mạng (testnet/mainnet), script migrate dữ liệu và verify contract để sẵn sàng đưa lên môi trường thật.
- Củng cố bảo mật: thêm `Ownable`/multisig cho Owner, cơ chế pause/emergency withdraw, kiểm thử fuzz/coverage và checklist audit.
- Dữ liệu & truy xuất: lưu metadata/giấy tờ lô thuốc lên IPFS/Arweave kèm chữ ký số; mở API xác thực QR code từ nguồn công khai.
- Hiệu năng & quan sát: dựng indexer/off-chain cache (ví dụ The Graph/Redis) để tra cứu nhanh, thêm logging/metrics và cảnh báo khi giao dịch treo.
- Tính năng nghiệp vụ: hỗ trợ batch/lot, hạn dùng, recall/return, tracking nhiệt độ/vị trí qua oracle (Chainlink) hoặc tích hợp IoT gateway.
- Trải nghiệm người dùng: PWA/mobile-friendly, đa ngôn ngữ, thông báo theo vai trò (email/webhook) và hướng dẫn thao tác ngay trên UI.

---

## 📝 License

MIT License - feel free to use for learning and development.

---

## 🙋 Support

For issues or questions:
- Open an issue on GitHub
- Check the troubleshooting section above

**Happy Building! 🚀**
