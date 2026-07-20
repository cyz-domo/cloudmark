# Cloudmark

[![AGPL LICENSE](https://img.shields.io/badge/LICENSE-AGPL-blue.svg)](https://www.gnu.org/licenses/agpl-3.0.html)
[![Try It Online](https://img.shields.io/badge/TryIt-Online-orange.svg)](https://cloudmark.yxra3603.workers.dev/)

[中文文档](README.zh.md)

## Introduction

Cloudmark is a universal cloud bookmark management tool that allows you to easily save and access your bookmarks from anywhere. No login or registration required — create a collection ID (`mark`) plus a secret **write token**, install the bookmarklet, and start saving pages.

Try it online: [https://cloudmark.yxra3603.workers.dev/](https://cloudmark.yxra3603.workers.dev/)

## Key Features

- 🔑 **No Registration**: Access your collection with a unique `mark`; writes require a write token
- 🔖 **One-Click Save**: Bookmarklet embeds mark + write token
- 🏷️ **Category Management**: Custom categories for organization
- 🌐 **Cross-Device Access**: Read anywhere; copy the write token to another device to write
- 📝 **Detailed Descriptions**: Optional notes per bookmark
- 🌍 **Multi-Language Support**: English and Chinese
- ✨ **Modern Interface**: Responsive design
- 🗄️ **Cloudflare D1**: Relational storage with automatic KV → D1 migration for legacy data

## Security Model

| Capability | Requirement |
|------------|-------------|
| View collection | Know the `mark` (URL) |
| Add / edit / delete | Valid **write token** for that mark |
| Bookmarklet save | `mark` + `token` query params |

- Write tokens are hashed (SHA-256) in D1; plaintext is only stored in the browser (`localStorage`) and in the bookmarklet.
- After KV → D1 migration, a one-time write token is issued and shown in a dismissible banner with a new bookmarklet.
- Rate limits and field length limits protect against abuse.

## Quick Start

1. Visit [https://cloudmark.yxra3603.workers.dev/doc](https://cloudmark.yxra3603.workers.dev/doc)
2. Generate a `mark` and write token (or customize the mark)
3. Drag the bookmarklet to your browser bookmarks bar
4. Click the bookmarklet while browsing to save pages
5. Open `https://cloudmark.yxra3603.workers.dev/your-mark` to manage bookmarks

### Migrating from the old (KV) version

1. Open your existing collection URL (`/your-mark`)
2. Data is migrated to D1 automatically
3. A banner shows your **new write token** and **new bookmarklet**
4. Copy the token, reinstall the bookmarklet, then dismiss the banner
5. On other devices, paste the same token when prompted

## Local Development

### Prerequisites

- Node.js 20+ and pnpm
- Cloudflare account (for preview and deployment)

### Install Dependencies

```bash
pnpm install
```

### D1 setup

1. Create a D1 database:

```bash
pnpm exec wrangler d1 create cloudmark
```

2. Put the returned `database_id` into `wrangler.jsonc` → `d1_databases[0].database_id`.

3. Apply migrations:

```bash
# local (Miniflare)
pnpm db:migrate:local

# production
pnpm db:migrate:remote
```

Legacy KV binding (`cloudmark`) can remain for automatic migration; remove it after all collections are migrated.

### Development Mode

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

### Local Preview with Cloudflare

```bash
pnpm db:migrate:local
pnpm preview
```

### Build and Deploy

```bash
pnpm db:migrate:remote
pnpm deploy
```

## Cloudflare Configuration

### D1 Database

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "cloudmark",
    "database_id": "your-d1-database-id",
    "migrations_dir": "migrations"
  }
]
```

### KV Namespace (optional, migration only)

```jsonc
"kv_namespaces": [
  {
    "binding": "cloudmark",
    "id": "your-kv-namespace-id"
  }
]
```

### Environment Variables

- `NEXT_PUBLIC_BASE_URL` — site base URL (optional; defaults to current domain)

## Technology Stack

- [Next.js](https://nextjs.org/) — React framework
- [Cloudflare Workers](https://workers.cloudflare.com/) — hosting (OpenNext)
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — primary data store
- [Cloudflare KV](https://developers.cloudflare.com/kv/) — legacy migration source
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [Next-Intl](https://next-intl-docs.vercel.app/) — internationalization

## License

This project is open-sourced under the [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html) license.

## Contributing

Issues and Pull Requests are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Contact

If you have any questions, please contact us through GitHub Issues.
