// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EventTicketNFT
 * @dev Smart contract for blockchain-based event ticket booking platform
 * Features: Event creation, NFT ticket minting, transfers, and royalty payments
 */
contract EventTicketNFT is ERC721, ERC721URIStorage, ERC721Enumerable, IERC2981, Ownable, ReentrancyGuard {
    uint256 private _eventIdCounter;
    uint256 private _tokenIdCounter;
    uint256[] private _allEventIds;

    // Royalty fee percentage (in basis points: 1000 = 10%)
    uint256 public constant ROYALTY_FEE = 500; // 5%

    struct Event {
        uint256 eventId;
        string title;
        string description;
        address organizer;
        uint256 ticketPrice;
        uint256 maxTickets; // 0 means unlimited
        uint256 ticketsSold;
        bool isActive;
        string eventURI; // Metadata URI for the event
        uint256 createdAt;
    }

    struct Ticket {
        uint256 tokenId;
        uint256 eventId;
        address originalBuyer;
        uint256 mintedAt;
    }

    // Mappings
    mapping(uint256 => Event) public events;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => uint256) public tokenToEvent; // tokenId => eventId
    mapping(uint256 => uint256[]) public eventTickets; // eventId => tokenIds
    mapping(address => uint256[]) public organizerEvents; // organizer => eventIds

    // Events
    event EventCreated(
        uint256 indexed eventId,
        string title,
        address indexed organizer,
        uint256 ticketPrice,
        uint256 maxTickets
    );

    event TicketMinted(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address indexed buyer,
        uint256 price
    );

    event EventDeactivated(uint256 indexed eventId);

    event RoyaltyPaid(
        uint256 indexed tokenId,
        address indexed organizer,
        uint256 amount
    );

    constructor() ERC721("EventTicket", "ETKT") Ownable(msg.sender) {}

    function getAllEventIds() external view returns (uint256[] memory) {
        return _allEventIds;
    }


    /**
     * @dev Create a new event
     * @param _title Event title
     * @param _description Event description
     * @param _ticketPrice Price per ticket in wei
     * @param _maxTickets Maximum number of tickets (0 for unlimited)
     * @param _eventURI Metadata URI for the event
     */
    function createEvent(
        string memory _title,
        string memory _description,
        uint256 _ticketPrice,
        uint256 _maxTickets,
        string memory _eventURI
    ) external returns (uint256) {
        require(bytes(_title).length > 0, "Event title cannot be empty");
        require(_ticketPrice > 0, "Ticket price must be greater than 0");

        uint256 eventId = _eventIdCounter;
        _eventIdCounter++;

        events[eventId] = Event({
            eventId: eventId,
            title: _title,
            description: _description,
            organizer: msg.sender,
            ticketPrice: _ticketPrice,
            maxTickets: _maxTickets,
            ticketsSold: 0,
            isActive: true,
            eventURI: _eventURI,
            createdAt: block.timestamp
        });

        _allEventIds.push(eventId);
        organizerEvents[msg.sender].push(eventId);

        emit EventCreated(eventId, _title, msg.sender, _ticketPrice, _maxTickets);

        return eventId;
    }

    /**
     * @dev Mint a ticket NFT for an event
     * @param _eventId The event ID to mint ticket for
     * @param _tokenURI Metadata URI for the specific ticket
     */
    function mintTicket(uint256 _eventId, string memory _tokenURI)
    external
    payable
    nonReentrant
    returns (uint256)
    {
        Event storage eventData = events[_eventId];

        require(eventData.isActive, "Event is not active");
        require(msg.value >= eventData.ticketPrice, "Insufficient payment");

        // Check ticket availability
        if (eventData.maxTickets > 0) {
            require(eventData.ticketsSold < eventData.maxTickets, "Event sold out");
        }

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        // Mint the NFT
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        // Update mappings and data
        tickets[tokenId] = Ticket({
            tokenId: tokenId,
            eventId: _eventId,
            originalBuyer: msg.sender,
            mintedAt: block.timestamp
        });

        tokenToEvent[tokenId] = _eventId;
        eventTickets[_eventId].push(tokenId);
        eventData.ticketsSold++;

        // Transfer payment to organizer
        (bool success, ) = payable(eventData.organizer).call{value: msg.value}("");
        require(success, "Payment transfer failed");

        emit TicketMinted(tokenId, _eventId, msg.sender, msg.value);

        return tokenId;
    }

    /**
     * @dev Batch mint multiple tickets for an event
     * @param _eventId The event ID to mint tickets for
     * @param _quantity Number of tickets to mint
     * @param _tokenURIs Array of metadata URIs for the tickets
     */
    function batchMintTickets(
        uint256 _eventId,
        uint256 _quantity,
        string[] memory _tokenURIs
    ) external payable nonReentrant returns (uint256[] memory) {
        require(_quantity > 0 && _quantity <= 10, "Invalid quantity (1-10)");
        require(_tokenURIs.length == _quantity, "URI count mismatch");

        Event storage eventData = events[_eventId];
        require(eventData.isActive, "Event is not active");

        uint256 totalPrice = eventData.ticketPrice * _quantity;
        require(msg.value >= totalPrice, "Insufficient payment");

        // Check ticket availability
        if (eventData.maxTickets > 0) {
            require(
                eventData.ticketsSold + _quantity <= eventData.maxTickets,
                "Not enough tickets available"
            );
        }

        uint256[] memory tokenIds = new uint256[](_quantity);

        for (uint256 i = 0; i < _quantity; i++) {
            uint256 tokenId = _tokenIdCounter;
            _tokenIdCounter++;

            _safeMint(msg.sender, tokenId);
            _setTokenURI(tokenId, _tokenURIs[i]);

            tickets[tokenId] = Ticket({
                tokenId: tokenId,
                eventId: _eventId,
                originalBuyer: msg.sender,
                mintedAt: block.timestamp
            });

            tokenToEvent[tokenId] = _eventId;
            eventTickets[_eventId].push(tokenId);
            tokenIds[i] = tokenId;

            emit TicketMinted(tokenId, _eventId, msg.sender, eventData.ticketPrice);
        }

        eventData.ticketsSold += _quantity;

        // Transfer payment to organizer
        (bool success, ) = payable(eventData.organizer).call{value: totalPrice}("");
        require(success, "Payment transfer failed");

        return tokenIds;
    }

    /**
     * @dev Deactivate an event (only organizer)
     * @param _eventId The event ID to deactivate
     */
    function deactivateEvent(uint256 _eventId) external {
        Event storage eventData = events[_eventId];
        require(eventData.organizer == msg.sender, "Only organizer can deactivate");
        require(eventData.isActive, "Event already inactive");

        eventData.isActive = false;
        emit EventDeactivated(_eventId);
    }

    /**
     * @dev Get royalty information for a token
     * @param _tokenId The token ID
     * @param _salePrice The sale price of the token
     */
    function royaltyInfo(uint256 _tokenId, uint256 _salePrice)
    external
    view
    override
    returns (address, uint256)
    {
        require(ownerOf(_tokenId) != address(0), "Token does not exist");

        uint256 eventId = tokenToEvent[_tokenId];
        address organizer = events[eventId].organizer;
        uint256 royaltyAmount = (_salePrice * ROYALTY_FEE) / 10000;

        return (organizer, royaltyAmount);
    }

    // View functions

    /**
     * @dev Get event details
     */
    function getEvent(uint256 _eventId) external view returns (Event memory) {
        return events[_eventId];
    }

    /**
     * @dev Get ticket details
     */
    function getTicket(uint256 _tokenId) external view returns (Ticket memory) {
        return tickets[_tokenId];
    }

    /**
     * @dev Get all events created by an organizer
     */
    function getOrganizerEvents(address _organizer) external view returns (uint256[] memory) {
        return organizerEvents[_organizer];
    }

    /**
     * @dev Get all tickets for an event
     */
    function getEventTickets(uint256 _eventId) external view returns (uint256[] memory) {
        return eventTickets[_eventId];
    }

    /**
     * @dev Get tickets owned by an address
     */
    function getTicketsOfOwner(address _owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(_owner);
        uint256[] memory tokenIds = new uint256[](tokenCount);

        for (uint256 i = 0; i < tokenCount; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(_owner, i);
        }

        return tokenIds;
    }

    /**
     * @dev Check if tickets are available for an event
     */
    function isEventAvailable(uint256 _eventId) external view returns (bool) {
        Event memory eventData = events[_eventId];

        if (!eventData.isActive) {
            return false;
        }

        if (eventData.maxTickets == 0) {
            return true; // Unlimited tickets
        }

        return eventData.ticketsSold < eventData.maxTickets;
    }

    /**
     * @dev Get remaining tickets for an event
     */
    function getRemainingTickets(uint256 _eventId) external view returns (uint256) {
        Event memory eventData = events[_eventId];

        if (eventData.maxTickets == 0) {
            return type(uint256).max; // Unlimited
        }

        if (eventData.ticketsSold >= eventData.maxTickets) {
            return 0;
        }

        return eventData.maxTickets - eventData.ticketsSold;
    }

    // Required overrides

    function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721, ERC721URIStorage)
    returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721, ERC721URIStorage, ERC721Enumerable, IERC165)
    returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth)
    internal
    virtual
    override(ERC721, ERC721Enumerable)
    returns (address)
    {
        if (to == address(0)) {
            // Token is being burned, perform cleanup
            delete tickets[tokenId];
            delete tokenToEvent[tokenId];
            // Optionally, remove tokenId from eventTickets array if needed
            // This is a simple example; you may need more complex logic
            uint256 eventId = tokenToEvent[tokenId];
            uint256[] storage tokens = eventTickets[eventId];
            for (uint256 i = 0; i < tokens.length; i++) {
                if (tokens[i] == tokenId) {
                    tokens[i] = tokens[tokens.length - 1];
                    tokens.pop();
                    break;
                }
            }
        }
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
    internal
    virtual
    override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }
}