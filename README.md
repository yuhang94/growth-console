# growth-console

The unified management console for [GrowthPlatform](https://github.com/yuhang94) — a marketing domain open-source project.

Currently provides management UI for [growth-profile](https://github.com/yuhang94/growth-profile) (user profiling & tagging system).

## Features

- **Tag Definition Management** — Create, edit, enable/disable tag definitions with support for multiple data types (STRING, LONG, DOUBLE, BOOLEAN, ENUM, DATE)
- **Tag Value Query** — Look up user tags by userId, write/delete individual tag values

## Tech Stack

| Category | Choice |
|---|---|
| Framework | Vue 3 (Composition API + `<script setup>`) |
| Language | TypeScript |
| Build Tool | Vite 6 |
| UI Library | Element Plus |
| Router | Vue Router 4 |
| State | Pinia |
| HTTP Client | Axios |

## Quick Start

### Prerequisites

- Node.js 20+
- [growth-profile](https://github.com/yuhang94/growth-profile) service running on port 8082

### Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Type check
npx vue-tsc --noEmit

# Build for production
npm run build
```

The dev server proxies `/api` requests to `http://localhost:8082` automatically.

## Project Structure

```
src/
├── api/              # Backend API clients
│   ├── request.ts    # Axios instance with interceptors
│   ├── tagDefinition.ts
│   └── tagValue.ts
├── layout/           # App layout (sidebar + header + content)
├── router/           # Vue Router configuration
├── types/            # TypeScript type definitions
├── views/profile/    # Page components
│   ├── TagDefinitionList.vue
│   └── TagValueQuery.vue
├── App.vue
└── main.ts
```

## Related Projects

| Project | Description |
|---|---|
| [growth-platform-bom](https://github.com/yuhang94/growth-platform-bom) | Dependency version management |
| [growth-common](https://github.com/yuhang94/growth-common) | Shared libraries |
| [growth-profile](https://github.com/yuhang94/growth-profile) | User profiling & tagging |
| [growth-campaign](https://github.com/yuhang94/growth-campaign) | Marketing strategy engine |
| [growth-coupon](https://github.com/yuhang94/growth-coupon) | Coupon management |
| [growth-message](https://github.com/yuhang94/growth-message) | Multi-channel messaging |
| [growth-event](https://github.com/yuhang94/growth-event) | Event center |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[Apache License 2.0](LICENSE)
