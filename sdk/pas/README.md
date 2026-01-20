# @mysten/pas

Permissioned Assets Standard (PAS) SDK for Sui blockchain.

## Installation

```bash
npm install @mysten/pas
# or
pnpm add @mysten/pas
# or
yarn add @mysten/pas
```

## Usage

### Basic Setup

```typescript
import { PASClient, TESTNET_PAS_PACKAGE_CONFIG } from '@mysten/pas';
import { SuiClient } from '@mysten/sui/client';

// Create a Sui client
const suiClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

// Create a PAS client using network config
const pasClient = new PASClient({
	suiClient,
	network: 'testnet',
});

// Or use a custom package configuration
const pasClient = new PASClient({
	suiClient,
	packageConfig: TESTNET_PAS_PACKAGE_CONFIG,
});
```

### Using the Plugin Pattern

```typescript
import { pas } from '@mysten/pas';
import { createSuiClient } from '@mysten/sui/client';

const client = createSuiClient({
	url: 'https://fullnode.testnet.sui.io',
});

// Register the PAS plugin
const pasPlugin = client.registerPlugin(
	pas({
		name: 'pas',
		network: 'testnet',
	}),
);

// Use the plugin
const config = pasPlugin.getPackageConfig();
```

## API

### PASClient

The main client class for interacting with the Permissioned Assets Standard.

#### Methods

- `getPackageConfig()`: Get the current package configuration
- `getSuiClient()`: Get the underlying Sui client instance

_More methods will be added as the SDK develops._

## Configuration

### Package Configuration

The SDK requires a package configuration that specifies the PAS package ID on the network:

```typescript
interface PASPackageConfig {
	packageId: string;
}
```

Pre-configured constants are available:

- `TESTNET_PAS_PACKAGE_CONFIG` - Configuration for testnet
- `MAINNET_PAS_PACKAGE_CONFIG` - Configuration for mainnet

## Error Handling

The SDK provides several error classes for handling different failure scenarios:

- `PASClientError` - Base error class for all PAS client errors
- `PermissionDeniedError` - Thrown when a permission check fails
- `AssetNotFoundError` - Thrown when an asset is not found
- `InvalidConfigError` - Thrown when an invalid configuration is provided

```typescript
import { PASClientError, PermissionDeniedError } from '@mysten/pas';

try {
	// Your PAS operations
} catch (error) {
	if (error instanceof PermissionDeniedError) {
		console.error('Permission denied:', error.message);
	} else if (error instanceof PASClientError) {
		console.error('PAS error:', error.message);
	}
}
```

## Development

### Building

```bash
pnpm build
```

### Testing

```bash
pnpm test
```

### Linting

```bash
pnpm lint
```

## License

Apache-2.0
