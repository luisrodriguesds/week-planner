# GoGym Week Planner — Product Brief

**Tipo:** Inspeção de produto (validação antes de implementação)  
**Data:** 2026-09-21  
**Estado:** Validado — decisões de produto fechadas (2026-09-21)  
**Próximo passo:** Fases 5–6 (emails + deploy) — ver [`implementation-plan.md`](implementation-plan.md)

---

## 1. Resumo em uma frase

Uma **aplicação web privada** para dois utilizadores (tu + esposa) que permite **planear a semana de aulas do GoGym com antecedência**, **deixar o bot marcar automaticamente quando a janela abrir**, **ver o que está agendado**, **cancelar se não puderem ir**, e **receber emails** quando algo for marcado ou como resumo semanal.

---

## 2. O problema hoje

### Dor principal

As aulas mais procuradas (ex: **Go Cross 45**) abrem reserva **12 horas antes**. Isso significa acordar de madrugada (ex: **07:29** para aula das 19:30) ou estar alerta à noite — repetidamente, várias vezes por semana.

### Como a semana é vivida hoje

```
Domingo à noite     →  "Preciso ver que Cross abre amanhã às 7h29"
Segunda 07:29       →  Acordar / app GoGym / rezar por vaga
Durante a semana    →  Repetir para cada slot desejado
Imprevisto          →  Abrir app, cancelar manualmente (se lembrar)
Planeamento         →  Cabeça + alarmes + app GoGym misturados
```

A tua semana **gira em torno das janelas de inscrição**, não em torno das aulas em si. Queres inverter isso: **planear a semana uma vez** e confiar que o sistema trata do resto.

O problema deixa de ser só "conseguir vaga no segundo exacto" — passa a ser **escolher o slot certo com antecedência** (ex: Cross de quinta à noite, definido na segunda) e deixar o bot tratar da marcação quando a janela abrir.

### O que já sabemos (tecnicamente)

A API GoGym permite:

- Ler **semana completa** (Seg–Dom) com janelas de reserva (`mapa_aulas.php`) — **confirmado**
- Marcar automaticamente (`insert_marcacao.php`) — **confirmado**
- Listar reservas (`listar_reservas.php`)
- Cancelar (`desmarcar_aula.php`) — confirmado via reverse engineering, pendente teste live

Ver [`gogym-api.md`](gogym-api.md) para detalhes.

### API devolve a semana inteira (confirmado)

Teste live em 2026-09-21 (segunda-feira):

| Métrica | Valor |
|---------|-------|
| Total de aulas | 101 |
| Dias cobertos | 7 (Seg 21 → Dom 27 Set) |
| Go Cross 45 | 14 slots na semana |

**Exemplo do fluxo que queres:**

| Aula | Janela abre | Podes criar Plano em |
|------|-------------|-------------------|
| Go Cross Qui 24/09 19:25 | Qui 07:25 | Seg, Ter, Qua — dias antes |
| Go Cross Sex 25/09 07:15 | Qui 19:15 | Seg, Ter, Qua, Qui de manhã |

Na segunda-feira já vês todas as aulas até domingo, com `DataHoraInicioMarcacao` de cada uma — exactamente como na app GoGym.

---

## 3. Visão do produto

### Analogia

Pensa num **assistente pessoal de ginásio** — não um clone da app GoGym, mas uma camada por cima:

| App GoGym (hoje) | GoGym Week Planner (proposta) |
|------------------|-------------------------------|
| Reages quando a janela abre | Defines o que queres **antes** da janela abrir |
| Alarmes na cabeça | Bot acorda por ti |
| Uma conta, um telemóvel | Duas contas, um painel web em casa |
| Sem histórico de intenções | Vês o que **planeaste** vs o que **foi marcado** |
| Sem emails proactivos | Emails de confirmação + resumo semanal |

### Produtos / padrões semelhantes (referência)

Estes **não são concorrentes directos** (não integram GoGym), mas ilustram o **tipo de produto**:

| Produto / padrão | O que empresta ao nosso caso |
|------------------|------------------------------|
| **[Mindbody](https://www.mindbodyonline.com/)** (app de reservas de estúdios) | Calendário semanal, lista de aulas, reservas — mas manual |
| **[ClassPass](https://classpass.com/)** | Descoberta + booking de aulas numa semana — mas sem automação à abertura |
| **Bots de reserva de restaurantes** (ex: snipers para Resy/OpenTable) | Lógica de "disparar no segundo exacto" quando abre — **mesmo problema, outro domínio** |
| **[Cal.com](https://cal.com/)** / Google Calendar + lembretes | Planeamento semanal + notificações — mas sem acção automática externa |
| **Cron + script pessoal** (o que muita gente faz com CrossFit boxes pequenas) | Automação caseira — funciona, mas sem UI, sem multi-utilizador, sem emails bonitos |
| **IFTTT / Zapier** ("quando X, envia email") | Padrão de notificação — inspirar digest semanal e confirmações |

**Posicionamento:** Mindbody + sniper bot + digest semanal, **só para vocês dois**, **só GoGym Porto**.

---

## 4. Utilizadores e autenticação

### Papéis

| Papel | Quem | O que faz |
|-------|------|-----------|
| **Admin** | Luis (inicialmente) | Login admin; cria e gere utilizadores da app |
| **User** | Luis, esposa, … | Login próprio; configura conta GoGym; gere planos e reservas |

Não há registo público. Só o admin cria contas.

### Modelo de contas

Cada **user** da app tem duas camadas:

```
User (app)                    GoGym (API)
─────────────                 ───────────────
username + password    →      numcliente  (nº sócio — referência humana)
email                  →      idcliente   (ID interno — obrigatório para marcar)
```

O user **introduz o próprio** `numcliente` e `idcliente` nas definições de perfil. Sem isto, não pode criar planos — o bot não sabe em nome de quem marcar.

| Campo GoGym | Onde obter | Uso |
|-------------|------------|-----|
| **numcliente** | App GoGym / cartão / perfil | Display, validação opcional via `ler_cliente.php` |
| **idcliente** | Investigação / suporte / debug app | **Obrigatório** em `insert_marcacao.php`, `listar_reservas.php`, etc. |

Fluxo de onboarding de um user novo:

```
1. Admin cria user (nome, email, password)
2. User faz login pela primeira vez
3. User vai a "Conta GoGym" e preenche numcliente + idcliente
4. (Opcional) App valida com ler_cliente.php — confirma nome e que NaoMarcaAulas=0
5. User já pode criar planos e receber emails
```

### Requisitos de acesso

- **Privado** — sem exposição à internet; **só rede de casa** (LAN)
- **Logins separados** — cada user vê só os seus planos e reservas
- **Admin** — único que cria/remove users; não partilha sessão com users

---

## 5. Jobs to be done

Quando uso este produto, quero…

| # | Job | Sucesso = |
|---|-----|-----------|
| J1 | **Deixar de acordar às 7h29** | Aula marcada sem intervenção manual |
| J2 | **Planear a semana numa sentada** | Ver Seg–Dom e escolher aulas, mesmo antes da janela abrir |
| J3 | **Confiar que o bot trata do resto** | Estado claro: "pendente" → "marcado" ou "falhou" |
| J4 | **Saber o que tenho planeado** | Lista de planos + reservas confirmadas |
| J5 | **Cancelar se não puder ir** | Um clique no painel, sem abrir app GoGym |
| J6 | **Ser avisado por email** | Email quando marcar + email semanal com visão da semana |
| J7 | **A minha esposa ter o mesmo** | Mesmas funcionalidades, conta dela |

---

## 6. Conceitos do domínio

Linguagem consistente para UI e código:

| Termo | Significado |
|-------|-------------|
| **Aula** | Slot no horário GoGym (ex: Go Cross 45, Ter 19:30) |
| **Janela** | Período em que a reserva está aberta (`DataHoraInicioMarcacao` → `DataHoraFimMarcacao`) |
| **Plano** | Intenção: "quero esta aula" — criado **antes** da janela abrir |
| **Reserva** | Marcação confirmada no GoGym (`idMarcacao`) |
| **Bot** | Processo que executa planos quando a janela abre |
| **Digest semanal** | Email com visão da semana (planos + reservas + janelas relevantes) |
| **Admin** | Utilizador com permissão para criar outros users |
| **Conta GoGym** | Par `numcliente` + `idcliente` associado a um user |

### Ciclo de vida de um Plano

```
┌─────────────┐     janela abre      ┌─────────────┐
│   PLANNED   │ ──────────────────►  │  EXECUTING  │
│  (pendente) │                      │  (a marcar) │
└─────────────┘                      └──────┬──────┘
       │                                    │
       │ cancelaste                         ├── sucesso ──► BOOKED (reserva confirmada)
       │ antes da janela                    │
       ▼                                    ├── lotação esgotada ──► FAILED (esgotado)
┌─────────────┐                             │
│  CANCELLED  │                             └── erro API ──► FAILED (erro)
│ (desististe)│
└─────────────┘
```

---

## 7. Funcionalidades propostas

### Must have (v1)

| Feature | Descrição |
|---------|-----------|
| **Login admin + users** | Admin cria users; cada um faz login separado |
| **Perfil GoGym** | User configura `numcliente` + `idcliente` (obrigatório para planear) |
| **Calendário / lista semanal** | Ver aulas disponíveis na semana, filtradas por nome (Go Cross, etc.) |
| **Criar Plano** | "Quero ir a esta aula" — mesmo com janela ainda fechada |
| **Painel de planos activos** | Ver tudo o que está planeado, com estado |
| **Bot de execução** | No `DataHoraInicioMarcacao`, tentar `insert_marcacao.php` |
| **Sync de reservas** | Cruzar planos com `listar_reservas.php` para confirmar |
| **Cancelar Plano / Reserva** | Remover intenção ou cancelar via `desmarcar_aula.php` |
| **Email: marcação feita** | "✅ Go Cross 45 — Ter 19:30 — reservado" |
| **Email: digest semanal** | Resumo domingo 20h (configurável) |
| **Admin: CRUD users** | Criar, desactivar, reset password |
| **Rede local only** | App bind em LAN; sem acesso externo |

### Should have (v1.1)

| Feature | Descrição |
|---------|-----------|
| **Notificação de falha** | Email se bot não conseguir marcar |
| **Filtros guardados** | "Só Go Cross", "Só Estudio 4", etc. |
| **Histórico** | Planos passados e taxa de sucesso |
| **Sync relógio** | Usar `HoraAtualServidor` para precisão sub-segundo |

### Could have (futuro)

| Feature | Descrição |
|---------|-----------|
| Telegram / push | Alternativa ao email |
| App mobile | Provavelmente desnecessário se web for responsiva |
| Sugestões inteligentes | "Normalmente vais à Ter 19:30" |
| Multi-centro | Se algum dia mudarem de ginásio |

### Won't have (fora de scope)

| Feature | Porquê |
|---------|--------|
| App pública / SaaS | Só para vocês dois |
| Substituir app GoGym completamente | Só booking + planeamento |
| Pagamentos / mensalidades | GoGym trata disso |
| Android/iOS nativo | Web responsiva chega |

---

## 8. Fluxos principais

### Fluxo A — Setup inicial (admin + user)

```
1. Admin faz login
2. Admin cria user "Maria" (email + password)
3. Maria faz login (rede de casa)
4. Maria → Conta GoGym → numcliente + idcliente
5. Sistema valida (opcional) → pronta a planear
```

### Fluxo B — Planear a semana (Domingo à noite)

```
1. User abre web app (Wi‑Fi de casa)
2. Ver semana (Seg–Dom) com aulas GoGym
3. Para cada aula desejada → "Adicionar Plano"
4. Ver painel: "3 planos esta semana"
5. Fechar — não precisas pensar mais até receber emails
```

### Fluxo C — Bot marca sozinho (07:29 ou quando janela abrir)

```
1. Bot acorda no DataHoraInicioMarcacao (sync com servidor)
2. Busca dados frescos do slot (mapa_aulas.php)
3. POST insert_marcacao.php (idcliente do user dono do plano)
4. Se sucesso → Plano BOOKED + email ao user
5. Se falha → Plano FAILED + email (v1.1)
```

### Fluxo D — Imprevisto (não posso ir)

```
1. Abrir painel "Os meus Planos / Reservas"
2. Ver aula de Quarta 19:30 — estado BOOKED
3. Clicar "Cancelar"
4. Bot/API chama desmarcar_aula.php
5. Plano → CANCELLED, vaga libertada
```

### Fluxo E — Digest semanal (email)

```
1. Domingo 20:00 (configurável por user)
2. Email individual para cada user
3. Conteúdo:
   - Planos pendentes
   - Reservas confirmadas
   - Janelas que abrem esta semana ("Cross Ter abre Seg 07:30")
   - Link LAN para o painel (ex: http://192.168.x.x:3000)
```

---

## 9. Wireframes conceptuais (texto)

### Ecrã 1 — Semana (user)

```
┌──────────────────────────────────────────────────────────────┐
│  GoGym Planner · Luis                    Semana 38           │
├──────────────────────────────────────────────────────────────┤
│  Seg    Ter    Qua    Qui    Sex    Sáb    Dom               │
│  ─────────────────────────────────────────────────────────── │
│  07:15  19:30  19:35  19:25  07:15  —      —                │
│  Cross  Cross  Cross  Cross  Cross                          │
│  [+Plano][+Plano][✓]  [+Plano][+Plano]                       │
│         ↑ janela       ↑ já reservado                        │
│         abre Seg 07:30                                       │
├──────────────────────────────────────────────────────────────┤
│  Filtros: [Go Cross] [Todos]     Vagas: 3/16               │
└──────────────────────────────────────────────────────────────┘
```

### Ecrã 2 — Os meus Planos

```
┌──────────────────────────────────────────────────────────────┐
│  Os meus Planos                                              │
├──────────────────────────────────────────────────────────────┤
│  ⏳ PLANNED   Go Cross 45    Ter 19:30   abre Seg 07:30  [×]│
│  ✅ BOOKED    Go Cross 45    Qua 19:35   id #179112      [Cancelar]│
│  ❌ FAILED    Go Cross 45    Sex 07:15   esgotado        [×]│
└──────────────────────────────────────────────────────────────┘
```

### Ecrã 3 — Conta GoGym (user)

```
┌──────────────────────────────────────────────────────────────┐
│  Conta GoGym                                                 │
├──────────────────────────────────────────────────────────────┤
│  Nº cliente (numcliente):  [__________]                      │
│  ID interno (idcliente):   [__________]                      │
│                                                              │
│  [Validar]  → "Conta OK — Maria Silva, Porto"               │
│                                                              │
│  ⚠ Sem idcliente não podes criar planos.                     │
└──────────────────────────────────────────────────────────────┘
```

### Ecrã 4 — Admin: Utilizadores

```
┌──────────────────────────────────────────────────────────────┐
│  Admin · Utilizadores                    [+ Criar user]      │
├──────────────────────────────────────────────────────────────┤
│  Luis      luis@...     GoGym ✓   activo   [Editar]          │
│  Maria     maria@...    GoGym ✓   activo   [Editar]          │
└──────────────────────────────────────────────────────────────┘
```

### Ecrã 5 — Email de confirmação

```
Assunto: ✅ Reservado — Go Cross 45 (Ter 19:30)

Olá Luis,

O bot marcou a tua aula:
  Go Cross 45
  Terça, 23 Set, 19:30
  Estudio 4 · António Guimarães

Ver no painel: https://...

— GoGym Planner
```

---

## 10. Arquitectura proposta (alto nível)

```
┌─────────────┐   LAN only     ┌─────────────────────────────────┐
│  Web App    │ ◄────────────► │  Windows (sempre ligado)        │
│  (browser   │  192.168.x.x   │  Node/TS: API + Scheduler + Bot │
│   em casa)  │                │  bind: 0.0.0.0 ou IP local      │
└─────────────┘                └───────────────┬─────────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────┐
                    │                          │                  │
                    ▼                          ▼                  ▼
             ┌───────────┐            ┌─────────────┐    ┌─────────────┐
             │ SQLite    │            │ Task Sched. │    │ Email SMTP  │
             │ planos,   │            │ ou serviço  │    │ (individual)│
             │ users     │            │ Windows     │    └─────────────┘
             └───────────┘            └──────┬──────┘
                                              ▼
                                     ┌─────────────────┐
                                     │  GoGym API      │
                                     │  gogym.gomygym  │
                                     └─────────────────┘
```

### Componentes

| Componente | Responsabilidade |
|------------|------------------|
| **Web UI** | Semana, planos, perfil GoGym, admin users |
| **API** | CRUD planos, auth admin/user, proxy GoGym |
| **Scheduler** | Acordar nos horários certos, executar bot |
| **DB** | Users, roles, gogym credentials, planos, logs |
| **Email worker** | Confirmações + digest semanal |

---

## 11. Riscos e limitações técnicas

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Semana vira à meia-noite / muda de semana** | Planos de domingo podem precisar refresh | Re-fetch `mapa_aulas.php` periodicamente; refresh manual no painel |
| **User sem idcliente** | Não pode planear | Bloquear UI até perfil GoGym completo |
| **Acesso só LAN** | Fora de casa não funciona | Comportamento intencional; emails compensam |
| **Cancelamento ainda não testado live** | Cancelar pelo painel pode falhar | Testar `desmarcar_aula.php` antes de v1 |
| **Sem auth na API GoGym** | Qualquer um com `idcliente` pode marcar | Guardar credenciais só no servidor; auth na web app |
| **Lotação esgotada em ms** | Bot pode falhar mesmo "no segundo" | Retry limitado; email de falha; expectativa realista |
| **GoGym muda API** | Bot parte | Logs + alertas; documentação actualizada |
| **Dois `idcliente`** | Configuração dupla | Modelo User → GoGymAccount |

---

## 12. Decisões fechadas

| # | Decisão | Escolha |
|---|---------|---------|
| **D1** | Acesso | **Logins separados** — tu e esposa, contas GoGym independentes; horários diferentes (mais cedo / mais tarde) |
| **D2** | Digest semanal | **Domingo 20:00** por defeito, **configurável** por utilizador |
| **D3** | Onde corre o bot | **Windows em casa**, sempre ligado (zero custo cloud) |
| **D4** | Aulas no v1 | **Qualquer aula** — filtros na UI; Go Cross como atalho, não limite |
| **D5** | Email | **Individual** — cada um recebe confirmações e digest no seu email |
| **D6** | Terminologia | **Plano** (não "Set") |
| **D7** | Rede | **Só em casa** — LAN; sem tunnel, sem exposição à internet |
| **D8** | Auth | **Admin** cria users; cada user configura **numcliente + idcliente** |

### Implicações de produto

**Admin + users:** o primeiro login é admin (seed na instalação). Admin cria a conta da esposa. Não há auto-registo.

**Conta GoGym por user:** marcar adiantado só funciona depois de associar `idcliente`. O `numcliente` ajuda a identificar a conta correcta e validar via API.

**Logins separados:** cada user vê só os seus planos. Sessões isoladas na mesma instância Windows.

**Qualquer aula:** planear na segunda o Cross de quinta (ou qualquer slot) e esquecer até receber email.

**Windows + LAN:** serviço Windows sempre ligado; web app em `http://IP-local:porta` — telemóvel/tablet em casa usa o mesmo Wi‑Fi.

**Digest configurável:** settings por user — dia da semana, hora, activo/inactivo.

---

## 13. Critérios de sucesso (v1)

Sabemos que v1 funciona quando:

- [ ] Admin cria user esposa; ela configura idcliente
- [ ] Luis cria 3 planos num domingo à noite sem abrir app GoGym
- [ ] Bot marca pelo menos 1 aula automaticamente à abertura da janela
- [ ] Reserva aparece na app GoGym oficial
- [ ] Email de confirmação chega em < 2 min
- [ ] Esposa tem conta separada funcional
- [ ] Cancelamento pelo painel remove reserva na app GoGym
- [ ] Digest semanal lista planos + reservas da semana
- [ ] App inacessível fora da rede de casa (by design)
- [ ] **Zero alarmes manuais** durante 2 semanas de teste

---

## 14. Roadmap sugerido

| Fase | Entrega | Duração estimada |
|------|---------|------------------|
| **0** | Validar este brief + decisões D1–D8 | ✅ |
| **1** | Bot CLI (sem UI): plano → execute → email | 2–3 dias |
| **2** | DB + API + auth admin/user | 2–3 dias |
| **3** | Web UI semana + planos + perfil GoGym | 3–4 dias |
| **4** | Cancelamento + digest semanal | 1–2 dias |
| **5** | Admin CRUD users + polish | 1–2 dias |
| **6** | Deploy + 2 semanas dogfooding | contínuo |

**Total v1:** ~2 semanas part-time

---

## 15. Nome do produto (working titles)

| Nome | Vibe |
|------|------|
| **GoGym Week Planner** | Descritivo, claro |
| **PlanoGo** | Curto; "plano" + "go" |
| **CrossBot** | Específico CrossFit — limitante |
| **GymWake** | Foca no problema do alarme |

Sugestão: **GoGym Week Planner** internamente; nome bonito depois.

---

## 16. Validação — checklist

| Pergunta | Estado |
|----------|--------|
| API devolve semana Seg–Dom? | ✅ Confirmado |
| Logins separados (tu + esposa)? | ✅ Confirmado |
| Qualquer aula, não só Go Cross? | ✅ Confirmado |
| Digest domingo 20h, configurável? | ✅ Confirmado |
| Bot no Windows de casa? | ✅ Confirmado |
| Email individual (confirmação + digest)? | ✅ Confirmado |
| Termo "Plano"? | ✅ Confirmado |
| Acesso só em casa (LAN)? | ✅ Confirmado |
| Admin cria users? | ✅ Confirmado |
| User configura numcliente + idcliente? | ✅ Confirmado |

---

## 17. Próximos passos

1. ~~Validar brief~~ ✅
2. ~~Spec técnica~~ ✅ → [`tech-spec.md`](tech-spec.md)
3. Implementation plan + código por fases

---

*Documento gerado a partir da investigação API ([`gogym-api.md`](gogym-api.md)) e requisitos de produto discutidos em 2026-09-21.*
