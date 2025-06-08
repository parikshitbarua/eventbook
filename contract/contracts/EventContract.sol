// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Interfaces.sol";

/**
 * @title EventContract
 * @dev Manages event details, ticket sales, and business logic
 */
contract EventContract is Ownable, ReentrancyGuard {
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
    
    // Advanced event features
    mapping(address => bool) public whitelist;
    bool public whitelistEnabled;
    uint256 public maxTicketsPerWallet;
    uint256 public salesStartTime;
    uint256 public salesEndTime;
    
    // Ticket categories
    struct TicketCategory {
        string name;
        uint256 price;
        uint256 maxSupply;
        uint256 sold;
        bool isActive;
    }
    
    mapping(uint256 => TicketCategory) public ticketCategories;
    uint256 public categoryCount;
    
    // Events
    event TicketPurchased(address indexed buyer, uint256 quantity, uint256 totalPrice);
    event EventUpdated();
    event EventDeactivated();
    event WhitelistUpdated(address indexed user, bool status);
    event CategoryAdded(uint256 indexed categoryId, string name, uint256 price);
    
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
    
    constructor(
        string memory _eventTitle,
        string memory _eventDescription,
        address _organizer,
        uint256 _ticketPrice,
        uint256 _maxTickets,
        string memory _eventURI,
        uint256 _eventStartTime,
        uint256 _eventEndTime,
        string memory _venue
    ) Ownable(_organizer) {
        require(bytes(_eventTitle).length > 0, "Empty title");
        require(_ticketPrice > 0, "Invalid price");
        require(_organizer != address(0), "Invalid organizer");
        require(_eventStartTime > block.timestamp, "Past event");
        require(_eventEndTime > _eventStartTime, "Invalid times");
        
        eventTitle = _eventTitle;
        eventDescription = _eventDescription;
        organizer = _organizer;
        ticketPrice = _ticketPrice;
        maxTickets = _maxTickets;
        isActive = true;
        eventURI = _eventURI;
        createdAt = block.timestamp;
        eventStartTime = _eventStartTime;
        eventEndTime = _eventEndTime;
        venue = _venue;
        
        salesStartTime = block.timestamp;
        salesEndTime = _eventStartTime;
        maxTicketsPerWallet = 10;
    }
    
    function setNFTContract(address _nftContract) external {
        require(nftContract == address(0), "Already set");
        require(_nftContract != address(0), "Invalid NFT contract");
        nftContract = _nftContract;
    }
    
    function purchaseTickets(
        address buyer, 
        uint256 quantity, 
        uint256 categoryId
    ) external payable onlyActiveEvent onlyDuringSales nonReentrant {
        require(msg.sender == nftContract, "Only NFT contract");
        require(quantity > 0, "Invalid quantity");
        
        if (whitelistEnabled) {
            require(whitelist[buyer], "Not whitelisted");
        }
        
        uint256 totalPrice;
        uint256 actualQuantity = quantity;
        
        if (categoryId == 0) {
            require(msg.value >= ticketPrice * quantity, "Insufficient payment");
            totalPrice = ticketPrice * quantity;
            
            if (maxTickets > 0) {
                uint256 available = maxTickets - ticketsSold;
                require(available > 0, "Sold out");
                if (quantity > available) {
                    actualQuantity = available;
                    totalPrice = ticketPrice * actualQuantity;
                }
            }
            
            ticketsSold += actualQuantity;
        } else {
            TicketCategory storage category = ticketCategories[categoryId];
            require(category.isActive, "Category inactive");
            require(msg.value >= category.price * quantity, "Insufficient payment");
            
            totalPrice = category.price * quantity;
            
            if (category.maxSupply > 0) {
                uint256 available = category.maxSupply - category.sold;
                require(available > 0, "Category sold out");
                if (quantity > available) {
                    actualQuantity = available;
                    totalPrice = category.price * actualQuantity;
                }
            }
            
            category.sold += actualQuantity;
            ticketsSold += actualQuantity;
        }
        
        if (maxTicketsPerWallet > 0) {
            IEventTicketNFT nft = IEventTicketNFT(nftContract);
            require(nft.balanceOf(buyer) + actualQuantity <= maxTicketsPerWallet, "Wallet limit");
        }
        
        (bool success, ) = payable(organizer).call{value: totalPrice}("");
        require(success, "Payment failed");
        
        if (msg.value > totalPrice) {
            (bool refundSuccess, ) = payable(buyer).call{value: msg.value - totalPrice}("");
            require(refundSuccess, "Refund failed");
        }
        
        if (owner() != address(0)) {
            try IEventFactory(owner()).updateEventStats(0, ticketsSold, totalPrice) {} catch {}
        }
        
        emit TicketPurchased(buyer, actualQuantity, totalPrice);
    }
    
    function addTicketCategory(
        string memory _name,
        uint256 _price,
        uint256 _maxSupply
    ) external onlyOrganizer returns (uint256) {
        require(_price > 0, "Invalid price");
        
        uint256 categoryId = ++categoryCount;
        
        ticketCategories[categoryId] = TicketCategory({
            name: _name,
            price: _price,
            maxSupply: _maxSupply,
            sold: 0,
            isActive: true
        });
        
        emit CategoryAdded(categoryId, _name, _price);
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
    
    function isTicketAvailable(uint256 quantity) external view returns (bool) {
        if (!isActive) return false;
        if (block.timestamp < salesStartTime || block.timestamp > salesEndTime) return false;
        if (maxTickets > 0 && ticketsSold + quantity > maxTickets) return false;
        return true;
    }
}