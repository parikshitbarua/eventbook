# EventBook Smart Contracts

This directory contains the complete smart contract system for EventBook, a decentralized event ticketing platform built on Ethereum.

## 📋 Contract Architecture

### Core Contracts

1. **EventFactory.sol** - Main factory contract for creating and managing events
2. **EventContract.sol** - Individual event management contract
3. **EventTicketNFT.sol** - NFT contract for ticket management
4. **EventUtils.sol** - Utility contract with analytics and helper functions

### Interface Contracts

Located in `interfaces/` directory:

1. **IEventFactory.sol** - Interface for EventFactory
2. **IEventContract.sol** - Interface for EventContract  
3. **IEventTicketNFT.sol** - Interface for EventTicketNFT

### Utility Files

1. **Interfaces.sol** - Central import file for all interfaces
2. **README.md** - This documentation file

## 🏗️ Contract Relationships

```
EventFactory (Main Entry Point)
├── Creates EventContract instances
├── Creates EventTicketNFT instances  
├── Links EventContract ↔ EventTicketNFT
├── Tracks all events and analytics
└── Manages platform fees

EventContract (Per Event)
├── Manages event details and settings
├── Handles ticket sales and validation
├── Integrates with EventTicketNFT for minting
├── Supports multiple ticket categories
└── Implements access controls and timing

EventTicketNFT (Per Event)
├── ERC721 compliant NFT tickets
├── Supports batch minting
├── Implements royalty standards (ERC2981)
├── Tracks ticket usage and ownership
└── Linked to specific EventContract

EventUtils (Analytics & Helpers)
├── Provides event analytics
├── Platform-wide statistics
├── Event filtering and search
└── Trending events calculation
```

## 🚀 Deployment Guide

### 1. Deploy EventFactory

```bash
# Deploy the factory contract
npx hardhat run scripts/deployFactory.ts --network localhost

# Note the deployed factory address for next steps
```

### 2. Create Events

```bash
# Create sample events using the factory
npx hardhat run scripts/createEventsWithFactory.ts --network localhost
```

### 3. Deploy EventUtils (Optional)

```bash
# Deploy analytics contract (replace FACTORY_ADDRESS)
npx hardhat run scripts/deployUtils.ts --network localhost
```

## 🎯 Key Features

### EventFactory Features

- **Event Creation**: Deploy EventContract + EventTicketNFT pairs
- **Platform Management**: Fee collection and platform statistics
- **Event Tracking**: Comprehensive event registry and analytics
- **Access Control**: Owner-only administrative functions

### EventContract Features

- **Ticket Sales**: Secure ticket purchasing with ETH
- **Multiple Categories**: Support for different ticket types/prices
- **Access Control**: Organizer permissions and whitelist support
- **Time Management**: Sales windows and event scheduling
- **Revenue Handling**: Direct payments to organizers

### EventTicketNFT Features

- **ERC721 Compliance**: Standard NFT functionality
- **Batch Operations**: Efficient multi-ticket minting
- **Royalty Support**: ERC2981 for secondary sales
- **Usage Tracking**: Mark tickets as used for entry
- **Metadata Support**: Rich ticket information

### EventUtils Features

- **Event Analytics**: Detailed per-event statistics
- **Platform Analytics**: Aggregated platform metrics
- **Event Filtering**: Search by price, status, date
- **Trending Analysis**: Popular events identification

## 📊 Usage Examples

### Creating an Event

```solidity
// Through EventFactory
(uint256 eventId, address eventContract, address nftContract) = factory.createEvent(
    "Summer Music Festival",
    "Amazing summer festival with top artists",
    0.1 ether,           // ticket price
    1000,                // max tickets
    "ipfs://metadata",   // event metadata URI
    1735689600,          // start time (timestamp)
    1735776000,          // end time (timestamp)
    "Central Park, NYC", // venue
    "Summer Festival NFT", // NFT name
    "SFN"                // NFT symbol
);
```

### Purchasing Tickets

```solidity
// Through EventTicketNFT contract
string[] memory tokenURIs = ["ipfs://ticket1", "ipfs://ticket2"];
uint256[] memory ticketIds = nftContract.purchaseTickets{value: 0.2 ether}(
    2,          // quantity
    0,          // category ID (0 = default)
    tokenURIs   // metadata URIs for each ticket
);
```

### Getting Event Analytics

```solidity
// Through EventUtils
EventUtils.EventAnalytics memory analytics = eventUtils.getEventAnalytics(eventId);
// Returns: tickets sold, revenue, capacity utilization, etc.
```

## 🔐 Security Features

### Access Controls

- **Owner-only functions**: Platform configuration and emergency controls
- **Organizer permissions**: Event management and settings
- **Time-based controls**: Sales windows and event scheduling
- **Whitelist support**: Restricted ticket sales

### Safety Mechanisms

- **Reentrancy protection**: All payable functions protected
- **Overflow protection**: SafeMath equivalent in Solidity 0.8+
- **Input validation**: Comprehensive parameter checking
- **Emergency controls**: Circuit breakers and pause functionality

### Audit Considerations

- **Standard implementations**: Uses OpenZeppelin contracts
- **Clear separation of concerns**: Modular architecture
- **Event logging**: Comprehensive event emission
- **State consistency**: Careful state management

## 🎫 Ticket Lifecycle

1. **Event Creation**: Factory deploys contracts
2. **Sales Period**: Users purchase tickets → NFTs minted
3. **Event Day**: Tickets validated and marked as used
4. **Post-Event**: Analytics available, royalties on resales

## 💰 Economic Model

### Platform Fees
- Default: 2.5% platform fee on event creation
- Configurable by platform owner
- Fees collected in EventFactory

### Organizer Revenue
- Direct payment to organizer on ticket sales
- No intermediary holding of funds
- Automatic refunds for oversold events

### Royalties
- 5% royalty on secondary NFT sales
- Paid to original event organizer
- Implemented via ERC2981 standard

## 🔧 Configuration

### Environment Variables

Create `.env` file:
```
PRIVATE_KEY=your_private_key
INFURA_PROJECT_ID=your_infura_id
ETHERSCAN_API_KEY=your_etherscan_key
```

### Network Configuration

Update `hardhat.config.ts` for different networks:
```typescript
networks: {
  mainnet: { ... },
  polygon: { ... },
  arbitrum: { ... }
}
```

## 📝 Development Notes

### Testing
```bash
npx hardhat test
npx hardhat coverage
```

### Deployment
```bash
npx hardhat compile
npx hardhat run scripts/deploy.ts --network <network>
```

### Verification
```bash
npx hardhat verify <contract_address> --network <network>
```

## 🆙 Upgrade Path

The contracts are designed with modularity in mind:

1. **EventFactory**: Central registry, can be upgraded
2. **EventContract**: Per-event, immutable after deployment
3. **EventTicketNFT**: Per-event, immutable after deployment
4. **EventUtils**: Analytics, can be redeployed as needed

## 🤝 Contributing

1. Follow Solidity best practices
2. Add comprehensive tests for new features
3. Update interfaces when modifying contracts
4. Document all public functions
5. Consider gas optimization

## 📜 License

MIT License - See LICENSE file for details

## 🔗 Links

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethereum Development](https://ethereum.org/developers/)
- [ERC721 Standard](https://eips.ethereum.org/EIPS/eip-721)
- [ERC2981 Royalty Standard](https://eips.ethereum.org/EIPS/eip-2981) 