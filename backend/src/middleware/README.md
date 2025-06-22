# NFT Ownership Verification Middleware

## Overview

The `verifyNftOwner` middleware provides comprehensive verification of NFT ownership by:

1. **Signature Verification**: Validates that the provided signature was signed by the claimed wallet address
2. **Event Contract Lookup**: Retrieves event details from the EventFactory contract to get the NFT contract address
3. **NFT Ownership Verification**: Confirms that the wallet address owns the specified token ID

## Usage

### Basic Implementation

```typescript
import verifyNftOwner from "../middleware/verify-nft-owner.middleware";

// Apply middleware to routes that require NFT ownership
router.post("/protected-route", verifyNftOwner, (req, res) => {
  const { verifiedData } = req.body;
  // Access verified data here
});
```

### Required Request Body

```typescript
{
    tokenId: string;        // The NFT token ID to verify
    eventId: string;        // The event ID associated with the NFT
    walletAddress: string;  // The wallet address claiming ownership
    userSignature: string; // Signature proving wallet ownership
    message?: string;       // Optional: custom message that was signed
}
```

### Default Message Format

If no custom message is provided, the middleware uses:

```
"Verify NFT ownership for token {tokenId} in event {eventId}"
```

### Response on Success

The middleware adds `verifiedData` to the request body:

```typescript
{
  verifiedData: {
    eventDetails: any; // Full event details from EventFactory
    nftContractAddress: string; // The NFT contract address
    tokenOwner: string; // Confirmed owner address
    isVerified: boolean; // Always true if middleware passes
  }
}
```

## Error Responses

### 400 - Bad Request

- Missing required fields
- Event has no associated NFT contract

### 401 - Unauthorized

- Invalid signature format
- Signature verification failed

### 403 - Forbidden

- Wallet is not the owner of the specified token

### 404 - Not Found

- Event not found
- Token does not exist

### 500 - Internal Server Error

- Blockchain connection issues
- Contract interaction failures

## Frontend Integration Example

```typescript
// Frontend code to generate the signature
const message = `Verify NFT ownership for token ${tokenId} in event ${eventId}`;
const signature = await signer.signMessage(message);

// Send request to backend
const response = await fetch("/api/nft/verify-ownership", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tokenId,
    eventId,
    walletAddress: await signer.getAddress(),
    userSignature: signature,
    message // Optional: include the message for clarity
  })
});
```

## Configuration

The middleware uses `blockchain.config.ts` for:

- Network URL (RPC endpoint)
- EventFactory contract address
- Chain ID

Ensure these environment variables are set:

- `NETWORK_URL`: Blockchain RPC URL
- `FACTORY_ADDRESS`: EventFactory contract address
- `CHAIN_ID`: Network chain ID

## Security Features

1. **Message Verification**: Uses `ethers.verifyMessage()` for cryptographic signature validation
2. **Address Normalization**: All address comparisons are case-insensitive
3. **Contract Validation**: Verifies NFT contract exists and token is valid
4. **Error Handling**: Comprehensive error handling with specific error codes
5. **Data Attachment**: Verified data is attached to request for downstream use
