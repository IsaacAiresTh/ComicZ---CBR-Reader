# Deploy — passo 1: aplicação no ar, sem imagens

Este passo coloca **banco + API + frontend** em produção para provar que login,
sessão e catálogo funcionam ponta a ponta. Imagens e upload ficam para o passo 2
(storage no R2), porque o free instance do Render não tem disco persistente.

```
navegador
    │
    ▼
comicz.vercel.app ──── /api/* (rewrite) ────► comicz-api.onrender.com
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

Depois preencha no dashboard as duas variáveis marcadas como `sync: false`:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | a connection string do Neon |
| `WEB_ORIGIN` | só depois do passo 3 — a URL da Vercel |

Os três segredos JWT são gerados pelo próprio Render (`generateValue`).

Se você renomear o serviço, o subdomínio muda: atualize o `destination` em
`vercel.json`.

## 3. Frontend na Vercel

**New Project** apontando para o repositório, com **Root Directory** na raiz
(não em `apps/web` — o build precisa do workspace `@comicz/shared`). O
`vercel.json` já define install, build, output e os rewrites; não é preciso
configurar nada na interface.

Nenhuma variável de ambiente é necessária: a URL da API está no rewrite.

## 4. Fechar o círculo

Volte ao Render e preencha `WEB_ORIGIN` com a URL da Vercel
(`https://comicz.vercel.app`, sem barra no final). Isso libera o CORS para as
chamadas que não passarem pelo proxy.

## Verificação

```sh
curl -s https://comicz.vercel.app/api/v1/config
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

## Notas de operação

- **Cold start**: o free do Render dorme após 15 min ocioso. A primeira
  requisição depois disso leva ~50 s.
- **`TRUST_PROXY=2`**: são dois hops (Vercel + Render). Sem isso, o
  `ThrottlerGuard` veria o IP do proxy em toda requisição e o limite de 300
  req/min seria compartilhado por todos os usuários.
- **Migrations** rodam no `buildCommand` do Render, não no start: assim não
  custam nada a cada spin-down.
