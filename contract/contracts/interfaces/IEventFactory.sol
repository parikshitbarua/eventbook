// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

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
    function events(uint256 eventId) external view returns (EventInfo memory);
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