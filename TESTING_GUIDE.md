# 🧪 Testing Guide: Pharmaceutical Supply Chain RBAC Workflow

This guide walks you through testing the refactored Role-Based Access Control (RBAC) system with 4 distinct roles.

## 📋 New Workflow Overview

### Roles & Permissions

| Role | Wallet | Permissions |
|------|--------|-------------|
| **Owner** | Account #0 | Register participants ONLY (cannot create products) |
| **Manufacturer** | Account #1 | Create products, Pack, Ship to Distributor |
| **Distributor** | Account #2 | Receive from Manufacturer, Ship to Retailer |
| **Retailer** | Account #3 | Receive from Distributor, Sell to Customer |

### Supply Chain Flow (7 Stages)

```
Manufactured → Packed → ShippedToDistributor → ReceivedByDistributor → ShippedToRetailer → ReceivedByRetailer → Sold
     ↑            ↑              ↑                      ↑                      ↑                    ↑            ↑
 Manufacturer  Manufacturer  Manufacturer          Distributor            Distributor           Retailer     Retailer
```

---

## 🚀 Step-by-Step Testing

### Prerequisites

1. **Start Hardhat Node** (Terminal 1):
   ```bash
   cd smart-contracts
   npx hardhat node
   ```

2. **Deploy Contract** (Terminal 2):
   ```bash
   cd smart-contracts
   npx hardhat run scripts/deploy.ts --network localhost
   ```

3. **Start Backend** (Terminal 3):
   ```bash
   cd server
   npm run dev
   ```

4. **Start Frontend** (Terminal 4):
   ```bash
   cd client
   npm run dev
   ```

5. **Import Test Accounts into MetaMask**:
   
   | Account | Private Key | Role |
   |---------|-------------|------|
   | #0 (Owner) | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` | Owner |
   | #1 (Manufacturer) | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` | Manufacturer |
   | #2 (Distributor) | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` | Distributor |
   | #3 (Retailer) | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` | Retailer |

---

### Phase 1: Owner Registers Participants

**Switch to Account #0 (Owner) in MetaMask**

1. Open [http://localhost:3000](http://localhost:3000)
2. Connect Wallet (Account #0)
3. You should see **"Owner Dashboard"** with "User Management" card
4. Go to **Participants** page
5. Register each participant:

   | Role | Address (Account) |
   |------|-------------------|
   | Manufacturer | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (Account #1) |
   | Distributor | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (Account #2) |
   | Retailer | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` (Account #3) |

6. **Expected**: Each registration should succeed with a transaction

**Test Owner Restrictions**:
- Try to access `/addmed` - You should see "Only Manufacturers can create products"
- Try to access `/tasks` - You should see "Owner View" with no task actions

---

### Phase 2: Manufacturer Creates & Ships Product

**Switch to Account #1 (Manufacturer) in MetaMask**

1. Refresh the page
2. You should see **"Manufacturer Dashboard"** with "Production Management" card
3. Go to **Products** page
4. Click **Create Product**:
   - Name: "Aspirin 500mg"
   - Description: "Pain relief medication"
   - Batch Number: "BATCH-2024-001"
5. Click **Create** → Confirm MetaMask transaction
6. **Expected**: Product #1 created at stage "Manufactured"

7. Go to **My Tasks** page
8. You should see Product #1 with action button **"Pack Product"**
9. Click **Pack Product** → Confirm transaction
10. **Expected**: Product moves to stage "Packed"

11. Refresh Tasks page
12. Click **"Ship to Distributor"** → Confirm transaction
13. **Expected**: Product moves to stage "Shipped to Distributor"

---

### Phase 3: Distributor Receives & Forwards

**Switch to Account #2 (Distributor) in MetaMask**

1. Refresh the page
2. You should see **"Distributor Dashboard"** with:
   - "Inbound Shipments: 1" (Product #1 waiting)
   - "Products in Warehouse: 0"

3. Go to **My Tasks** page
4. You should see Product #1 with action button **"Receive Shipment"**
5. Click **Receive Shipment** → Confirm transaction
6. **Expected**: Product moves to stage "Received by Distributor"

7. Refresh Tasks page
8. Click **"Ship to Retailer"** → Confirm transaction
9. **Expected**: Product moves to stage "Shipped to Retailer"

---

### Phase 4: Retailer Receives & Sells

**Switch to Account #3 (Retailer) in MetaMask**

1. Refresh the page
2. You should see **"Retailer Dashboard"** with:
   - "Incoming Deliveries: 1" (Product #1 waiting)
   - "Products in Store: 0"

3. Go to **My Tasks** page
4. You should see Product #1 with action button **"Receive Shipment"**
5. Click **Receive Shipment** → Confirm transaction
6. **Expected**: Product moves to stage "Received by Retailer"

7. Refresh Tasks page
8. Click **"Mark as Sold"** → Confirm transaction
9. **Expected**: Product moves to stage "Sold"

---

### Phase 5: Verify Complete Journey

**Any Account**

1. Go to **Track** page
2. Enter Product ID: `1`
3. Click **Track**
4. **Expected**: See complete timeline showing all 7 stages completed with timestamps

---

## ✅ Expected Results Summary

| Step | Actor | Action | Result |
|------|-------|--------|--------|
| 1 | Owner | Register Manufacturer | ✓ Success |
| 2 | Owner | Register Distributor | ✓ Success |
| 3 | Owner | Register Retailer | ✓ Success |
| 4 | Owner | Try to create product | ✗ Blocked (Only Manufacturers) |
| 5 | Manufacturer | Create Product | ✓ Stage: Manufactured |
| 6 | Manufacturer | Pack Product | ✓ Stage: Packed |
| 7 | Manufacturer | Ship to Distributor | ✓ Stage: ShippedToDistributor |
| 8 | Distributor | Receive Shipment | ✓ Stage: ReceivedByDistributor |
| 9 | Distributor | Ship to Retailer | ✓ Stage: ShippedToRetailer |
| 10 | Retailer | Receive Shipment | ✓ Stage: ReceivedByRetailer |
| 11 | Retailer | Sell | ✓ Stage: Sold |

---

## 🔒 RBAC Verification Tests

### Test 1: Owner Cannot Create Products
1. Login as Owner (Account #0)
2. Navigate to `/addmed`
3. **Expected**: "Only Manufacturers can create products" message

### Test 2: Manufacturer Cannot Register Participants
1. Login as Manufacturer (Account #1)
2. Navigate to `/roles`
3. **Expected**: "Owner Access Required" warning

### Test 3: Distributor Cannot Pack Products
1. Login as Distributor (Account #2)
2. Try calling `packMedicine(1)` via contract
3. **Expected**: Transaction reverts with "Only manufacturer"

### Test 4: Retailer Cannot Ship to Distributor
1. Login as Retailer (Account #3)
2. Try calling `shipToDistributor(1)` via contract
3. **Expected**: Transaction reverts with "Only manufacturer"

### Test 5: Stage Sequence Enforcement
1. Create a new product as Manufacturer
2. Try to call `shipToDistributor(2)` before `packMedicine(2)`
3. **Expected**: Transaction reverts with "Invalid stage"

---

## 🎯 Dashboard Views by Role

| Role | Dashboard Title | Key Features |
|------|-----------------|--------------|
| Owner | "Owner Dashboard" | User Management card, Participants stats |
| Manufacturer | "Manufacturer Dashboard" | Create Product button, My Inventory |
| Distributor | "Distributor Dashboard" | Inbound Shipments, Warehouse Inventory |
| Retailer | "Retailer Dashboard" | Incoming Deliveries, Store Stock, Sell actions |
| Guest | "Supply Chain Overview" | Read-only view, Track Products only |

---

## 🐛 Troubleshooting

### "Only owner can perform this action"
- You're not using Account #0 for participant registration
- Switch to Account #0 in MetaMask

### "Only manufacturer can perform this action"
- You're trying to create/pack/ship products without being registered as Manufacturer
- Owner must first register your address as Manufacturer

### "Invalid stage for this action"
- You're trying to skip a step in the workflow
- Products must progress sequentially through all 7 stages

### Role Shows "Guest"
- Your address isn't registered in any role
- Ask the Owner to register your address

### Dashboard Doesn't Update
- Clear MetaMask activity data: Settings → Advanced → Clear activity tab data
- Refresh the browser

---

## 📊 Smart Contract Functions by Role

### Owner Only
- `addManufacturer(address)`
- `addDistributor(address)`
- `addRetailer(address)`

### Manufacturer Only
- `addMedicine()` - Creates new product
- `packMedicine(uint256 _medicineID)`
- `shipToDistributor(uint256 _medicineID)`

### Distributor Only
- `receiveByDistributor(uint256 _medicineID)`
- `shipToRetailer(uint256 _medicineID)`

### Retailer Only
- `receiveByRetailer(uint256 _medicineID)`
- `sellMedicine(uint256 _medicineID)`

### Anyone
- `getRole(address)` - Get role string
- `getMedicine(uint256)` - Get product details
- `getStage(uint256)` - Get current stage
- `showStage(uint256)` - Get stage name string
