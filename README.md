# GoGym Planner

App web privada (LAN) para planear aulas GoGym, agendar automaticamente quando a janela abre, e gerir planos por utilizador.

## Quick start

```bash
cp .env.example .env   # editar GOGYM_CLIENT_ID se necessário
npm install
npm run db:migrate
npm run seed:admin -- --username admin --email you@example.com --password changeme
npm run dev
```

- Dev UI: http://localhost:5173
- API: http://localhost:3847

## Documentação

| Doc | Descrição |
|-----|-----------|
| [docs/spec/](./docs/spec/) | Product brief, tech spec, implementation plan, API GoGym |
| [docs/windows-setup.md](./docs/windows-setup.md) | Deploy Windows LAN |
| [docs/archive/](./docs/archive/) | Investigação inicial (histórico) |
| [.env.example](./.env.example) | Variáveis de ambiente |

## Scripts

| Comando | Uso |
|---------|-----|
| `npm run dev` | API + Vite (desenvolvimento) |
| `npm run build` | Build produção |
| `npm test` | Testes |
| `npm run bot:execute -- --plan-id N` | Executar plano manualmente (debug) |
