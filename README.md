# enablerhq.com

Corporate website for **株式会社イネブラ (Enabler Inc.)**.

- 🌐 Live: <https://enablerhq.com>
- 🛠️ Stack: Static HTML + nginx (alpine) on Fly.io
- 💴 Cost: ~$5/month (shared-cpu-1x · 256MB · auto-stop)
- 🚀 Deploy: `git push` → GitHub Actions → Fly.io

## Local

```bash
# Just open the file:
open static/index.html
```

## Deploy

```bash
fly deploy --remote-only -a enablerhq
# or just `git push` — CI handles it
```

## Layout

```
enablerhq/
├── static/
│   ├── index.html      # the whole site (single-page)
│   └── favicon.svg
├── Dockerfile          # nginx:alpine
├── fly.toml
├── .github/workflows/deploy.yml
└── README.md
```

## License

Proprietary. © 2026 株式会社イネブラ.
