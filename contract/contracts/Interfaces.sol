// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Interface definitions moved here to avoid import issues

interface IEventContract {
    // Basic functions
    function organizer() external view returns (address);
    function purchaseTickets(address buyer, uint256 quantity, uint256 categoryId) external payable;
    function eventStartTime() external view returns (uint256);
    function eventEndTime() external view returns (uint256);
    function deactivateEvent() external;
    
    // Additional required functions
    function ticketPrice() external view returns (uint256);
    function maxTickets() external view returns (uint256);
    function ticketsSold() external view returns (uint256);
    function isActive() external view returns (bool);
    function eventTitle() external view returns (string memory);
    function eventDescription() external view returns (string memory);
    function eventURI() external view returns (string memory);
    function venue() external view returns (string memory);
    function createdAt() external view returns (uint256);
}

/**
 * @title IEventTicketNFT
 * @dev Interface for EventTicketNFT contract
 */
interface IEventTicketNFT {
    // Structs
    struct Ticket {
        uint256 tokenId;
        address originalBuyer;
        uint256 mintedAt;
        uint256 categoryId;
        bool isUsed;
    }
    
    // Events
    event TicketMinted(uint256 indexed tokenId, address indexed buyer, uint256 categoryId);
    event TicketUsed(uint256 indexed tokenId);
    
    // View functions
    function ROYALTY_FEE() external view returns (uint256);
    function eventContract() external view returns (address);
    function tickets(uint256 tokenId) external view returns (Ticket memory);
    function usedTickets(uint256 tokenId) external view returns (bool);
    function getTicket(uint256 tokenId) external view returns (Ticket memory);
    function getTicketsOfOwner(address owner) external view returns (uint256[] memory);
    function isTicketUsed(uint256 tokenId) external view returns (bool);
    
    // ERC721 functions (inherited)
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function totalSupply() external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
    
    // State-changing functions
    function mintTicket(address to, string memory tokenURI, uint256 categoryId) external returns (uint256);
    function batchMintTickets(address to, string[] memory tokenURIs, uint256 categoryId) external returns (uint256[] memory);
    function purchaseTickets(uint256 quantity, uint256 categoryId, string[] memory tokenURIs) external payable returns (uint256[] memory);
    function useTicket(uint256 tokenId) external;
    
    // Royalty function
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256);
}

/**
 * @title IEventFactory
 * @dev Interface for EventFactory contract
 */
interface IEventFactory {
    // Structs
    struct EventInfo {
        address eventContract;
        address nftContract;
        address organizer;
        string title;
        uint256 createdAt;
        bool isActive;
        uint256 ticketsSold;
        uint256 totalRevenue;
    }
    
    // Events
    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        address eventContract,
        address nftContract,
        string title
    );
    event EventDeactivated(uint256 indexed eventId);
    event PlatformFeeUpdated(uint256 newFee);
    event PlatformFeeRecipientUpdated(address newRecipient);
    
    // View functions
    function platformFee() external view returns (uint256);
    function platformFeeRecipient() external view returns (address);
    function eventCounter() external view returns (uint256);
    function events(uint256 eventId) external view returns (
        address eventContract,
        address nftContract,
        address organizer,
        string memory title,
        uint256 createdAt,
        bool isActive,
        uint256 ticketsSold,
        uint256 totalRevenue
    );
    function organizerEvents(address organizer, uint256 index) external view returns (uint256);
    function getOrganizerEventCount(address organizer) external view returns (uint256);
    function getAllEventIds() external view returns (uint256[] memory);
    function getActiveEvents() external view returns (uint256[] memory);
    function getOrganizerEvents(address organizer) external view returns (uint256[] memory);
    
    // State-changing functions
    function createEvent(
        string memory _title,
        string memory _description,
        uint256 _ticketPrice,
        uint256 _maxTickets,
        string memory _eventURI,
        uint256 _eventStartTime,
        uint256 _eventEndTime,
        string memory _venue,
        string memory _nftName,
        string memory _nftSymbol
    ) external returns (uint256 eventId, address eventContract, address nftContract);
    
    function deactivateEvent(uint256 eventId) external;
    function updateEventStats(uint256 eventId, uint256 ticketsSold, uint256 revenue) external;
    function setPlatformFee(uint256 _fee) external;
    function setPlatformFeeRecipient(address _recipient) external;
    function withdrawPlatformFees() external;
}