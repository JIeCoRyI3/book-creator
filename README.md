# Book Builder (client + server)

## Server
- Path: `server`
- Create `.env` from `.env.example` and set `OPENAI_API_KEY`
- Install deps and run:
```bash
cd server
npm install
npm run dev
```
- Endpoints:
  - `POST /api/start` { tocText, promptTemplate } -> { jobId }
  - `GET /api/status/:jobId`
  - `GET /api/markdown/:jobId`
  - `GET /api/pdf/:jobId`

## Client
- Path: `client`
- Create `.env` from `.env.example` and set `VITE_SERVER_URL` if needed
- Install deps and run:
```bash
cd client
npm install
npm run dev
```

## Flow
1. Вставьте оглавление и шаблон промпта на клиенте
2. Нажмите "Запустить"
3. Следите за прогрессом и просматривайте Markdown
4. Когда статус готов — скачайте PDF