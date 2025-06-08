// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IEventContract
 * @dev Interface for EventContract
 */
interface IEventContract {
    // Structs
    struct TicketCategory {
        string name;
        uint256 price;
        uint256 maxSupply;
        uint256 sold;
        bool isActive;
    }
    
    // Events
    event TicketPurchased(address indexed buyer, uint256 quantity, uint256 totalPrice);
    event EventUpdated();
    event EventDeactivated();
    event WhitelistUpdated(address indexed user, bool status);
    event CategoryAdded(uint256 indexed categoryId, string name, uint256 price);
    
    // View functions
    function eventTitle() external view returns (string memory);
    function eventDescription() external view returns (string memory);
    function organizer() external view returns (address);
    function ticketPrice() external view returns (uint256);
    function maxTickets() external view returns (uint256);
    function ticketsSold() external view returns (uint256);
    function isActive() external view returns (bool);
    function eventURI() external view returns (string memory);
    function createdAt() external view returns (uint256);
    function eventStartTime() external view returns (uint256);
    function eventEndTime() external view returns (uint256);
    function venue() external view returns (string memory);
    function nftContract() external view returns (address);
    function whitelistEnabled() external view returns (bool);
    function maxTicketsPerWallet() external view returns (uint256);
    function salesStartTime() external view returns (uint256);
    function salesEndTime() external view returns (uint256);
    function categoryCount() external view returns (uint256);
    
    function whitelist(address user) external view returns (bool);
    function ticketCategories(uint256 categoryId) external view returns (TicketCategory memory);
    
    function getEventDetails() external view returns (
        string memory title,
        string memory description,
        address eventOrganizer,
        uint256 price,
        uint256 maxSupply,
        uint256 sold,
        bool active,
        string memory uri,
        uint256 startTime,
        uint256 endTime,
        string memory eventVenue
    );
    
    // State-changing functions
    function setNFTContract(address _nftContract) external;
    function purchaseTickets(address buyer, uint256 quantity, uint256 categoryId) external payable;
    function addTicketCategory(string memory _name, uint256 _price, uint256 _maxSupply) external returns (uint256);
    function updateEventDetails(
        string memory _description,
        string memory _eventURI,
        string memory _venue,
        uint256 _eventStartTime,
        uint256 _eventEndTime
    ) external;
    function updateSalesPeriod(uint256 _startTime, uint256 _endTime) external;
    function updateWhitelist(address[] memory _addresses, bool _status) external;
    function toggleWhitelist(bool _enabled) external;
    function deactivateEvent() external;
} 