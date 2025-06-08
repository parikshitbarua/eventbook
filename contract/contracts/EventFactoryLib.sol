// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./EventContract.sol";
import "./EventTicketNFT.sol";
import "./Interfaces.sol";

/**
 * @title EventFactoryLib
 * @dev Library containing heavy functions to reduce main contract size
 */
library EventFactoryLib {
    
    function deployEventContracts(
        string memory title,
        string memory description,
        address organizer,
        uint256 ticketPrice,
        uint256 maxTickets,
        string memory eventURI,
        uint256 eventStartTime,
        uint256 eventEndTime,
        string memory venue,
        string memory nftName,
        string memory nftSymbol
    ) external returns (address eventContract, address nftContract) {
        
        // Deploy EventContract
        eventContract = address(new EventContract(
            title, description, organizer, ticketPrice, maxTickets,
            eventURI, eventStartTime, eventEndTime, venue
        ));
        
        // Deploy EventTicketNFT
        nftContract = address(new EventTicketNFT(
            nftName, nftSymbol, eventContract, organizer
        ));
        
        // Link contracts
        EventContract(eventContract).setNFTContract(nftContract);
    }
    
    function getActiveEventIds(
        uint256[] storage allEventIds,
        mapping(uint256 => IEventFactory.EventInfo) storage events
    ) external view returns (uint256[] memory) {
        uint256 activeCount = 0;
        uint256 length = allEventIds.length;
        
        for (uint256 i = 0; i < length; i++) {
            if (events[allEventIds[i]].isActive) activeCount++;
        }
        
        uint256[] memory activeEvents = new uint256[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < length; i++) {
            if (events[allEventIds[i]].isActive) {
                activeEvents[index++] = allEventIds[i];
            }
        }
        
        return activeEvents;
    }
    
    function getEventDetailsFromContract(address eventContract) 
        external 
        view 
        returns (
            string memory description,
            uint256 ticketPrice,
            uint256 maxTickets,
            string memory eventURI,
            uint256 eventStartTime,
            uint256 eventEndTime,
            string memory venue
        ) 
    {
        EventContract ec = EventContract(eventContract);
        description = ec.eventDescription();
        ticketPrice = ec.ticketPrice();
        maxTickets = ec.maxTickets();
        eventURI = ec.eventURI();
        eventStartTime = ec.eventStartTime();
        eventEndTime = ec.eventEndTime();
        venue = ec.venue();
    }
} 