// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./EventContract.sol";
import "./EventTicketNFT.sol";
import "./EventFactoryLib.sol";
import "./Interfaces.sol";

/**
 * @title EventFactory (Optimized with Library)
 * @dev Factory contract for creating and managing events - uses library for size optimization
 */
contract EventFactory is IEventFactory {
    using EventFactoryLib for *;
    
    uint256 public override platformFee = 250; // 2.5%
    address public override platformFeeRecipient;
    uint256 public override eventCounter;
    address private _owner;
    
    mapping(uint256 => EventInfo) public events;
    mapping(address => uint256[]) public organizerEventsList;
    mapping(address => uint256) public organizerEventCount;
    uint256[] private allEventIds;
    
    modifier onlyOwner() {
        require(msg.sender == _owner, "Not owner");
        _;
    }
    
    modifier validEventId(uint256 eventId) {
        require(eventId > 0 && eventId <= eventCounter, "Invalid event ID");
        _;
    }
    
    modifier onlyEventOrganizer(uint256 eventId) {
        require(events[eventId].organizer == msg.sender, "Not event organizer");
        _;
    }
    
    constructor(address _platformFeeRecipient) {
        require(_platformFeeRecipient != address(0), "Invalid fee recipient");
        _owner = msg.sender;
        platformFeeRecipient = _platformFeeRecipient;
    }
    
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
    ) external override returns (uint256 eventId, address eventContract, address nftContract) {
        require(bytes(_title).length > 0, "Empty title");
        require(_ticketPrice > 0, "Invalid price");
        require(_eventStartTime > block.timestamp, "Past event start");
        require(_eventEndTime > _eventStartTime, "Invalid times");
        
        eventId = ++eventCounter;
        
        // Use library to deploy contracts
        (eventContract, nftContract) = EventFactoryLib.deployEventContracts(
            _title, _description, msg.sender, _ticketPrice, _maxTickets,
            _eventURI, _eventStartTime, _eventEndTime, _venue, _nftName, _nftSymbol
        );
        
        // Store event info
        events[eventId] = EventInfo({
            eventContract: eventContract,
            nftContract: nftContract,
            organizer: msg.sender,
            title: _title,
            createdAt: block.timestamp,
            isActive: true,
            ticketsSold: 0,
            totalRevenue: 0
        });
        
        organizerEventsList[msg.sender].push(eventId);
        organizerEventCount[msg.sender]++;
        allEventIds.push(eventId);
        
        emit EventCreated(eventId, msg.sender, eventContract, nftContract, _title);
    }
    
    function deactivateEvent(uint256 eventId) external override validEventId(eventId) onlyEventOrganizer(eventId) {
        require(events[eventId].isActive, "Already inactive");
        events[eventId].isActive = false;
        EventContract(events[eventId].eventContract).deactivateEvent();
        emit EventDeactivated(eventId);
    }
    
    function updateEventStats(uint256 eventId, uint256 ticketsSold, uint256 revenue) external override validEventId(eventId) {
        require(msg.sender == events[eventId].eventContract, "Only event contract");
        events[eventId].ticketsSold = ticketsSold;
        events[eventId].totalRevenue += revenue;
    }
    
    function getAllEventIds() external view override returns (uint256[] memory) {
        return allEventIds;
    }
    
    function getActiveEvents() external view override returns (uint256[] memory) {
        return EventFactoryLib.getActiveEventIds(allEventIds, events);
    }
    
    function getOrganizerEvents(address organizer) external view override returns (uint256[] memory) {
        return organizerEventsList[organizer];
    }
    
    function getOrganizerEventCount(address organizer) external view override returns (uint256) {
        return organizerEventCount[organizer];
    }
    
    function organizerEvents(address organizer, uint256 index) external view override returns (uint256) {
        require(index < organizerEventsList[organizer].length, "Index out of bounds");
        return organizerEventsList[organizer][index];
    }
    
    function setPlatformFee(uint256 _fee) external override onlyOwner {
        require(_fee <= 1000, "Fee too high");
        platformFee = _fee;
        emit PlatformFeeUpdated(_fee);
    }
    
    function setPlatformFeeRecipient(address _recipient) external override onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        platformFeeRecipient = _recipient;
        emit PlatformFeeRecipientUpdated(_recipient);
    }
    
    function withdrawPlatformFees() external override onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        (bool success, ) = payable(platformFeeRecipient).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    function getEventDetails(uint256 eventId) external view validEventId(eventId) 
        returns (
            EventInfo memory eventInfo,
            string memory description,
            uint256 ticketPrice,
            uint256 maxTickets,
            string memory eventURI,
            uint256 eventStartTime,
            uint256 eventEndTime,
            string memory venue
        ) {
        eventInfo = events[eventId];
        (description, ticketPrice, maxTickets, eventURI, eventStartTime, eventEndTime, venue) = 
            EventFactoryLib.getEventDetailsFromContract(eventInfo.eventContract);
    }
    
    function owner() external view returns (address) {
        return _owner;
    }
    
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = payable(_owner).call{value: address(this).balance}("");
        require(success, "Emergency withdrawal failed");
    }
    
    receive() external payable {}
}