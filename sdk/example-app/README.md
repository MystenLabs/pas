# PAS SDK Example Application

This example application demonstrates how to use the `@mysten/pas` SDK to interact with the Permissioned Assets Standard on Sui.

## Setup

1. **Build the PAS SDK first** (required before running examples):

```bash
cd /Users/manos/Desktop/code/pas/sdk/pas
pnpm build
```

2. **Install dependencies** (from workspace root):

```bash
cd /Users/manos/Desktop/code/pas/sdk
pnpm install
```

## Running the Examples

### Basic Example

```bash
cd example-app
pnpm start
```

Shows:
- Creating a Sui client
- Initializing the PAS client
- Accessing package configuration
- Using network configurations

### Extension Pattern Example (SDK v2.0)

```bash
pnpm extension
```

Demonstrates:
- Using the `$extend()` method to add PAS functionality to a Sui client
- Accessing PAS through the extended client
- Custom package configuration
- Combining base Sui client methods with PAS

### Advanced TypeScript Example

```bash
pnpm advanced
```

Shows:
- Type-safe PAS client usage
- Custom configuration with types
- Error handling patterns

## Examples Overview

### 1. Basic Usage (`src/index.ts`)

```typescript
import { SuiClient } from '@mysten/sui/client';
import { PASClient } from '@mysten/pas';

const suiClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });
const pasClient = new PASClient({
  suiClient,
  network: 'testnet',
});

const config = pasClient.getPackageConfig();
console.log('Package ID:', config.packageId);
```

### 2. Extension Pattern - SDK v2.0 (`src/extension-example.ts`)

```typescript
import { SuiClient } from '@mysten/sui/client';
import { pas } from '@mysten/pas';

const client = new SuiClient({
  url: 'https://fullnode.testnet.sui.io',
});

// Extend with PAS using $extend
const extendedClient = client.$extend(pas({
  network: 'testnet',
}));

// Access PAS through the extended client
const config = extendedClient.pas.getPackageConfig();

// Still access base Sui client methods
const chainId = await extendedClient.getChainIdentifier();
```

### 3. TypeScript with Type Safety (`src/typescript-example.ts`)

```typescript
import { SuiClient } from '@mysten/sui/client';
import { PASClient, type PASPackageConfig } from '@mysten/pas';

const pasClient: PASClient = new PASClient({
  suiClient,
  network: 'testnet',
});

const config: PASPackageConfig = pasClient.getPackageConfig();
```

## Development Workflow

1. **Make changes to the PAS SDK** in `../pas/src/`
2. **Rebuild the SDK**: `cd ../pas && pnpm build`
3. **Run examples** to test your changes

## Next Steps

Once you implement PAS-specific methods in the SDK, extend these examples to show:

1. **Creating Permissioned Assets**
   ```typescript
   const asset = await pasClient.createPermissionedAsset({...});
   ```

2. **Granting Permissions**
   ```typescript
   await pasClient.grantPermission({
     assetId: '0x...',
     recipient: '0x...',
     permissions: ['read', 'write']
   });
   ```

3. **Checking Permissions**
   ```typescript
   const hasPermission = await pasClient.checkPermission({
     assetId: '0x...',
     address: '0x...',
     permission: 'read'
   });
   ```

4. **Transferring Assets**
   ```typescript
   await pasClient.transferPermissionedAsset({
     assetId: '0x...',
     recipient: '0x...',
     signer
   });
   ```

## Troubleshooting

### "Cannot find package" Error

Make sure you've built the PAS SDK:

```bash
cd /Users/manos/Desktop/code/pas/sdk/pas
pnpm build
```

### Module Resolution Issues

The examples use workspace dependencies. Ensure you're running from the correct directory and have run `pnpm install` from the workspace root.

### Type Errors

If you see TypeScript errors, rebuild the SDK to regenerate type definitions:

```bash
cd ../pas
pnpm build
```
