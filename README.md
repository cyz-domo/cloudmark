# Cloudmark

[![AGPL LICENSE](https://img.shields.io/badge/LICENSE-AGPL-blue.svg)](https://www.gnu.org/licenses/agpl-3.0.html)
[![Try It Online](https://img.shields.io/badge/TryIt-Online-orange.svg)](https://cloudmark.site/)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wesleyel/cloudmark)

[中文文档](README.zh.md)

## Introduction

Cloudmark is a universal cloud bookmark management tool that allows you to easily save and access your bookmarks from anywhere. No login or registration required — create a collection ID (`mark`) plus a secret **write token**, install the bookmarklet, and start saving pages.

Try it online: [https://cloudmark.site/](https://cloudmark.site/)

## Key Features

- 🔑 **No Registration**: Access your collection with a unique `mark`; writes require a write token
- 🔖 **One-Click Save**: Bookmarklet embeds mark + write token
- 🏷️ **Category Management**: Custom categories for organization
- ⌨️ **Keyboard-first**: `/` search, `j/k` navigate, `n/e/d` CRUD, `?` help
- 📋 **High density**: Compact list with instant filter / sort
- 🎨 **Custom icons**: Emoji, letter marks, or upload SVG/ICO/PNG
- 🌐 **Cross-Device Access**: Read anywhere; copy the write token to another device to write
- 📝 **Detailed Descriptions**: Optional notes per bookmark
- 🌍 **Multi-Language Support**: English and Chinese
- 🗄️ **Cloudflare D1**: Relational storage on the edge

## Security Model

| Capability | Requirement |
|------------|-------------|
| View collection | Know the `mark` (URL) |
| Add / edit / delete | Valid **write token** for that mark |
| Bookmarklet save | `mark` + `token` query params |

- Write tokens are hashed (SHA-256) in D1; plaintext is only stored in the browser (`localStorage`) and in the bookmarklet.
- Rate limits and field length limits protect against abuse.

## Quick Start

1. Visit [https://cloudmark.site/doc](https://cloudmark.site/doc)
2. Generate a `mark` and write token (or customize the mark)
3. Drag the bookmarklet to your browser bookmarks bar
4. Click the bookmarklet while browsing to save pages
5. Open `https://cloudmark.site/your-mark` to manage bookmarks

## Local Development

### Prerequisites

- Node.js 20+ and pnpm
- Cloudflare account (for preview and deployment)

### Install Dependencies

```bash
pnpm install
```

### D1 setup

The database name defaults to `cloudmark`. To use another D1 database name, set `CLOUDMARK_DATABASE_NAME` before running migration or deployment:

```bash
export CLOUDMARK_DATABASE_NAME=project-a
```

1. Create a D1 database if needed:

```bash
pnpm exec wrangler d1 create "${CLOUDMARK_DATABASE_NAME:-cloudmark}"
```

The deployment command automatically reuses an existing database with this name or creates it when missing. It also applies remote migrations before deploying.

3. Apply migrations:

```bash
# local (Miniflare)
pnpm db:migrate:local

# production
pnpm db:migrate:remote
```

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

One-click deploy (creates a Cloudflare Worker from this repo):

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wesleyel/cloudmark)

Or from your machine:

```bash
pnpm run deploy
```

For Cloudflare build deployments, add `CLOUDMARK_DATABASE_NAME` as a build environment variable when using a non-default database name. The default is `cloudmark`.

## Cloudflare Configuration

### D1 Database

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "cloudmark",
    "migrations_dir": "migrations"
  }
]
```

`database_id` is resolved and injected into a temporary deployment configuration automatically.

### Environment Variables

- `BASE_URL` — public site URL in Worker vars (optional; client uses current origin)

## Technology Stack

- [TypeScript 7](https://www.typescriptlang.org/) — language
- [React](https://react.dev/) + [Vite](https://vite.dev/) — SPA frontend
- [Hono](https://hono.dev/) — Worker API
- [Cloudflare Workers](https://workers.cloudflare.com/) — hosting (`@cloudflare/vite-plugin`)
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — primary data store
- [Tailwind CSS](https://tailwindcss.com/) + shadcn/ui — styling

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
