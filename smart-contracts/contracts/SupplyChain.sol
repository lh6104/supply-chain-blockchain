// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SupplyChain
 * @dev Pharmaceutical Supply Chain with Role-Based Access Control (RBAC)
 * 
 * HYBRID ARCHITECTURE:
 * - On-chain: id, stage, timestamps, role assignments (immutable truth)
 * - Off-chain: name, description, images, metadata (stored in backend API)
 * 
 * ROLES:
 * - Owner: Can ONLY register participants (cannot create products)
 * - Manufacturer: Creates products, processes, packs, ships to distributor
 * - Distributor: Receives from manufacturer, ships to retailer
 * - Retailer: Receives from distributor, sells to customer
 * 
 * WORKFLOW (State Machine):
 * Manufactured → Packed → ShippedToDistributor → ReceivedByDistributor → 
 * ShippedToRetailer → ReceivedByRetailer → Sold
 */
contract SupplyChain {
    // Contract owner - can ONLY register participants
    address public Owner;

    constructor() {
        Owner = msg.sender;
    }

    // ============================================
    // MODIFIERS (Role-Based Access Control)
    // ============================================

    modifier onlyOwner() {
        require(msg.sender == Owner, "Only owner can call this function");
        _;
    }

    modifier onlyManufacturer() {
        require(manAddressToId[msg.sender] > 0, "Only registered manufacturers can call this function");
        _;
    }

    modifier onlyDistributor() {
        require(disAddressToId[msg.sender] > 0, "Only registered distributors can call this function");
        _;
    }

    modifier onlyRetailer() {
        require(retAddressToId[msg.sender] > 0, "Only registered retailers can call this function");
        _;
    }

    // ============================================
    // SUPPLY CHAIN STAGES (State Machine)
    // ============================================
    enum STAGE {
        Manufactured,           // 0 - Created by Manufacturer
        Packed,                 // 1 - Packed by Manufacturer
        ShippedToDistributor,   // 2 - Shipped by Manufacturer
        ReceivedByDistributor,  // 3 - Received by Distributor
        ShippedToRetailer,      // 4 - Shipped by Distributor
        ReceivedByRetailer,     // 5 - Received by Retailer
        Sold                    // 6 - Sold by Retailer
    }

    // ============================================
    // COUNTERS
    // ============================================
    uint256 public medicineCtr = 0;
    uint256 public manCtr = 0;
    uint256 public disCtr = 0;
    uint256 public retCtr = 0;

    // ============================================
    // MEDICINE STRUCT (Optimized - No strings!)
    // ============================================
    struct Medicine {
        uint256 id;
        address manufacturer;       // Who created this medicine
        address distributor;        // Assigned distributor
        address retailer;           // Assigned retailer
        STAGE stage;                // Current stage
        uint256 createdAt;          // Timestamp when manufactured
        uint256 updatedAt;          // Timestamp of last update
        uint256 MANid;              // Manufacturer ID
        uint256 DISid;              // Distributor ID (assigned when shipped)
        uint256 RETid;              // Retailer ID (assigned when shipped)
    }

    // Medicine storage
    mapping(uint256 => Medicine) public MedicineStock;

    // ============================================
    // EVENTS
    // ============================================
    event MedicineCreated(uint256 indexed id, address indexed manufacturer, uint256 timestamp);
    event StageUpdated(uint256 indexed id, STAGE stage, address indexed updatedBy, uint256 timestamp);
    event ParticipantRegistered(string role, address indexed participant, uint256 id, uint256 timestamp);

    // ============================================
    // ROLE STRUCTS
    // ============================================
    struct Manufacturer {
        address addr;
        uint256 id;
        uint256 registeredAt;
        bool active;
    }

    struct Distributor {
        address addr;
        uint256 id;
        uint256 registeredAt;
        bool active;
    }

    struct Retailer {
        address addr;
        uint256 id;
        uint256 registeredAt;
        bool active;
    }

    // Role mappings
    mapping(uint256 => Manufacturer) public MAN;
    mapping(uint256 => Distributor) public DIS;
    mapping(uint256 => Retailer) public RET;

    // Address to role ID mappings (for faster lookups)
    mapping(address => uint256) public manAddressToId;
    mapping(address => uint256) public disAddressToId;
    mapping(address => uint256) public retAddressToId;

    // ============================================
    // OWNER FUNCTIONS - Participant Management Only
    // ============================================

    /**
     * @dev Register a new Manufacturer (Owner only)
     */
    function addManufacturer(address _address) public onlyOwner {
        require(_address != address(0), "Invalid address");
        require(manAddressToId[_address] == 0, "Manufacturer already registered");
        require(disAddressToId[_address] == 0, "Address is already a Distributor");
        require(retAddressToId[_address] == 0, "Address is already a Retailer");
        
        manCtr++;
        MAN[manCtr] = Manufacturer(_address, manCtr, block.timestamp, true);
        manAddressToId[_address] = manCtr;
        
        emit ParticipantRegistered("Manufacturer", _address, manCtr, block.timestamp);
    }

    /**
     * @dev Register a new Distributor (Owner only)
     */
    function addDistributor(address _address) public onlyOwner {
        require(_address != address(0), "Invalid address");
        require(disAddressToId[_address] == 0, "Distributor already registered");
        require(manAddressToId[_address] == 0, "Address is already a Manufacturer");
        require(retAddressToId[_address] == 0, "Address is already a Retailer");
        
        disCtr++;
        DIS[disCtr] = Distributor(_address, disCtr, block.timestamp, true);
        disAddressToId[_address] = disCtr;
        
        emit ParticipantRegistered("Distributor", _address, disCtr, block.timestamp);
    }

    /**
     * @dev Register a new Retailer (Owner only)
     */
    function addRetailer(address _address) public onlyOwner {
        require(_address != address(0), "Invalid address");
        require(retAddressToId[_address] == 0, "Retailer already registered");
        require(manAddressToId[_address] == 0, "Address is already a Manufacturer");
        require(disAddressToId[_address] == 0, "Address is already a Distributor");
        
        retCtr++;
        RET[retCtr] = Retailer(_address, retCtr, block.timestamp, true);
        retAddressToId[_address] = retCtr;
        
        emit ParticipantRegistered("Retailer", _address, retCtr, block.timestamp);
    }

    // ============================================
    // MANUFACTURER FUNCTIONS
    // ============================================

    /**
     * @dev Create a new medicine (Manufacturer only)
     * @notice Metadata is stored off-chain in the backend API
     * @return The new medicine ID
     */
    function addMedicine() public onlyManufacturer returns (uint256) {
        medicineCtr++;
        uint256 timestamp = block.timestamp;
        uint256 manId = manAddressToId[msg.sender];
        
        MedicineStock[medicineCtr] = Medicine({
            id: medicineCtr,
            manufacturer: msg.sender,
            distributor: address(0),
            retailer: address(0),
            stage: STAGE.Manufactured,
            createdAt: timestamp,
            updatedAt: timestamp,
            MANid: manId,
            DISid: 0,
            RETid: 0
        });

        emit MedicineCreated(medicineCtr, msg.sender, timestamp);
        
        return medicineCtr;
    }

    /**
     * @dev Pack the medicine (Manufacturer only)
     */
    function packMedicine(uint256 _medicineID) public onlyManufacturer {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_medicineID].manufacturer == msg.sender, "Not your product");
        require(MedicineStock[_medicineID].stage == STAGE.Manufactured, "Medicine must be in Manufactured stage");
        
        MedicineStock[_medicineID].stage = STAGE.Packed;
        MedicineStock[_medicineID].updatedAt = block.timestamp;
        
        emit StageUpdated(_medicineID, STAGE.Packed, msg.sender, block.timestamp);
    }

    /**
     * @dev Ship medicine to a specific distributor (Manufacturer only)
     */
    function shipToDistributor(uint256 _medicineID, address _distributor) public onlyManufacturer {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_medicineID].manufacturer == msg.sender, "Not your product");
        require(MedicineStock[_medicineID].stage == STAGE.Packed, "Medicine must be Packed first");
        require(disAddressToId[_distributor] > 0, "Invalid distributor address");
        
        MedicineStock[_medicineID].distributor = _distributor;
        MedicineStock[_medicineID].DISid = disAddressToId[_distributor];
        MedicineStock[_medicineID].stage = STAGE.ShippedToDistributor;
        MedicineStock[_medicineID].updatedAt = block.timestamp;
        
        emit StageUpdated(_medicineID, STAGE.ShippedToDistributor, msg.sender, block.timestamp);
    }

    // ============================================
    // DISTRIBUTOR FUNCTIONS
    // ============================================

    /**
     * @dev Receive medicine from manufacturer (Distributor only)
     */
    function receiveByDistributor(uint256 _medicineID) public onlyDistributor {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_medicineID].distributor == msg.sender, "Not assigned to you");
        require(MedicineStock[_medicineID].stage == STAGE.ShippedToDistributor, "Medicine not shipped to you yet");
        
        MedicineStock[_medicineID].stage = STAGE.ReceivedByDistributor;
        MedicineStock[_medicineID].updatedAt = block.timestamp;
        
        emit StageUpdated(_medicineID, STAGE.ReceivedByDistributor, msg.sender, block.timestamp);
    }

    /**
     * @dev Ship medicine to a specific retailer (Distributor only)
     */
    function shipToRetailer(uint256 _medicineID, address _retailer) public onlyDistributor {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_medicineID].distributor == msg.sender, "Not your shipment");
        require(MedicineStock[_medicineID].stage == STAGE.ReceivedByDistributor, "Must receive first");
        require(retAddressToId[_retailer] > 0, "Invalid retailer address");
        
        MedicineStock[_medicineID].retailer = _retailer;
        MedicineStock[_medicineID].RETid = retAddressToId[_retailer];
        MedicineStock[_medicineID].stage = STAGE.ShippedToRetailer;
        MedicineStock[_medicineID].updatedAt = block.timestamp;
        
        emit StageUpdated(_medicineID, STAGE.ShippedToRetailer, msg.sender, block.timestamp);
    }

    // ============================================
    // RETAILER FUNCTIONS
    // ============================================

    /**
     * @dev Receive medicine from distributor (Retailer only)
     */
    function receiveByRetailer(uint256 _medicineID) public onlyRetailer {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_medicineID].retailer == msg.sender, "Not assigned to you");
        require(MedicineStock[_medicineID].stage == STAGE.ShippedToRetailer, "Medicine not shipped to you yet");
        
        MedicineStock[_medicineID].stage = STAGE.ReceivedByRetailer;
        MedicineStock[_medicineID].updatedAt = block.timestamp;
        
        emit StageUpdated(_medicineID, STAGE.ReceivedByRetailer, msg.sender, block.timestamp);
    }

    /**
     * @dev Sell medicine to customer (Retailer only)
     */
    function sellMedicine(uint256 _medicineID) public onlyRetailer {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_medicineID].retailer == msg.sender, "Not your product");
        require(MedicineStock[_medicineID].stage == STAGE.ReceivedByRetailer, "Must receive first");
        
        MedicineStock[_medicineID].stage = STAGE.Sold;
        MedicineStock[_medicineID].updatedAt = block.timestamp;
        
        emit StageUpdated(_medicineID, STAGE.Sold, msg.sender, block.timestamp);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @dev Get medicine data
     */
    function getMedicine(uint256 _id) public view returns (
        uint256 id,
        address manufacturer,
        address distributor,
        address retailer,
        STAGE stage,
        uint256 createdAt,
        uint256 updatedAt
    ) {
        require(_id > 0 && _id <= medicineCtr, "Invalid medicine ID");
        Medicine storage m = MedicineStock[_id];
        return (m.id, m.manufacturer, m.distributor, m.retailer, m.stage, m.createdAt, m.updatedAt);
    }

    /**
     * @dev Get medicine count
     */
    function getMedicineCount() public view returns (uint256) {
        return medicineCtr;
    }

    /**
     * @dev Get human-readable stage name
     */
    function showStage(uint256 _medicineID) public view returns (string memory) {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        
        STAGE stage = MedicineStock[_medicineID].stage;
        
        if (stage == STAGE.Manufactured) return "Manufactured";
        if (stage == STAGE.Packed) return "Packed";
        if (stage == STAGE.ShippedToDistributor) return "Shipped to Distributor";
        if (stage == STAGE.ReceivedByDistributor) return "Received by Distributor";
        if (stage == STAGE.ShippedToRetailer) return "Shipped to Retailer";
        if (stage == STAGE.ReceivedByRetailer) return "Received by Retailer";
        if (stage == STAGE.Sold) return "Sold";
        
        return "Unknown";
    }

    /**
     * @dev Get stage as number
     */
    function getStage(uint256 _medicineID) public view returns (STAGE) {
        require(_medicineID > 0 && _medicineID <= medicineCtr, "Invalid medicine ID");
        return MedicineStock[_medicineID].stage;
    }

    // ============================================
    // ROLE CHECK FUNCTIONS
    // ============================================

    function isOwner(address _addr) public view returns (bool) {
        return _addr == Owner;
    }

    function isManufacturer(address _addr) public view returns (bool) {
        return manAddressToId[_addr] > 0;
    }

    function isDistributor(address _addr) public view returns (bool) {
        return disAddressToId[_addr] > 0;
    }

    function isRetailer(address _addr) public view returns (bool) {
        return retAddressToId[_addr] > 0;
    }

    /**
     * @dev Get the role of an address
     * @return role: "Owner", "Manufacturer", "Distributor", "Retailer", or "Unregistered"
     */
    function getRole(address _addr) public view returns (string memory) {
        if (_addr == Owner) return "Owner";
        if (manAddressToId[_addr] > 0) return "Manufacturer";
        if (disAddressToId[_addr] > 0) return "Distributor";
        if (retAddressToId[_addr] > 0) return "Retailer";
        return "Unregistered";
    }

    // ============================================
    // INVENTORY QUERIES (for frontend)
    // ============================================

    /**
     * @dev Get medicines by manufacturer
     */
    function getMedicinesByManufacturer(address _manufacturer) public view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= medicineCtr; i++) {
            if (MedicineStock[i].manufacturer == _manufacturer) {
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= medicineCtr; i++) {
            if (MedicineStock[i].manufacturer == _manufacturer) {
                result[index] = i;
                index++;
            }
        }
        return result;
    }

    /**
     * @dev Get medicines assigned to distributor (inbound shipments)
     */
    function getMedicinesByDistributor(address _distributor) public view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= medicineCtr; i++) {
            if (MedicineStock[i].distributor == _distributor) {
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= medicineCtr; i++) {
            if (MedicineStock[i].distributor == _distributor) {
                result[index] = i;
                index++;
            }
        }
        return result;
    }

    /**
     * @dev Get medicines assigned to retailer (stock)
     */
    function getMedicinesByRetailer(address _retailer) public view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= medicineCtr; i++) {
            if (MedicineStock[i].retailer == _retailer) {
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= medicineCtr; i++) {
            if (MedicineStock[i].retailer == _retailer) {
                result[index] = i;
                index++;
            }
        }
        return result;
    }

    /**
     * @dev Get pending shipments for distributor (ShippedToDistributor but not received)
     */
    function getPendingForDistributor(address _distributor) public view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= medicineCtr; i++) {
            if (MedicineStock[i].distributor == _distributor && 
                MedicineStock[i].stage == STAGE.ShippedToDistributor) {
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= medicineCtr; i++) {
            if (MedicineStock[i].distributor == _distributor && 
                MedicineStock[i].stage == STAGE.ShippedToDistributor) {
                result[index] = i;
                index++;
            }
        }
        return result;
    }

    /**
     * @dev Get pending shipments for retailer (ShippedToRetailer but not received)
     */
    function getPendingForRetailer(address _retailer) public view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= medicineCtr; i++) {
            if (MedicineStock[i].retailer == _retailer && 
                MedicineStock[i].stage == STAGE.ShippedToRetailer) {
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= medicineCtr; i++) {
            if (MedicineStock[i].retailer == _retailer && 
                MedicineStock[i].stage == STAGE.ShippedToRetailer) {
                result[index] = i;
                index++;
            }
        }
        return result;
    }

    // ============================================
    // PARTICIPANT QUERIES
    // ============================================

    function getManufacturerCount() public view returns (uint256) {
        return manCtr;
    }

    function getDistributorCount() public view returns (uint256) {
        return disCtr;
    }

    function getRetailerCount() public view returns (uint256) {
        return retCtr;
    }

    /**
     * @dev Get all distributors (for manufacturer to select when shipping)
     */
    function getAllDistributors() public view returns (address[] memory) {
        address[] memory distributors = new address[](disCtr);
        for (uint256 i = 1; i <= disCtr; i++) {
            distributors[i - 1] = DIS[i].addr;
        }
        return distributors;
    }

    /**
     * @dev Get all retailers (for distributor to select when shipping)
     */
    function getAllRetailers() public view returns (address[] memory) {
        address[] memory retailers = new address[](retCtr);
        for (uint256 i = 1; i <= retCtr; i++) {
            retailers[i - 1] = RET[i].addr;
        }
        return retailers;
    }
}
