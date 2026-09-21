# GoGym Planner — Specs & implementation

Documentação de produto, arquitectura e plano de execução num só sítio.

## Documentos

| Ficheiro | Conteúdo |
|----------|----------|
| [product-brief.md](./product-brief.md) | Visão de produto, fluxos, decisões de UX |
| [tech-spec.md](./tech-spec.md) | Arquitectura, API, DB, bot, deploy |
| [implementation-plan.md](./implementation-plan.md) | Tarefas fase-a-fase para agentes/dev |
| [gogym-api.md](./gogym-api.md) | API GoGym — endpoints, payload, janelas |

Arquivo histórico: [gogym-bot-investigation-handoff.md](../archive/gogym-bot-investigation-handoff.md)

## Estado da implementação (2026-09-21)

| Fase | Descrição | Estado |
|------|-----------|--------|
| 1 | GoGym client + scaffold | ✅ |
| 2 | DB + auth + plans API | ✅ |
| 3 | Bot scheduler | ✅ |
| 4 | Web UI + admin | ✅ |
| 5 | Email + digest | ⏸ Pendente |
| 6 | Deploy + docs | 🔄 Em curso |

### Fase 5 — para retomar noutro chat

1. Ler **Task 21–23** em [implementation-plan.md](./implementation-plan.md#phase-5--email--digest)
2. Configurar SMTP no `.env` (ver [.env.example](../../.env.example))
3. Implementar `src/email/*` e ligar em `execute-plan.ts` + `scheduler.ts`

### Fase 6 — deploy

- [docs/windows-setup.md](../windows-setup.md) — instalação Windows LAN
- [.env.example](../../.env.example) — variáveis documentadas
- `src/server/config.ts` — validação Zod no arranque

## Comandos úteis

```bash
npm run dev          # API :3847 + Vite :5173
npm run build        # produção
npm test
npm run db:migrate
npm run seed:admin -- --username admin --email you@example.com --password changeme
```
