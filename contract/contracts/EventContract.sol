// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./Interfaces.sol";

/**
 * @title EventContract
 * @dev Manages event details, ticket sales, and business logic
 */
contract EventContract is Ownable, ReentrancyGuard, Initializable {
    // Event details
    string public eventTitle;
    string public eventDescription;
    address public organizer;
    uint256 public ticketPrice;
    uint256 public maxTickets; // 0 means unlimited
    uint256 public ticketsSold;
    bool public isActive;
    string public eventURI;
    uint256 public createdAt;
    uint256 public eventStartTime;
    uint256 public eventEndTime;
    string public venue;
    
    // Associated NFT contract
    address public nftContract;
    
    // Factory reference
    uint256 public eventId;
    address public factory;
    
    // Advanced event features
    mapping(address => bool) public whitelist;
    bool public whitelistEnabled;
    uint256 public maxTicketsPerWallet;
    uint256 public salesStartTime;
    uint256 public salesEndTime;

    struct CategoryInput {
        string name;
        uint256 price;
        uint256 maxSupply;
        string categoryURI;
    }
    
    // Ticket categories
    struct TicketCategory {
        string name;
        uint256 price;
        uint256 maxSupply;
        uint256 sold;
        bool isActive;
        string categoryURI; // IPFS URI for ticket image/metadata
    }
    
    mapping(uint256 => TicketCategory) public ticketCategories;
    uint256 public categoryCount;
    
    // Events
    event TicketPurchased(address indexed buyer, uint256 quantity, uint256 totalPrice);
    event CategoryTicketPurchased(address indexed buyer, uint256 categoryId, uint256 quantity, uint256 totalPrice);
    event EventUpdated();
    event EventDeactivated();
    event WhitelistUpdated(address indexed user, bool status);
    event CategoryAdded(uint256 indexed categoryId, string name, uint256 price, string categoryURI);
    event CategoriesAdded(uint256[] categoryIds, uint256 totalAdded);
    
    // Debug events
    event PurchaseStarted(address indexed buyer, uint256[] quantities, uint256[] categoryIds);
    event CategoryProcessed(uint256 categoryId, uint256 quantity, uint256 price, uint256 totalPrice);
    event PurchaseCompleted(uint256 totalTicketsSold, uint256 totalRevenue);
    event FactoryUpdateAttempted(uint256 eventId, uint256 ticketsSold, uint256 revenue);
    event FactoryUpdateResult(bool success);
    event MaxTicketsSet(uint256 maxTickets, uint256 rawInput);
    
    modifier onlyOrganizer() {
        require(msg.sender == organizer, "Only organizer");
        _;
    }
    
    modifier onlyActiveEvent() {
        require(isActive, "Event inactive");
        _;
    }
    
    modifier onlyDuringSales() {
        require(block.timestamp >= salesStartTime, "Sales not started");
        require(block.timestamp <= salesEndTime, "Sales ended");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        // Constructor is disabled for clones
        _disableInitializers();
    }
    
    function initialize(
        string memory _eventTitle,
        string memory _eventDescription,
        address _organizer,
        uint256 _ticketPrice,
        uint256 _maxTickets,
        string memory _eventURI,
        uint256 _eventStartTime,
        uint256 _eventEndTime,
        string memory _venue,
        uint256 _eventId,
        address _factory
    ) external initializer {
        require(bytes(_eventTitle).length > 0, "Empty title");
        require(_organizer != address(0), "Invalid organizer");
        require(_eventStartTime > block.timestamp, "Past event");
        require(_eventEndTime > _eventStartTime, "Invalid times");
        require(_factory != address(0), "Invalid factory");
        
        _transferOwnership(_organizer);
        
        eventTitle = _eventTitle;
        eventDescription = _eventDescription;
        organizer = _organizer;
        ticketPrice = _ticketPrice;
        maxTickets = _maxTickets;
        emit MaxTicketsSet(maxTickets, _maxTickets);
        isActive = true;
        eventURI = _eventURI;
        createdAt = block.timestamp;
        eventStartTime = _eventStartTime;
        eventEndTime = _eventEndTime;
        venue = _venue;
        eventId = _eventId;
        factory = _factory;
        
        salesStartTime = block.timestamp;
        salesEndTime = _eventStartTime;
        maxTicketsPerWallet = 10;
    }
    
    function setNFTContract(address _nftContract) external {
        require(nftContract == address(0), "Already set");
        require(_nftContract != address(0), "Invalid NFT contract");
        nftContract = _nftContract;
    }
    
    // State-changing functions
    function purchaseSingleTicket(address buyer, uint256 quantity) external payable onlyActiveEvent onlyDuringSales nonReentrant {
        require(msg.sender == nftContract, "Only NFT contract");
        require(buyer != address(0), "Invalid buyer address");
        require(quantity > 0, "Invalid quantity");
        require(quantity <= 100, "Too many tickets");
        
        uint256 totalPrice;
        unchecked {
            totalPrice = ticketPrice * quantity;
        }
        require(msg.value >= totalPrice, "Insufficient payment");
        
        if (whitelistEnabled) {
            require(whitelist[buyer], "Not whitelisted");
        }
        
        // Check ticket availability
        if (maxTickets > 0) {
            uint256 available;
            unchecked {
                available = maxTickets - ticketsSold;
            }
            require(available >= quantity, "Not enough tickets");
        }
        
        // Check wallet limit
        if (maxTicketsPerWallet > 0) {
            IEventTicketNFT nft = IEventTicketNFT(nftContract);
            uint256 currentBalance = nft.balanceOf(buyer);
            uint256 newBalance;
            unchecked {
                newBalance = currentBalance + quantity;
            }
            require(newBalance <= maxTicketsPerWallet, "Wallet limit exceeded");
        }
        
        // Update state
        unchecked {
            ticketsSold += quantity;
        }
        
        // Process payment
        (bool success, ) = payable(organizer).call{value: totalPrice}("");
        require(success, "Payment transfer failed");
        
        // Refund excess payment
        if (msg.value > totalPrice) {
            uint256 refundAmount;
            unchecked {
                refundAmount = msg.value - totalPrice;
            }
            (bool refundSuccess, ) = payable(buyer).call{value: refundAmount}("");
            require(refundSuccess, "Refund transfer failed");
        }
        
        emit TicketPurchased(buyer, quantity, totalPrice);
        
        // Update factory stats
        try IEventFactory(factory).updateEventStats(eventId, ticketsSold, totalPrice) {} catch {}
    }
    
    function purchaseCategoryTickets(
        address buyer, 
        uint256[] memory quantities, 
        uint256[] memory categoryIds
    ) external payable onlyActiveEvent onlyDuringSales nonReentrant {
        require(msg.sender == nftContract, "Only NFT contract");
        require(quantities.length > 0, "Invalid quantity");
        require(quantities.length == categoryIds.length, "Array length mismatch");
        require(buyer != address(0), "Invalid buyer address");
        
        emit PurchaseStarted(buyer, quantities, categoryIds);
        
        if (whitelistEnabled) {
            require(whitelist[buyer], "Not whitelisted");
        }
        
        // Calculate total price and validate quantities upfront
        uint256 totalPrice;
        uint256[] memory actualQuantities = new uint256[](quantities.length);
        
        for (uint256 i = 0; i < quantities.length; i++) {
            uint256 quantity = quantities[i];
            uint256 categoryId = categoryIds[i];
            uint256 categoryPrice;
            
            require(quantity > 0, "Zero quantity not allowed");
            require(categoryId > 0 && categoryId <= categoryCount, "Invalid category ID");
            
            TicketCategory storage category = ticketCategories[categoryId];
            require(category.isActive, "Category inactive");
            
            // Check category availability
            if (category.maxSupply > 0) {
                uint256 available;
                unchecked {
                    available = category.maxSupply - category.sold;
                }
                require(available > 0, "Category sold out");
                if (quantity > available) {
                    quantity = available;
                }
            }
            
            unchecked {
                categoryPrice = category.price * quantity;
                totalPrice += categoryPrice;
            }
            actualQuantities[i] = quantity;
            
            emit CategoryProcessed(categoryId, quantity, category.price, categoryPrice);
            
            // Check wallet limit
            if (maxTicketsPerWallet > 0) {
                IEventTicketNFT nft = IEventTicketNFT(nftContract);
                uint256 currentBalance = nft.balanceOf(buyer);
                uint256 newBalance;
                unchecked {
                    newBalance = currentBalance + quantity;
                }
                require(newBalance <= maxTicketsPerWallet, "Wallet limit exceeded");
            }
        }
        
        // Validate total payment
        require(msg.value >= totalPrice, "Insufficient payment");
        
        // Process payments and update state
        for (uint256 i = 0; i < quantities.length; i++) {
            uint256 categoryId = categoryIds[i];
            uint256 quantity = actualQuantities[i];
            TicketCategory storage category = ticketCategories[categoryId];
            
            unchecked {
                category.sold += quantity;
                ticketsSold += quantity;
            }
        }
        
        // Process payment
        (bool success, ) = payable(organizer).call{value: totalPrice}("");
        require(success, "Payment transfer failed");
        
        // Refund excess payment
        if (msg.value > totalPrice) {
            uint256 refundAmount;
            unchecked {
                refundAmount = msg.value - totalPrice;
            }
            (bool refundSuccess, ) = payable(buyer).call{value: refundAmount}("");
            require(refundSuccess, "Refund transfer failed");
        }
        
        emit PurchaseCompleted(ticketsSold, totalPrice);
        
        // Update factory stats
        emit FactoryUpdateAttempted(eventId, ticketsSold, totalPrice);
        try IEventFactory(factory).updateEventStats(eventId, ticketsSold, totalPrice) {
            emit FactoryUpdateResult(true);
        } catch {
            emit FactoryUpdateResult(false);
        }
        
        emit CategoryTicketPurchased(buyer, categoryIds[0], quantities[0], totalPrice);
    }
    
    // Helper function to convert address to string
    function _address2str(address _addr) internal pure returns (string memory) {
        bytes memory b = new bytes(42);
        b[0] = "0";
        b[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            bytes1 b1 = bytes1(uint8(uint(uint160(_addr)) / (2**(8*(19 - i)))));
            bytes1 b2 = bytes1(uint8(uint(uint160(_addr)) / (2**(8*(19 - i) - 4))));
            b[2+2*i] = _char(b1);
            b[2+2*i+1] = _char(b2);
        }
        return string(b);
    }

    function _char(bytes1 b) internal pure returns (bytes1) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }

    // Helper function to convert array to string
    function _arrayToString(uint256[] memory arr) internal pure returns (string memory) {
        if (arr.length == 0) return "[]";
        string memory result = "[";
        for (uint256 i = 0; i < arr.length; i++) {
            if (i > 0) result = string(abi.encodePacked(result, ","));
            result = string(abi.encodePacked(result, _uint2str(arr[i])));
        }
        return string(abi.encodePacked(result, "]"));
    }
    
    // Helper function to convert uint to string
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        return string(bstr);
    }
    
    function addTicketCategories(
        CategoryInput[] memory _categories
    ) external onlyOrganizer returns (uint256[] memory) {
        require(_categories.length > 0, "No categories provided");
        require(_categories.length <= 20, "Too many categories"); // Gas limit protection
        
        uint256[] memory categoryIds = new uint256[](_categories.length);
        
        for (uint256 i = 0; i < _categories.length; i++) {
            require(_categories[i].price > 0, "Invalid price");
            require(bytes(_categories[i].name).length > 0, "Empty name");
            require(bytes(_categories[i].categoryURI).length > 0, "Empty URI");
            
            uint256 categoryId = ++categoryCount;
            categoryIds[i] = categoryId;
            
            ticketCategories[categoryId] = TicketCategory({
                name: _categories[i].name,
                price: _categories[i].price,
                maxSupply: _categories[i].maxSupply,
                sold: 0,
                isActive: true,
                categoryURI: _categories[i].categoryURI
            });
            
            emit CategoryAdded(categoryId, _categories[i].name, _categories[i].price, _categories[i].categoryURI);
        }
        
        emit CategoriesAdded(categoryIds, _categories.length);
        return categoryIds;
    }

    // Legacy function for backward compatibility (single category)
    function addTicketCategory(
        string memory _name,
        uint256 _price,
        uint256 _maxSupply,
        string memory _categoryURI
    ) external onlyOrganizer returns (uint256) {
        require(_price > 0, "Invalid price");
        require(bytes(_name).length > 0, "Empty name");
        require(bytes(_categoryURI).length > 0, "Empty URI");
        
        uint256 categoryId = ++categoryCount;
        
        ticketCategories[categoryId] = TicketCategory({
            name: _name,
            price: _price,
            maxSupply: _maxSupply,
            sold: 0,
            isActive: true,
            categoryURI: _categoryURI
        });
        
        emit CategoryAdded(categoryId, _name, _price, _categoryURI);
        return categoryId;
    }
    
    function updateEventDetails(
        string memory _description,
        string memory _eventURI,
        string memory _venue,
        uint256 _eventStartTime,
        uint256 _eventEndTime
    ) external onlyOrganizer {
        require(_eventEndTime > _eventStartTime, "Invalid times");
        require(_eventStartTime > block.timestamp, "Past start time");
        
        eventDescription = _description;
        eventURI = _eventURI;
        venue = _venue;
        eventStartTime = _eventStartTime;
        eventEndTime = _eventEndTime;
        
        emit EventUpdated();
    }
    
    function updateSalesPeriod(uint256 _startTime, uint256 _endTime) external onlyOrganizer {
        require(_endTime > _startTime, "Invalid period");
        require(_endTime <= eventStartTime, "Sales after event");
        
        salesStartTime = _startTime;
        salesEndTime = _endTime;
    }
    
    function updateWhitelist(address[] memory _addresses, bool _status) external onlyOrganizer {
        for (uint256 i = 0; i < _addresses.length; i++) {
            whitelist[_addresses[i]] = _status;
            emit WhitelistUpdated(_addresses[i], _status);
        }
    }
    
    function toggleWhitelist(bool _enabled) external onlyOrganizer {
        whitelistEnabled = _enabled;
    }
    
    function deactivateEvent() external onlyOrganizer {
        require(isActive, "Already inactive");
        isActive = false;
        emit EventDeactivated();
    }
    
    // View functions
    function getEventDetails() external view returns (
        string memory title,
        string memory description,
        address eventOrganizer,
        uint256 price,
        uint256 maxTicketsCount,
        uint256 ticketsSoldCount,
        bool active,
        string memory uri,
        uint256 creationTime,
        uint256 startTime,
        uint256 endTime,
        string memory eventVenue
    ) {
        return (
            eventTitle, eventDescription, organizer, ticketPrice,
            maxTickets, ticketsSold, isActive, eventURI,
            createdAt, eventStartTime, eventEndTime, venue
        );
    }
    
    function getTicketCategory(uint256 _categoryId) external view returns (TicketCategory memory) {
        return ticketCategories[_categoryId];
    }
    
    function getCategoryURI(uint256 _categoryId) external view returns (string memory) {
        require(_categoryId > 0 && _categoryId <= categoryCount, "Invalid category ID");
        return ticketCategories[_categoryId].categoryURI;
    }
    
    function getAllCategories() external view returns (TicketCategory[] memory) {
        TicketCategory[] memory categories = new TicketCategory[](categoryCount);
        for (uint256 i = 1; i <= categoryCount; i++) {
            categories[i-1] = ticketCategories[i];
        }
        return categories;
    }
    
    function isTicketAvailable(uint256 quantity) external view returns (bool) {
        if (!isActive) return false;
        if (block.timestamp < salesStartTime || block.timestamp > salesEndTime) return false;
        if (maxTickets > 0 && ticketsSold + quantity > maxTickets) return false;
        return true;
    }
    
    function isCategoryTicketAvailable(uint256 categoryId, uint256 quantity) external view returns (bool) {
        if (!isActive) return false;
        if (block.timestamp < salesStartTime || block.timestamp > salesEndTime) return false;
        if (categoryId == 0 || categoryId > categoryCount) return false;
        
        TicketCategory storage category = ticketCategories[categoryId];
        if (!category.isActive) return false;
        if (category.maxSupply > 0 && category.sold + quantity > category.maxSupply) return false;
        return true;
    }
}