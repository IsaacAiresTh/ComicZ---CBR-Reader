# Deploy

# Passo 1: aplicação no ar, sem imagens

Este passo coloca **banco + API + frontend** em produção para provar que login,
sessão e catálogo funcionam ponta a ponta. Imagens e upload ficam para o passo 2
(storage no R2), porque o free instance do Render não tem disco persistente.

```
navegador
    │
    ▼
comicz-zeta.vercel.app ─ /api/* (rewrite) ─► comicz-api.onrender.com
    │                                                  │
  React estático                                       ▼
                                                     Neon
```

## Por que o rewrite, e não VITE_API_URL

`apps/web/src/services/api.ts` usa `API_BASE = '/api/v1'`, e o dev server já
resolve isso com um proxy (`apps/web/vite.config.ts`). Essa escolha é o que faz
os cookies `httpOnly` funcionarem sem `SameSite=None`.

Se o front chamasse `https://comicz-api.onrender.com` direto, o navegador veria
dois sites diferentes (`vercel.app` × `onrender.com`) e **não enviaria** os
cookies `Lax` de refresh e de mídia — a sessão não sobreviveria a um F5 e
nenhuma página do leitor carregaria. O rewrite da Vercel é o mesmo truque do
proxy do Vite, em produção: o navegador só conversa com uma origem.

O preço é que todo tráfego de API passa pela Vercel (100 GB/mês no free) e que
uploads grandes não devem passar por ali — o que só importa a partir do passo 2.

## 1. Banco no Neon

Crie um projeto Postgres no [Neon](https://neon.com) e copie a connection
string **direta (sem pooler)** — a que não tem `-pooler` no host. O pooler existe
para ambientes serverless com muitas instâncias efêmeras; aqui é um único
processo Node sempre ligado, com o pool do próprio Prisma. E o `prisma migrate
deploy` roda contra essa mesma URL no build do Render, o que não funciona sobre
pooling em modo transação.

Neon foi escolhido no lugar do Supabase porque o free do Supabase pausa o
projeto após uma semana de inatividade e exige restore manual; o Neon suspende
e acorda sozinho.

Rode as migrations e o seed da sua máquina, uma vez:

```sh
DATABASE_URL='postgresql://...neon.tech/...' npm run db:deploy
DATABASE_URL='postgresql://...neon.tech/...' ADMIN_PASSWORD='<senha forte>' npm run db:seed
```

Troque `ADMIN_PASSWORD`: o valor do `.env.example` (`admin12345`) é de
desenvolvimento e a instância fica exposta na internet.

## 2. API no Render

O `render.yaml` na raiz é um blueprint: em **New → Blueprint**, aponte para o
repositório e o Render cria o web service `comicz-api` já configurado.

Depois preencha no dashboard a única variável marcada como `sync: false`:
`DATABASE_URL`, com a connection string do Neon.

Os três segredos JWT são gerados pelo próprio Render (`generateValue`), e a
`WEB_ORIGIN` já está no `render.yaml` — é domínio público, não segredo.

Se você renomear o serviço, o subdomínio muda: atualize o `destination` em
`vercel.json`.

## 3. Frontend na Vercel

**New Project** apontando para o repositório, com **Root Directory** na raiz
(não em `apps/web` — o build precisa do workspace `@comicz/shared`). O
`vercel.json` já define install, build, output e os rewrites; não é preciso
configurar nada na interface.

Nenhuma variável de ambiente é necessária: a URL da API está no rewrite.

## 4. Fechar o círculo

A `WEB_ORIGIN` do `render.yaml` precisa bater com o domínio que a Vercel
gerou (`https://comicz-zeta.vercel.app`, sem barra no final). Se o domínio
mudar, é aqui que se ajusta — e o push já redeploya sozinho.

## Verificação

```sh
curl -s https://comicz-zeta.vercel.app/api/v1/config
```

Deve responder o JSON de limites vindo do Render, servido pelo domínio da
Vercel — é isso que prova que o rewrite está de pé. Depois, no navegador:
login, F5 (a sessão tem que sobreviver), e o catálogo carregando.

## O que ainda não funciona

- **Imagens**: capas e páginas vão dar 404. Os arquivos estão no seu disco
  local; a API no Render não os enxerga.
- **Upload pela web**: o arquivo até sobe, mas o worker não roda no Render (o
  free instance não cobre background workers) e o disco é efêmero.

Ambos são resolvidos no passo 2, movendo o storage para o Cloudflare R2 e
rodando `apps/worker` na sua máquina contra o Neon + R2.

# Passo 2: storage no R2 e worker local

O passo 1 deixou a aplicação de pé sem imagens. Elas faltavam por um motivo
estrutural, não por configuração: no Render a API e o worker seriam serviços
distintos, com discos distintos, e o disco do free instance é efêmero. O worker
grava as páginas; a API precisa lê-las. Sem um storage que os dois enxerguem,
não existe combinação de variáveis que faça isso funcionar.

```
                    ┌──────────────┐
   admin ──upload──►│  API/Render  │──original──┐
                    └──────┬───────┘            │
                           │ job PENDING        ▼
                           ▼                  ┌────┐
                      ┌─────────┐             │ R2 │
                      │  Neon   │             └────┘
                      └────┬────┘              ▲  │
                           │ claim             │  │
                           ▼                   │  │
                  ┌─────────────────┐          │  │
                  │ worker (seu PC) │──páginas─┘  │
                  └─────────────────┘             │
                                                  ▼
                    leitor ◄──── API/Render ◄── WebP
```

O worker roda na sua máquina de propósito: background worker não existe no free
do Render, e 0,15 CPU com 512 MB não converteria centenas de páginas com sharp
em tempo aceitável. A fila vive no Postgres, então o worker só precisa alcançar
o Neon e o R2 — não precisa ser alcançável de fora.

## 1. Bucket e credenciais no R2

No painel da Cloudflare, **R2 → Create bucket**, nome `comicz`, localização
automática. Depois **Manage API Tokens → Create API Token**, tipo *Object Read &
Write*, escopado nesse bucket.

Quatro valores saem daí:

| Variável | Onde achar |
| --- | --- |
| `S3_BUCKET` | o nome do bucket (`comicz`) |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | do token |
| `S3_SECRET_ACCESS_KEY` | do token, exibido uma única vez |

O free do R2 dá 10 GB e **egress zero**. O egress é o que importa aqui: a banda
desta aplicação é quase toda imagem saindo.

## 2. Ligar o R2 na API

No dashboard do Render, preencha as quatro variáveis `sync: false` do
`render.yaml` e troque `STORAGE_DRIVER` de `local` para `s3`.

Enquanto `STORAGE_DRIVER` for `local`, a API sobe normalmente e devolve 404 em
toda imagem — é um estado válido, não uma falha.

## 3. Rodar o worker contra produção

O worker lê o mesmo `.env` da raiz. Para apontá-lo ao Neon e ao R2 sem alterar o
seu ambiente de desenvolvimento, passe as variáveis só naquele processo:

```sh
DATABASE_URL='<url do neon>' \
STORAGE_DRIVER=s3 \
KEEP_ORIGINALS=false \
S3_BUCKET=comicz \
S3_ENDPOINT='https://<account-id>.r2.cloudflarestorage.com' \
S3_ACCESS_KEY_ID='<...>' \
S3_SECRET_ACCESS_KEY='<...>' \
npm run dev:worker
```

Ele imprime o driver no start (`storage: S3 (comicz em ...)`). Se aparecer
`disco local`, alguma variável não chegou — e o job vai gravar as páginas no
seu disco, onde a API nunca vai encontrá-las.

Com o worker desligado, uploads ficam `PENDING` até você ligá-lo. Para um
acervo curado por uma pessoa só, isso é aceitável.

### Por que `KEEP_ORIGINALS=false` em produção

O CBR/CBZ original não é servido a ninguém: depois de extraídas as páginas, ele
só serve para reprocessar sem reenviar o arquivo. E é caro — na primeira HQ
medida neste bucket, o original respondia por **79% do espaço** (39 MB de
original para 10,4 MB de páginas). Descartá-lo multiplica por ~5 quantas HQs
cabem nos 10 GB do free.

Só é seguro porque a fonte da verdade é a sua pasta local: o importador **copia**
o arquivo, nunca o move. O padrão do flag é `true` justamente porque descartar
é irreversível para quem não tem essa cópia.

O que se perde é o botão de reprocessar. A API detecta o caso e responde com
uma mensagem explícita em vez de enfileirar um job condenado a falhar, que
deixaria a HQ marcada como `FAILED` e sem páginas.

## 4. Levar HQs para produção

O banco de produção nasce vazio. O caminho é o importador, apontado para o Neon
e o R2 com as mesmas variáveis acima:

```sh
DATABASE_URL='<url do neon>' STORAGE_DRIVER=s3 KEEP_ORIGINALS=false ... npm run import -- --dry-run
DATABASE_URL='<url do neon>' STORAGE_DRIVER=s3 KEEP_ORIGINALS=false ... npm run import -- --only "Superman Absoluto"
```

Comece pelo `--dry-run`, e importe por série com `--only`. São 10 GB de cota, e
um acervo inteiro passa disso sem esforço — o `storage/` local deste repositório
já ocupa 3,2 GB só com o que foi processado até aqui.

## Notas de operação

- **Cold start**: o free do Render dorme após 15 min ocioso. A primeira
  requisição depois disso leva ~50 s.
- **`x-render-routing: no-server`**: enquanto a instância volta do spin-down, o
  Render responde 404 instantâneo com esse header em parte das requisições, em
  vez de segurar todas até ela subir. Parece serviço morto e não é — as Events
  continuam em `Deploy live` e o log não registra nada. Antes de investigar,
  faça uma dezena de requisições seguidas: com a instância quente, o
  comportamento é estável.
- **Build ≠ runtime**: o `buildCommand` usa `npm ci --include=dev` porque o
  Render define `NODE_ENV=production`, e com isso o npm omite tudo que o
  lockfile marca como dev — inclusive o `@nestjs/cli`. O runtime não precisa
  delas; o build precisa.
- **`TRUST_PROXY=2`**: são dois hops (Vercel + Render). Sem isso, o
  `ThrottlerGuard` veria o IP do proxy em toda requisição e o limite de 300
  req/min seria compartilhado por todos os usuários.
- **Migrations** rodam no `buildCommand` do Render, não no start: assim não
  custam nada a cada spin-down.
- **Imagens em cache no edge da Vercel**: as respostas de `/media` saem como
  `public, max-age=31536000, immutable`, então a Vercel as guarda e passa a
  servi-las sem consultar a origem. Medido em produção: uma página nunca
  buscada responde 401 sem o cookie de mídia, mas a mesma página, depois de
  buscada uma vez por alguém autenticado, responde 200 para qualquer um que
  tenha a URL (`x-vercel-cache: HIT`). A URL não é adivinhável — dois UUIDs —
  mas deslogar não invalida o que já está em cache. É a troca que o comentário
  em `media.controller.ts` descreve, e que só virou real quando um CDN entrou
  na frente da API. Fechar isso sem perder o cache exige validar na borda.
- **Driver de storage**: API e worker precisam concordar. Ambos derivam o
  destino das mesmas funções em `@comicz/storage`, então divergir exige
  divergir de variável de ambiente — e o sintoma seria uma HQ processada com
  sucesso cujas páginas dão 404.
