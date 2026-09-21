# GoGym API — Documentação

Documentação consolidada da API HTTP usada pela app GoGym (Flutter), reverse-engineered e validada em testes controlados.

**Estado:** leitura + reserva + listagem confirmados. Cancelamento confirmado via Blutter, ainda não testado live.

**Última validação:** 2026-09-21 — reserva Zumba 45 (`idMarcacao=179112`) visível na app.

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Identificação do cliente](#identificação-do-cliente)
3. [Formato HTTP comum](#formato-http-comum)
4. [Endpoints confirmados](#endpoints-confirmados)
   - [Centros](#1-centros)
   - [Horário de aulas](#2-horário-de-aulas)
   - [Detalhes de uma aula](#3-detalhes-de-uma-aula)
   - [Dados do cliente](#4-dados-do-cliente)
   - [Listar reservas](#5-listar-reservas)
   - [Criar reserva](#6-criar-reserva)
   - [Cancelar reserva](#7-cancelar-reserva)
5. [Modelo de dados: aula agendada](#modelo-de-dados-aula-agendada)
6. [Janela de reserva](#janela-de-reserva)
7. [Fluxo de reserva recomendado](#fluxo-de-reserva-recomendado)
8. [Erros conhecidos](#erros-conhecidos)
9. [Identificadores de aulas alvo](#identificadores-de-aulas-alvo)
10. [Endpoints descobertos (não testados)](#endpoints-descobertos-não-testados)
11. [Notas de reverse engineering](#notas-de-reverse-engineering)
12. [Ferramentas locais](#ferramentas-locais)

---

## Visão geral

| Item | Valor |
|------|-------|
| Subdomínio (Porto / HSJ) | `gogym` |
| Base URL | `https://gogym.gomygym.com` |
| Padrão de URL | `https://{subdominio}.gomygym.com/app/php/{endpoint}.php` |
| Centro alvo (Porto) | `centrolocal=1` |
| Fuso horário | `Europe/Lisbon` (`NomeFuso` nas respostas) |
| Autenticação observada | Nenhuma (sem Bearer, sem cookies) nos endpoints testados |
| Content-Type | `application/x-www-form-urlencoded` |

A app Flutter constrói URLs com o subdomínio guardado em SharedPreferences (`spSubdominio`). Para o ginásio alvo, o subdomínio é `gogym`.

### SharedPreferences relevantes (app)

| Chave | Descrição |
|-------|-----------|
| `spSubdominio` | Subdomínio do ginásio (ex: `gogym`) |
| `spIdCliente` | ID interno do cliente (`idcliente` na API) |
| `spNumCliente` | Número de sócio visível ao utilizador |
| `spCentroLocal` | Centro local preferido |
| `spDeviceId` | ID do dispositivo |
| `spNaoMarcaAulas` | Flag que bloqueia marcações (`0` = pode marcar) |

---

## Identificação do cliente

Existem **dois identificadores distintos**:

| Campo | Descrição |
|-------|-----------|
| `numcliente` | Número de sócio (visível na app) |
| `idcliente` | ID interno na base de dados — **obrigatório na API** |

Usar o número de sócio em vez do ID interno devolve erro:

```json
{
  "status": "erro",
  "mensagem": "Id cliente em falta"
}
```

### Configuração local (`.env`)

```env
GOGYM_BASE_URL=https://gogym.gomygym.com
GOGYM_CLIENT_ID=          # idcliente interno — NÃO commitar
GOGYM_CENTER_ID=1         # Porto
GOGYM_TIMEZONE=Europe/Lisbon
```

**Nunca commitar** o `GOGYM_CLIENT_ID` nem expor PII devolvida por `ler_cliente.php`.

---

## Formato HTTP comum

Todos os endpoints testados usam:

```http
POST /app/php/{endpoint}.php
Content-Type: application/x-www-form-urlencoded
```

Exceção: `obter_detalhes_aula.php` e `obter_centros.php` também funcionam via GET.

Respostas em JSON. Endpoints de mutação (`insert_marcacao.php`, `desmarcar_aula.php`) usam o envelope:

```json
{
  "sucesso": true,
  "mensagem": "...",
  "tipo": "sucesso",
  "idMarcacao": 179112
}
```

---

## Endpoints confirmados

### 1. Centros

Lista ginásios disponíveis.

```http
GET /app/php/obter_centros.php
```

**Resposta confirmada:**

```json
{
  "status": "ok",
  "centros": [
    { "centro": "1", "designacao": "Porto" },
    { "centro": "2", "designacao": "Valongo" },
    { "centro": "3", "designacao": "Vila Real" },
    { "centro": "4", "designacao": "Coimbra" },
    { "centro": "5", "designacao": "Maia" },
    { "centro": "6", "designacao": "Lamego" },
    { "centro": "7", "designacao": "Chaves" }
  ]
}
```

---

### 2. Horário de aulas

Devolve o **horário da semana corrente** (Seg–Dom) para um centro.

**Confirmado (2026-09-21):** uma chamada devolve 7 dias de aulas (ex: 101 slots de 2026-09-21 a 2026-09-27), alinhado com a app móvel. Cada slot inclui `DataHoraInicioMarcacao` / `DataHoraFimMarcacao` — permite planear sets dias antes da janela abrir.

```http
POST /app/php/mapa_aulas.php
Content-Type: application/x-www-form-urlencoded

centrolocal=1
```

> **Nota:** o campo no request é `centrolocal` (lowercase). Na resposta aparece `CentroLocal` (PascalCase).

**Exemplo:**

```bash
curl -s -X POST \
  'https://gogym.gomygym.com/app/php/mapa_aulas.php' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'centrolocal=1'
```

**Resposta:** array JSON de aulas. Cada elemento inclui horários, lotação, janela de reserva e preços. Ver [Modelo de dados](#modelo-de-dados-aula-agendada).

**Campos críticos para booking:**

| Campo na resposta | Uso |
|-------------------|-----|
| `IDgrelha` | Identificador único do slot agendado → `idgrelha` no POST |
| `DataHoraAula` | Data/hora da aula → `dataHoraAula` |
| `DataHoraInicioMarcacao` | Abertura da janela → `inicioMarcacao` |
| `DataHoraFimMarcacao` | Fecho da janela → `fimMarcacao` |
| `LotacaoReservaWeb` | Lotação web → `lotacaoReservaWeb` |
| `CentroLocal` | Centro → `centroLocal` |
| `NomeFuso` | Fuso → `fusoHorario` (**string**, ex: `Europe/Lisbon`) |
| `ValorA`, `ValorB`, `ValorC` | Preços → `valorA`, `valorB`, `valorC` |
| `ValorBNumAlunos`, `ValorCNumAlunos` | Escalões → `valorBNumAlunos`, `valorCNumAlunos` |
| `HoraAtualServidor` | Relógio do servidor (sync) |
| `TotalMarcacoes` | Marcações actuais (calcular vagas) |

**Não usar no POST de reserva:** `IDaula` (tipo de aula, não o slot).

---

### 3. Detalhes de uma aula

Ocupação actual de um slot específico.

```http
GET /app/php/obter_detalhes_aula.php?idgrelha={IDgrelha}
```

**Exemplo:**

```bash
curl -s 'https://gogym.gomygym.com/app/php/obter_detalhes_aula.php?idgrelha=91901'
```

**Resposta confirmada:**

```json
{
  "IDgrelha": 91901,
  "Lotacao": 16,
  "LotacaoReservaWeb": 16,
  "TotalMarcacoes": 13
}
```

Útil para polling de ocupação, mas **evitar** no instante exacto de abertura de reservas (latência extra).

---

### 4. Dados do cliente

Valida conta e lê settings.

```http
POST /app/php/ler_cliente.php
Content-Type: application/x-www-form-urlencoded

idcliente={ID interno}
```

**Resposta (campos relevantes):**

```json
{
  "status": "ok",
  "numcliente": "...",
  "nome": "...",
  "email": "...",
  "centrolocal": 1,
  "inativo": 0,
  "settingsJSON": "{\"AppAtiva\":1,\"NaoMarcaAulas\":0,...}"
}
```

| Campo | Significado |
|-------|-------------|
| `inativo` | `0` = conta activa |
| `settingsJSON.NaoMarcaAulas` | `0` = pode marcar aulas |

Não logar PII deste endpoint.

---

### 5. Listar reservas

```http
POST /app/php/listar_reservas.php
Content-Type: application/x-www-form-urlencoded

idcliente={ID interno}
```

**Resposta confirmada:**

```json
[
  {
    "ID": 178391,
    "NomeAula": "Go Cross 45",
    "DataHoraAula": "2026-09-21 20:20:00.000"
  },
  {
    "ID": 179112,
    "NomeAula": "Zumba 45",
    "DataHoraAula": "2026-09-21 21:15:00.000"
  }
]
```

| Campo | Significado |
|-------|-------------|
| `ID` | ID da marcação (`idMarcacao`) — usar em `desmarcar_aula.php` |
| `NomeAula` | Nome da aula |
| `DataHoraAula` | Data/hora (com microsegundos `.000`) |

---

### 6. Criar reserva

**Confirmado via Blutter + teste live (2026-09-21).**

```http
POST /app/php/insert_marcacao.php
Content-Type: application/x-www-form-urlencoded
```

#### Payload exacto

| Campo | Tipo | Origem | Exemplo |
|-------|------|--------|---------|
| `idcliente` | int | `.env` / `spIdCliente` | `12345` |
| `idgrelha` | int | `mapa_aulas.php` → `IDgrelha` | `11701` |
| `dataHoraAula` | string | `DataHoraAula` | `2026-09-21 21:15:00` |
| `centroLocal` | int | `CentroLocal` | `1` |
| `inicioMarcacao` | string | `DataHoraInicioMarcacao` | `2026-09-21 09:15:00` |
| `fimMarcacao` | string | `DataHoraFimMarcacao` | `2026-09-21 21:00:00` |
| `lotacaoReservaWeb` | int | `LotacaoReservaWeb` | `25` |
| `fusoHorario` | string | `NomeFuso` | `Europe/Lisbon` |
| `valorA` | string | `ValorA` | `13.65` |
| `valorB` | string | `ValorB` | `16.00` |
| `valorC` | string | `ValorC` ou `0` se null | `0` |
| `valorBNumAlunos` | int | `ValorBNumAlunos` | `16` |
| `valorCNumAlunos` | int | `ValorCNumAlunos` ou `0` se null | `0` |

#### Regras importantes

1. **`idgrelha` em lowercase** — `IDgrelha` ou `IDaula` no POST falham com `"Parâmetros em falta."`
2. **`fusoHorario` é o nome IANA** (`Europe/Lisbon`), **não** o `IDfuso` numérico (`2`)
3. **Datas sem microsegundos** no POST — truncar `2026-09-21 09:15:00.000000` → `2026-09-21 09:15:00`
4. **`ValorC` / `ValorCNumAlunos` null** → enviar `0` (a app converte null para `0.0` antes do `toString`)
5. **`deviceId` não é necessário** — confirmado via Blutter e testes
6. **`IDaula` não faz parte do payload**

#### Exemplo curl (testado com sucesso)

```bash
curl -s -X POST \
  'https://gogym.gomygym.com/app/php/insert_marcacao.php' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'idcliente=...' \
  --data-urlencode 'idgrelha=11701' \
  --data-urlencode 'dataHoraAula=2026-09-21 21:15:00' \
  --data-urlencode 'centroLocal=1' \
  --data-urlencode 'inicioMarcacao=2026-09-21 09:15:00' \
  --data-urlencode 'fimMarcacao=2026-09-21 21:00:00' \
  --data-urlencode 'lotacaoReservaWeb=25' \
  --data-urlencode 'fusoHorario=Europe/Lisbon' \
  --data-urlencode 'valorA=13.65' \
  --data-urlencode 'valorB=16.00' \
  --data-urlencode 'valorC=0' \
  --data-urlencode 'valorBNumAlunos=16' \
  --data-urlencode 'valorCNumAlunos=0'
```

#### Resposta de sucesso

```json
{
  "sucesso": true,
  "mensagem": "Reserva efetuada com sucesso.",
  "tipo": "sucesso",
  "idMarcacao": 179112
}
```

O `idMarcacao` devolvido corresponde ao `ID` em `listar_reservas.php`.

#### Mapeamento automático

Todos os campos do POST (excepto `idcliente`) podem ser obtidos directamente de `mapa_aulas.php` filtrando por `IDgrelha`. O script `test-book.sh` faz isto automaticamente.

---

### 7. Cancelar reserva

**Confirmado via Blutter.** Payload validado no código da app; cancelamento live ainda não testado neste projecto.

```http
POST /app/php/desmarcar_aula.php
Content-Type: application/x-www-form-urlencoded

id={ID da reserva}
```

| Campo | Origem |
|-------|--------|
| `id` | `ID` de `listar_reservas.php` (não `IDgrelha`, não `idMarcacao` como nome de campo) |

**Exemplo:**

```bash
curl -s -X POST \
  'https://gogym.gomygym.com/app/php/desmarcar_aula.php' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'id=179112'
```

Mensagem de erro na app: `"Falha ao desmarcar reserva"`.

---

## Modelo de dados: aula agendada

Exemplo real (Zumba 45, Porto, 2026-09-21):

```json
{
  "IDgrelha": 11701,
  "IDaula": 401,
  "NomeAula": "Zumba 45",
  "NomeProfessor": "Marta Silva",
  "NomeLocal": "Estudio 1",

  "Lotacao": 25,
  "LotacaoReservaWeb": 25,
  "TotalMarcacoes": 15,

  "TempoReservaInicioWeb": 720,
  "TempoReservaFimWeb": 15,

  "DataHoraAula": "2026-09-21 21:15:00",
  "DataHoraInicioMarcacao": "2026-09-21 09:15:00",
  "DataHoraFimMarcacao": "2026-09-21 21:00:00",
  "HoraAtualServidor": "2026-09-21 15:18:10",

  "CentroLocal": 1,
  "IDfuso": 2,
  "NomeFuso": "Europe/Lisbon",

  "ValorA": "13.65",
  "ValorB": "16.00",
  "ValorBNumAlunos": 16,
  "ValorC": null,
  "ValorCNumAlunos": null
}
```

### Interface TypeScript (referência)

```typescript
interface GoGymClass {
  ID: number;
  IDgrelha: number;
  IDaula: number;
  IDmodelo: number;
  IDlocal: number;
  IDprofessor: number;

  DiaSemana: number;
  NomeAula: string;
  NomeProfessor: string;
  NomeLocal: string;
  Duracao: number;

  Lotacao: number;
  LotacaoReservaWeb: number;
  TotalMarcacoes: number;
  MarcacoesApp: number;
  MarcacoesSemFixas: number;

  TempoReservaInicioWeb: number;  // minutos (720 = 12h)
  TempoReservaFimWeb: number;     // minutos antes da aula (15)

  DataHoraAula: string;
  DataHoraInicioMarcacao: string;
  DataHoraFimMarcacao: string;
  HoraAtualServidor: string;

  CentroLocal: number;
  IDfuso: number;
  NomeFuso: string;

  ValorA: string | null;
  ValorB: string | null;
  ValorC: string | null;
  ValorBNumAlunos: number | null;
  ValorCNumAlunos: number | null;
}
```

---

## Janela de reserva

| Campo | Valor típico | Significado |
|-------|--------------|-------------|
| `TempoReservaInicioWeb` | `720` | Abre 12 horas antes (720 min) |
| `TempoReservaFimWeb` | `15` | Fecha 15 min antes da aula |

**Usar sempre** `DataHoraInicioMarcacao` e `DataHoraFimMarcacao` devolvidos pelo servidor — não calcular localmente a janela de 12h.

**Sync de relógio:** comparar `HoraAtualServidor` com o relógio local para compensar drift antes de disparar reservas automáticas.

### Estados da janela

```
now < DataHoraInicioMarcacao  →  FUTURE (ainda não abriu)
DataHoraInicioMarcacao ≤ now ≤ DataHoraFimMarcacao  →  OPEN
now > DataHoraFimMarcacao  →  CLOSED
```

Vagas disponíveis: `LotacaoReservaWeb - TotalMarcacoes`

---

## Fluxo de reserva recomendado

```
1. POST mapa_aulas.php (centrolocal=1)
      ↓
2. Filtrar aula alvo (ex: NomeAula = "Go Cross 45")
      ↓
3. Guardar IDgrelha + todos os campos do slot
      ↓
4. Aguardar DataHoraInicioMarcacao (usar HoraAtualServidor para sync)
      ↓
5. POST insert_marcacao.php com payload completo
      ↓
6. Verificar sucesso + idMarcacao
      ↓
7. POST listar_reservas.php para confirmar
```

### Pré-checks úteis

- `ler_cliente.php` — confirmar `NaoMarcaAulas=0` e `inativo=0`
- `listar_reservas.php` — evitar duplicados antes de marcar

---

## Erros conhecidos

### `insert_marcacao.php`

| Mensagem | Causa provável |
|----------|----------------|
| `"Parâmetros em falta."` | Payload incompleto, nomes de campos errados (`IDgrelha`, falta `fusoHorario`, etc.) |
| `"Erro ao efetuar a marcação. Tenta novamente."` | Payload estruturalmente correcto mas valor inválido (ex: `fusoHorario=2` em vez de `Europe/Lisbon`) |
| `"Reserva efetuada com sucesso."` | Sucesso |

### `ler_cliente.php`

| Mensagem | Causa |
|----------|-------|
| `"Id cliente em falta"` | Enviado `numcliente` em vez de `idcliente` |

### Resposta genérica de mutação

```json
{
  "sucesso": false,
  "mensagem": "...",
  "tipo": "erro"
}
```

---

## Identificadores de aulas alvo

### Go Cross 45

| Campo | Valor |
|-------|-------|
| `NomeAula` | `"Go Cross 45"` |
| `IDaula` | `3701` (tipo — **não** usar no POST) |
| `IDgrelha` | **Varia por slot** — obter sempre de `mapa_aulas.php` |

Exemplos de `IDgrelha` observados:

| Data/hora | IDgrelha |
|-----------|----------|
| 2026-09-21 20:20 | 91901 |
| 2026-09-22 19:30 | 92001 |
| 2026-09-23 19:35 | 23601 |
| 2026-09-23 20:30 | 92501 |
| 2026-09-24 19:25 | 8201 |
| 2026-09-25 07:15 | 9001 |

**Nunca hardcodar `IDgrelha`.**

---

## Endpoints descobertos (não testados)

Encontrados no binário Flutter (`libapp.so` via Blutter). Evitar chamadas com efeitos secundários até serem necessários.

| Endpoint | Provável uso |
|----------|--------------|
| `registo_verificar_condicoes.php` | Registo |
| `registo_inserir.php` | Registo |
| `registo_reinstalacao.php` | Reinstalação |
| `registo_substituir.php` | Substituir dispositivo |
| `verificar_dispositivo_ativo.php` | Validação de dispositivo |
| `atualizar_device_id.php` | Actualizar device ID |
| `atualizar_device_versao.php` | Versão da app |
| `atualizar_token.php` | Push notifications (FCM) |
| `listar_settings_cliente.php` | Settings do cliente |
| `atualizar_setting_cliente.php` | Actualizar settings |
| `listar_notificacoes.php` | Notificações |
| `marcar_notificacoes_lidas.php` | Marcar lidas |
| `insert_notificacao_lembrete_aula.php` | Lembrete de aula |
| `get_frequencia_dashboard.php` | Dashboard frequência |
| `get_ocupacao_dashboard.php` | Dashboard ocupação |
| `get_planos.php` | Planos de treino |
| `eliminar_conta_app.php` | Eliminar conta |

---

## Notas de reverse engineering

### App

| Item | Valor |
|------|-------|
| Package Android | `com.proinf.gogym` |
| Framework | Flutter (Dart AOT) |
| Dart version | 3.9.2 |
| Binário | `lib/arm64-v8a/libapp.so` |
| Debuggable | Não — impede Network Inspector e `run-as` |

### Porque Proxyman não funcionou

A app Flutter ignora o proxy HTTP do Android. O tráfego não aparece no Proxyman mesmo com HTTPS decrypt activo.

### Blutter

Ferramenta usada para extrair a lógica Dart do AOT:

```bash
tools/blutter-venv/bin/python tools/blutter/blutter.py \
  /tmp/gogym-arm64/lib/arm64-v8a \
  tools/blutter-out
```

Ficheiros de referência:

| Ficheiro | Conteúdo |
|----------|----------|
| `tools/blutter-out/asm/gogym/api/marcar_aula.dart` | Payload `insert_marcacao.php` |
| `tools/blutter-out/asm/gogym/api/desmarcar_aula.dart` | Payload `desmarcar_aula.php` |
| `tools/blutter-out/asm/gogym/api/aula_model.dart` | Modelo `AulaModel.fromJson` |
| `tools/blutter-out/asm/gogym/api/carregar_aulas.dart` | Chamada `mapa_aulas.php` |
| `tools/blutter-out/asm/gogym/screens/confirmar_reserva_screen.dart` | Fluxo `_tentarMarcarAula` |

### Formato de datas na app

A função `_formataDataHora` formata DateTime como:

```
YYYY-MM-DD HH:MM:SS
```

Sem microsegundos, com zero-padding em mês/dia/hora/minuto/segundo.

---

## Ferramentas locais

### `test-book.sh`

Script bash para testes controlados. Lê `.env` automaticamente.

```bash
# Listar aulas
./test-book.sh classes [--open] [--min-avail N] [--name FILTER]

# Ver reservas actuais
./test-book.sh reservations

# Reservar (payload completo via Blutter, dados de mapa_aulas.php)
./test-book.sh book --idgrelha 11701
./test-book.sh book --idgrelha 11701 --dry-run

# Cancelar
./test-book.sh cancel --id 179112
./test-book.sh cancel --id 179112 --dry-run
```

### Documentação relacionada

| Ficheiro | Conteúdo |
|----------|----------|
| [`../archive/gogym-bot-investigation-handoff.md`](../archive/gogym-bot-investigation-handoff.md) | Handoff completo da investigação (inclui contexto de RE, arquitectura proposta) |
| `gogym-api.md` | Este documento — referência da API |
| [`../../.env.example`](../../.env.example) | Template de configuração |

---

## Histórico de validação

| Data | Acção | Resultado |
|------|-------|-----------|
| 2026-09-21 | Payload parcial (`IDgrelha`, `IDaula`) | `"Parâmetros em falta."` |
| 2026-09-21 | Payload Blutter com `fusoHorario=2` | `"Erro ao efetuar a marcação."` |
| 2026-09-21 | Payload correcto (`fusoHorario=Europe/Lisbon`, `valorC=0`) | **Sucesso** — Zumba 45, `idMarcacao=179112` |
| 2026-09-21 | Verificação na app móvel | Reserva visível em "As Minhas Reservas" |
