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
    // PARTICIPANT STRUCTS
    // ============================================
    struct Manufacturer {
        address addr;
        uint256 id;
        string name;
        string place;
    }

    struct Distributor {
        address addr;
        uint256 id;
        string name;
        string place;
    }

    struct Retailer {
        address addr;
        uint256 id;
        string name;
        string place;
    }

    // Participant storage
    mapping(uint256 => Manufacturer) public MAN;
    mapping(uint256 => Distributor) public DIS;
    mapping(uint256 => Retailer) public RET;

    // Address to ID mappings (for role verification)
    mapping(address => uint256) public manAddressToId;
    mapping(address => uint256) public disAddressToId;
    mapping(address => uint256) public retAddressToId;

    // ============================================
    // PARTICIPANT REGISTRATION (Owner Only)
    // ============================================

    function addManufacturer(address _address, string memory _name, string memory _place) public onlyOwner {
        require(manAddressToId[_address] == 0, "Manufacturer already registered");
        manCtr++;
        MAN[manCtr] = Manufacturer(_address, manCtr, _name, _place);
        manAddressToId[_address] = manCtr;
        emit ParticipantRegistered("Manufacturer", _address, manCtr, block.timestamp);
    }

    function addDistributor(address _address, string memory _name, string memory _place) public onlyOwner {
        require(disAddressToId[_address] == 0, "Distributor already registered");
        disCtr++;
        DIS[disCtr] = Distributor(_address, disCtr, _name, _place);
        disAddressToId[_address] = disCtr;
        emit ParticipantRegistered("Distributor", _address, disCtr, block.timestamp);
    }

    function addRetailer(address _address, string memory _name, string memory _place) public onlyOwner {
        require(retAddressToId[_address] == 0, "Retailer already registered");
        retCtr++;
        RET[retCtr] = Retailer(_address, retCtr, _name, _place);
        retAddressToId[_address] = retCtr;
        emit ParticipantRegistered("Retailer", _address, retCtr, block.timestamp);
    }

    // ============================================
    // MEDICINE CREATION (Manufacturer Only)
    // ============================================

    /**
     * @dev Create a new medicine. Only manufacturers can call this.
     * @notice No strings stored on-chain! Metadata is stored off-chain via API.
     * @return id The new medicine ID
     */
    function addMedicine() public onlyManufacturer returns (uint256) {
        medicineCtr++;
        MedicineStock[medicineCtr] = Medicine({
            id: medicineCtr,
            manufacturer: msg.sender,
            distributor: address(0),
            retailer: address(0),
            stage: STAGE.Manufactured,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            MANid: manAddressToId[msg.sender],
            DISid: 0,
            RETid: 0
        });
        emit MedicineCreated(medicineCtr, msg.sender, block.timestamp);
        return medicineCtr;
    }

    // ============================================
    // STAGE TRANSITIONS (State Machine)
    // ============================================

    /**
     * @dev Pack the medicine. Manufacturer only.
     */
    function pack(uint256 _id) public onlyManufacturer {
        require(_id > 0 && _id <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_id].stage == STAGE.Manufactured, "Medicine must be in Manufactured stage");
        require(MedicineStock[_id].manufacturer == msg.sender, "Only the manufacturer who created this can pack it");
        
        MedicineStock[_id].stage = STAGE.Packed;
        MedicineStock[_id].updatedAt = block.timestamp;
        emit StageUpdated(_id, STAGE.Packed, msg.sender, block.timestamp);
    }

    /**
     * @dev Ship to distributor. Manufacturer only.
     */
    function shipToDistributor(uint256 _id, uint256 _distributorId) public onlyManufacturer {
        require(_id > 0 && _id <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_id].stage == STAGE.Packed, "Medicine must be in Packed stage");
        require(MedicineStock[_id].manufacturer == msg.sender, "Only the manufacturer who created this can ship it");
        require(_distributorId > 0 && _distributorId <= disCtr, "Invalid distributor ID");
        
        MedicineStock[_id].stage = STAGE.ShippedToDistributor;
        MedicineStock[_id].distributor = DIS[_distributorId].addr;
        MedicineStock[_id].DISid = _distributorId;
        MedicineStock[_id].updatedAt = block.timestamp;
        emit StageUpdated(_id, STAGE.ShippedToDistributor, msg.sender, block.timestamp);
    }

    /**
     * @dev Receive from manufacturer. Distributor only.
     */
    function receiveByDistributor(uint256 _id) public onlyDistributor {
        require(_id > 0 && _id <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_id].stage == STAGE.ShippedToDistributor, "Medicine must be in ShippedToDistributor stage");
        require(MedicineStock[_id].distributor == msg.sender, "Only the assigned distributor can receive this");
        
        MedicineStock[_id].stage = STAGE.ReceivedByDistributor;
        MedicineStock[_id].updatedAt = block.timestamp;
        emit StageUpdated(_id, STAGE.ReceivedByDistributor, msg.sender, block.timestamp);
    }

    /**
     * @dev Ship to retailer. Distributor only.
     */
    function shipToRetailer(uint256 _id, uint256 _retailerId) public onlyDistributor {
        require(_id > 0 && _id <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_id].stage == STAGE.ReceivedByDistributor, "Medicine must be in ReceivedByDistributor stage");
        require(MedicineStock[_id].distributor == msg.sender, "Only the assigned distributor can ship this");
        require(_retailerId > 0 && _retailerId <= retCtr, "Invalid retailer ID");
        
        MedicineStock[_id].stage = STAGE.ShippedToRetailer;
        MedicineStock[_id].retailer = RET[_retailerId].addr;
        MedicineStock[_id].RETid = _retailerId;
        MedicineStock[_id].updatedAt = block.timestamp;
        emit StageUpdated(_id, STAGE.ShippedToRetailer, msg.sender, block.timestamp);
    }

    /**
     * @dev Receive from distributor. Retailer only.
     */
    function receiveByRetailer(uint256 _id) public onlyRetailer {
        require(_id > 0 && _id <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_id].stage == STAGE.ShippedToRetailer, "Medicine must be in ShippedToRetailer stage");
        require(MedicineStock[_id].retailer == msg.sender, "Only the assigned retailer can receive this");
        
        MedicineStock[_id].stage = STAGE.ReceivedByRetailer;
        MedicineStock[_id].updatedAt = block.timestamp;
        emit StageUpdated(_id, STAGE.ReceivedByRetailer, msg.sender, block.timestamp);
    }

    /**
     * @dev Sell to customer. Retailer only.
     */
    function sell(uint256 _id) public onlyRetailer {
        require(_id > 0 && _id <= medicineCtr, "Invalid medicine ID");
        require(MedicineStock[_id].stage == STAGE.ReceivedByRetailer, "Medicine must be in ReceivedByRetailer stage");
        require(MedicineStock[_id].retailer == msg.sender, "Only the assigned retailer can sell this");
        
        MedicineStock[_id].stage = STAGE.Sold;
        MedicineStock[_id].updatedAt = block.timestamp;
        emit StageUpdated(_id, STAGE.Sold, msg.sender, block.timestamp);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function getMedicineCount() public view returns (uint256) {
        return medicineCtr;
    }

    function getManufacturerCount() public view returns (uint256) {
        return manCtr;
    }

    function getDistributorCount() public view returns (uint256) {
        return disCtr;
    }

    function getRetailerCount() public view returns (uint256) {
        return retCtr;
    }

    function getMedicineStage(uint256 _id) public view returns (STAGE) {
        require(_id > 0 && _id <= medicineCtr, "Invalid medicine ID");
        return MedicineStock[_id].stage;
    }

    function getMedicine(uint256 _id) public view returns (
        uint256 id,
        address manufacturer,
        address distributor,
        address retailer,
        STAGE stage,
        uint256 createdAt,
        uint256 updatedAt,
        uint256 MANid,
        uint256 DISid,
        uint256 RETid
    ) {
        require(_id > 0 && _id <= medicineCtr, "Invalid medicine ID");
        Medicine memory med = MedicineStock[_id];
        return (
            med.id,
            med.manufacturer,
            med.distributor,
            med.retailer,
            med.stage,
            med.createdAt,
            med.updatedAt,
            med.MANid,
            med.DISid,
            med.RETid
        );
    }

    function getManufacturer(uint256 _id) public view returns (address addr, uint256 id, string memory name, string memory place) {
        require(_id > 0 && _id <= manCtr, "Invalid manufacturer ID");
        Manufacturer memory man = MAN[_id];
        return (man.addr, man.id, man.name, man.place);
    }

    function getDistributor(uint256 _id) public view returns (address addr, uint256 id, string memory name, string memory place) {
        require(_id > 0 && _id <= disCtr, "Invalid distributor ID");
        Distributor memory dis = DIS[_id];
        return (dis.addr, dis.id, dis.name, dis.place);
    }

    function getRetailer(uint256 _id) public view returns (address addr, uint256 id, string memory name, string memory place) {
        require(_id > 0 && _id <= retCtr, "Invalid retailer ID");
        Retailer memory ret = RET[_id];
        return (ret.addr, ret.id, ret.name, ret.place);
    }

    // Check if address is a manufacturer
    function isManufacturer(address _addr) public view returns (bool) {
        return manAddressToId[_addr] > 0;
    }

    // Check if address is a distributor
    function isDistributor(address _addr) public view returns (bool) {
        return disAddressToId[_addr] > 0;
    }

    // Check if address is a retailer
    function isRetailer(address _addr) public view returns (bool) {
        return retAddressToId[_addr] > 0;
    }

    // Get role of an address
    function getRole(address _addr) public view returns (string memory) {
        if (_addr == Owner) return "Owner";
        if (manAddressToId[_addr] > 0) return "Manufacturer";
        if (disAddressToId[_addr] > 0) return "Distributor";
        if (retAddressToId[_addr] > 0) return "Retailer";
        return "None";
    }
}
