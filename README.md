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

## Root commands (одно действие для обоих)
- Установка зависимостей сразу для сервера и клиента:
```bash
cd /workspace
npm run install:all
```

- Одновременный запуск сервера и клиента (dev):
```bash
cd /workspace
npm run dev
```

## Требования к Node.js и переустановка
- Требуется Node.js 20.19+ или 22.12+ (рекомендуем v22.12.0).
- Если видите ошибки вида "Vite requires Node.js version 20.19+ or 22.12+" или проблемы с `@rollup/*` на Windows:
  1. Обновите Node.js до совместимой версии:
     - macOS/Linux (nvm):
       ```bash
       nvm install 22.12.0
       nvm use 22.12.0
       ```
     - Windows (nvm-windows): скачайте и установите через `https://github.com/coreybutler/nvm-windows` и затем:
       ```powershell
       nvm install 22.12.0
       nvm use 22.12.0
       ```
  2. Очистите установку зависимостей (особенно на Windows из-за optional deps rollup):
     ```bash
     rm -rf client/node_modules client/package-lock.json server/node_modules server/package-lock.json node_modules package-lock.json
     npm run install:all
     ```
  3. Запустите снова:
     ```bash
     npm run dev
     ```