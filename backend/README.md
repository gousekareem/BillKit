# BillKit backend

Fastify 5 API with SQLite, the processing queue and the CLI tools.

```bash
npm run dev -w backend                 # tsx watch, reads ../.env
npm run build -w backend && npm start  # dist/server.js
npm run test -w backend                # 22 integration tests (real pipeline, temporary database)
npm run db:migrate                     # apply database/migrations
npm run admin:grant -- user@example.com
npm run corrections:export -w backend -- corrections_for_review.csv   # consented corrections only
```

Structure and design: `docs/technical/03_backend_architecture.md`; API: `docs/api_documentation.md`; configuration: `.env.example`.

© 2026 Shaik Gouse Kareem. All rights reserved.
