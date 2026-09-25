# ComicZ Mobile

App React Native (Expo SDK 57) do ComicZ. Usa a mesma API e a mesma conta do
site, e permite **baixar HQs para ler offline**.

## Rodando

```bash
cp .env.example .env          # ajuste EXPO_PUBLIC_API_URL para o IP da sua máquina
npm run build -w @comicz/shared   # na raiz: o app importa os tipos compilados
npx expo start                # dentro de apps/mobile
```

Abra no celular pelo **Expo Go** (mesma rede Wi-Fi da máquina). Não há versão
web: downloads e cofre de sessão só existem em Android/iOS — no navegador, o
ComicZ é o site. A API precisa
estar rodando (`npm run dev:api` na raiz) e acessível pelo IP da rede local.

### Rodando no WSL2

No WSL2 (rede NAT) o celular não alcança a máquina pela rede local, e o
`--tunnel` do Expo (ngrok) costuma falhar com _failed to download remote
update_. O que funciona é um túnel do Cloudflare para o Metro:

```bash
cloudflared tunnel --url http://localhost:8081     # anote a URL *.trycloudflare.com
EXPO_PACKAGER_PROXY_URL=http://<essa-url> npx expo start -c
```

Use `http://` na variável, não `https://`: com `https` o Expo gera o QR como
`exp://<host>:443`, que o Expo Go abre em HTTP puro na porta do TLS, e o
Cloudflare responde 400. A API precisa do próprio túnel
(`cloudflared tunnel --url http://localhost:3333`), com a URL dele em
`EXPO_PUBLIC_API_URL`.

## Como funciona

**Sessão** — o app envia `X-Client: mobile` no login/refresh. Com esse header a
API devolve o refresh token e o token de mídia no corpo, em vez de cookies. O
refresh token fica no cofre do aparelho (`expo-secure-store`); access e mídia
só em memória. As imagens vão com `Authorization: Bearer <token de mídia>`.

**Downloads** (`src/lib/downloads.ts`) — as páginas WebP são gravadas em
`<documentos>/comics/<comicId>/`, 3 por vez, e um manifesto JSON guarda o que
está completo. Download interrompido não deixa HQ pela metade.

**Progresso offline** (`src/lib/progress.ts`) — cada página virada é gravada
localmente e enviada à API; sem rede, fica pendente e sai quando o app volta
ao primeiro plano com conexão. Ao abrir uma HQ, um progresso local ainda não
enviado vence o do servidor.

**Sair da conta** remove os downloads e o progresso pendente do aparelho.

## Estrutura

```
src/
├── app/                 rotas (Expo Router)
│   ├── login.tsx
│   ├── (tabs)/          Catálogo, Biblioteca, Baixadas, Conta
│   ├── saga/[id].tsx    edições da saga + "baixar todas"
│   └── ler/[id].tsx     leitor (local ou remoto)
├── components/
├── features/auth/       contexto de sessão
└── lib/                 api, downloads, progresso, config
```

## Verificações

```bash
npm run typecheck
npx expo lint
npx expo-doctor
```
