# GoGym Planner — Windows setup (LAN)

Guia para correr o planner num PC Windows em casa, acessível só na rede local.

## Pré-requisitos

- **Node.js 22 LTS** — [nodejs.org](https://nodejs.org/)
- Git (opcional, para `git pull`)
- Porta **3847** aberta **apenas na subnet privada** (não fazer port forward no router)

## 1. Instalar o projecto

```powershell
cd C:\gogym-bot
npm ci
copy .env.example .env
notepad .env
```

Editar `.env`:

- `GOGYM_CLIENT_ID` — só para o seed do admin (depois cada user configura em **Conta**)
- `SESSION_SECRET` — gerar 32+ caracteres aleatórios em produção
- `APP_BASE_URL` — `http://<IP-DO-PC>:3847` (para emails na Fase 5)

## 2. Base de dados e admin

```powershell
npm run db:migrate
npm run seed:admin -- --username admin --email tu@example.com --password <password>
```

## 3. Build e teste manual

```powershell
npm run build
node dist/server/index.js
```

No browser (mesma rede Wi‑Fi): `http://<IP-DO-PC>:3847`

Descobrir IP: `ipconfig` → IPv4 da interface Wi‑Fi/Ethernet.

## 4. Firewall Windows

Regra inbound **só para rede privada**:

1. Windows Defender Firewall → Advanced settings
2. Inbound Rules → New Rule → Port → TCP **3847**
3. Profile: **Private** only (não Public)
4. Allow the connection

Confirmar que o telemóvel **fora do Wi‑Fi** não acede à app.

## 5. WSL2 no Windows 10 (este PC)

O WSL2 usa NAT: telemóveis na Wi‑Fi não chegam ao IP `172.x` do Ubuntu. Encaminha a porta do Windows para o WSL.

1. App em produção no Ubuntu (`pm2` em `dist/server/index.js`, `HOST=0.0.0.0`).
2. PowerShell **como Administrador** (depois de cada `wsl --shutdown`):

```powershell
cd \\wsl$\Ubuntu\home\luis\personal\week-planner
powershell -ExecutionPolicy Bypass -File .\scripts\expose-wsl-lan.ps1
```

3. A rede Wi‑Fi tem de estar classificada como **Privada** (o Windows põe muitas redes como Pública, e a regra de firewall só cobre o perfil privado):

```powershell
Get-NetConnectionProfile
Set-NetConnectionProfile -InterfaceAlias 'Wi-Fi' -NetworkCategory Private
```

4. Na LAN: `http://192.168.1.209:3847` (IPv4 da Wi‑Fi; confirma com `ipconfig`).

Não faças port forward no router. Se o NordVPN estiver ligado, activa “Allow local network discovery” (senão a LAN fica bloqueada).

## 6. Serviço Windows (NSSM)

Instalar [NSSM](https://nssm.cc/) e registar o serviço:

```powershell
nssm install GoGymPlanner "C:\Program Files\nodejs\node.exe"
nssm set GoGymPlanner AppDirectory C:\gogym-bot
nssm set GoGymPlanner AppParameters dist\server\index.js
nssm set GoGymPlanner AppEnvironmentExtra NODE_ENV=production
nssm start GoGymPlanner
```

Alternativa: **pm2-windows-service**.

## 7. Segundo utilizador (ex.: esposa)

1. Login como **admin**
2. **Admin** → criar user (email + password)
3. A pessoa faz login na rede de casa
4. **Conta** → `numcliente` + `idcliente` GoGym → validar

## 8. Updates

```powershell
cd C:\gogym-bot
git pull
npm ci
npm run build
npm run db:migrate
nssm restart GoGymPlanner
```

## 9. Desenvolvimento (Mac/Linux)

```bash
npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:3847

Em produção Windows, Vite não corre — o Fastify serve `dist/client/` estático.

## Referências

- Spec completa: [docs/spec/tech-spec.md](./spec/tech-spec.md) §14
- Variáveis de ambiente: [.env.example](../.env.example)
