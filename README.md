# ComicZ

[![CI](https://github.com/IsaacAiresTh/ComicZ---CBR-Reader/actions/workflows/ci.yml/badge.svg)](https://github.com/IsaacAiresTh/ComicZ---CBR-Reader/actions/workflows/ci.yml)

Plataforma web de leitura de HQs (`.cbr` / `.cbz`) com biblioteca pessoal e **guias
de leitura** — pensada para quem quer entrar no mundo das HQs e não sabe por onde
começar.

Este repositório é o MVP descrito em [`arquitetura.md`](./arquitetura.md) e
[`RF0001.md`](./RF0001.md): monólito modular, preparado para crescer, sem a
complexidade de produção que ainda não é necessária.

---

## O que já funciona

| Área | Estado |
| --- | --- |
| Cadastro, login, logout, refresh token rotativo, troca de senha | ✅ |
| Papéis `USER` / `ADMIN` com autorização por rota e por recurso | ✅ |
| Admin: CRUD de HQs, upload de `.cbr`/`.cbz`, reprocessar, excluir | ✅ |
| Admin: criar guias, adicionar HQs, reordenar, notas, publicar | ✅ |
| Admin: painel com fila de processamento e gestão de usuários | ✅ |
| Processamento CBR/CBZ → páginas WebP em worker separado | ✅ |
| Leitor: página única, rolagem contínua, zoom, tela cheia, teclado | ✅ |
| Progresso de leitura salvo e "continuar lendo" | ✅ |
| Biblioteca: adicionar, favoritar, status, filtros | ✅ |
| Catálogo agrupado por título: uma série = um card → página com as edições | ✅ |
| Catálogo com busca (título, série, personagem) e paginação | ✅ |
| Import em lote de uma pasta local via CLI | ✅ |
| Swagger em `/api/v1/docs` | ✅ |

Fora do MVP (a arquitetura já prevê): Redis, storage S3/R2, CDN, Nginx,
reviews/social, busca full-text avançada, CI/CD.

---

## Stack

- **API** — NestJS 11 + TypeScript, Prisma, PostgreSQL, JWT, argon2id, Zod, Swagger
- **Worker** — Node + TypeScript, `7z`/`unrar` para extração, `sharp` para WebP
- **Web** — React 19 + Vite, React Router, TanStack Query, Tailwind 4
- **Infra local** — Docker Compose (só PostgreSQL); os apps rodam com `npm run dev`

```
ComicZ/
├── apps/
│   ├── api/                 NestJS — modular por domínio
│   │   └── src/modules/     auth users comics series publishers
│   │                        library reader guides files admin
│   ├── worker/              processamento de arquivos + CLI de import
│   └── web/                 React — features/ por domínio
├── packages/
│   ├── database/            schema Prisma + fila de jobs (compartilhado)
│   └── shared/              tipos, schemas Zod e parser de nomes de arquivo
├── storage/                 arquivos originais, páginas e capas (fora do Git)
├── infrastructure/
└── docker-compose.yml
```

---

## Pré-requisitos

- Node.js 20+ (testado no 24)
- Docker + Docker Compose
- **Um extrator de RAR**: `p7zip` (recomendado, cobre CBR e CBZ) ou `unrar`
- Espaço em disco: cerca de 2,5× o tamanho da maior HQ durante o processamento
  (veja [Arquivos grandes](#arquivos-grandes))

```bash
# Arch / Manjaro
sudo pacman -S p7zip unrar
# Debian / Ubuntu
sudo apt install p7zip-full unrar
```

O worker tenta, nesta ordem: `7z` → `7za` → `unrar` → `bsdtar`. Se nenhum existir,
o job falha com uma mensagem explicando o que instalar.

---

## Como rodar

```bash
# 1. Clone o repositório
git clone git@github.com:IsaacAiresTh/ComicZ---CBR-Reader.git comicz
cd comicz

# 2. Copie e ajuste as variáveis de ambiente
cp .env.example .env
npm run gen:secrets    # gera segredos reais e mostra o que colar no .env

# 3. Instale, suba o banco, migre e crie o admin
npm run setup

# 4. Suba API + worker + web
npm run dev
```

| Serviço | URL |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3333/api/v1 |
| Swagger | http://localhost:3333/api/v1/docs |
| PostgreSQL | `localhost:5433` (container próprio, não conflita com um Postgres local na 5432) |

O login inicial vem de `ADMIN_EMAIL` / `ADMIN_PASSWORD` no `.env`. Se você não
definir `ADMIN_PASSWORD`, o seed **sorteia** uma senha e a imprime uma única vez
no terminal — não existe senha padrão embutida no código.

> Antes de expor a aplicação em qualquer rede, rode `npm run gen:secrets` e troque
> `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PAGE_TOKEN_SECRET` e a senha do
> PostgreSQL. Os valores do `.env.example` servem só para desenvolvimento local.

### Scripts úteis

```bash
npm run dev            # constrói os packages e sobe os 5 processos em watch
npm run dev:api        # somente a API
npm run dev:worker     # somente o worker
npm run dev:web        # somente o frontend

npm run db:up          # sobe o PostgreSQL
npm run db:migrate     # cria/aplica migração
npm run db:seed        # (re)cria o admin e as editoras
npm run db:studio      # Prisma Studio
npm run db:reset       # apaga e recria o banco

npm run typecheck      # todos os workspaces
npm test               # todos os workspaces
npm run build          # build de produção
```

---

## Ciclo de desenvolvimento

`npm run dev` sobe **cinco** processos em watch: os dois packages compartilhados
(`shared`, `database`) e os três apps. Ele constrói os packages antes de começar,
então funciona a partir de um clone limpo.

**Na maioria das mudanças você não precisa fazer nada** — salvar o arquivo basta:

| Você mexeu em | O que acontece |
| --- | --- |
| `apps/web/**` | Vite troca o módulo na hora (HMR), sem recarregar a página |
| `apps/api/**` | Nest recompila e reinicia a API (~3 s) |
| `apps/worker/**` | `tsx watch` reinicia o worker |
| `packages/shared/**` | Recompila CJS **e** ESM; API e worker reiniciam, o web recarrega |
| `packages/database/src/**` | Recompila; API e worker reiniciam |

Os casos que **exigem uma ação sua**:

| Você mexeu em | Faça |
| --- | --- |
| `.env` | `Ctrl+C` e `npm run dev` de novo — as variáveis são lidas no boot |
| `prisma/schema.prisma` | `npm run db:migrate -w @comicz/database -- --name <descricao>` |
| `package.json` (qualquer um) | `npm install` e reinicie o `dev` |
| Nada disso resolveu | `Ctrl+C`, `npm run build:packages`, `npm run dev` |

> A migração precisa ser chamada com `-w`, e não pelo atalho `npm run db:migrate`:
> o npm consome o `--name` como flag própria quando há `-w` no meio, e o Prisma
> trava num prompt esperando o nome.

Antes de considerar uma mudança pronta:

```bash
npm run typecheck && npm test
```

### Quando algo parece "não ter mudado"

Quase sempre é uma destas três coisas:

1. **A API não subiu.** O frontend mostra erro de rede; confira o terminal do `dev`.
2. **O `.env` mudou e ninguém reiniciou.** Config é lida uma vez, no boot.
3. **A porta ficou ocupada** por um processo de uma execução anterior:
   `fuser -k 3333/tcp 5173/tcp` e suba de novo.

### Só um serviço por vez

Útil quando você quer o log de um processo limpo:

```bash
npm run build:packages   # uma vez, se os packages estiverem desatualizados
npm run dev:api          # em um terminal
npm run dev:web          # em outro
npm run dev:worker       # em outro
```

O worker é opcional para mexer na interface: sem ele os uploads ficam em
`PENDING` para sempre, mas as HQs já processadas continuam legíveis.

---

## Importando suas HQs

Duas formas, e as duas convivem.

### 1. Upload pelo admin

`/admin/hqs` → **+ Nova HQ** → preencha os metadados → botão **⬆** na linha da HQ
para enviar o `.cbr`/`.cbz`. A resposta é imediata (`202 Accepted`): o arquivo entra
na fila e o worker extrai as páginas em segundo plano. Acompanhe em `/admin/fila`.

O botão mostra progresso em MB e recusa localmente arquivos acima do limite, antes
de gastar minutos enviando bytes que seriam rejeitados. O limite vigente vem de
`GET /api/v1/config`.

### 2. Script de import em lote

Varre uma pasta local, cria séries e edições a partir dos nomes dos arquivos e
enfileira o processamento. Os arquivos originais são **copiados** para `storage/`;
sua pasta não é alterada.

```bash
# Veja o que seria importado, sem gravar nada
npm run import -- --dry-run

# Importe uma série específica
npm run import -- --only "Ultimate SpiderMan" --publisher "Marvel Comics"

# Comece pequeno para testar
npm run import -- --only Batman --limit 5
```

| Opção | Efeito |
| --- | --- |
| `-d, --dir <caminho>` | Pasta raiz (padrão: `COMICS_SOURCE_DIR` do `.env`) |
| `--only <texto>` | Só caminhos que contenham este texto |
| `--publisher <nome>` | Editora aplicada a tudo que for importado |
| `--limit <n>` | Para depois de `n` arquivos |
| `--dry-run` | Mostra o plano, não grava |
| `--no-process` | Cadastra sem enfileirar a extração |

O import é **idempotente**: rodar de novo não duplica o que já foi importado
(a chave é o nome original do arquivo).

**A pasta define a série; o nome do arquivo define a edição.** O parser lida com os
padrões reais de scanlation — `#01`, `#012`, `Titulo#002`, `04 de 09`, `(2018)`,
`V4`, `(DarkseidClub)`, `.cbr.cbr`, prefixos de ordenação de saga. Cobertura em
[`packages/shared/src/comic-filename.test.ts`](./packages/shared/src/comic-filename.test.ts).
O que ele errar, você corrige no admin.

### Arquivos grandes

O limite de upload é `MAX_UPLOAD_MB` no `.env` (padrão **1024 MB**), e edições
encadernadas passam facilmente de meio giga. Duas medições reais nesta máquina:

| Arquivo | Páginas | WebP gerado | Redução | Tempo |
| --- | --- | --- | --- | --- |
| 36 MB (edição avulsa) | 28 | 8,9 MB | 75% | 25 s |
| 786 MB (edição definitiva) | 434 | 211 MB | 73% | 7,5 min |

O upload em si é rápido (786 MB em ~6 s no localhost); o custo está na extração
e conversão. Processar a coleção inteira de ~9 GB leva horas de CPU — importe por
série.

> **Não aponte `TMP_ROOT` para `/tmp`.** Na maioria das distros Linux `/tmp` é
> `tmpfs`, ou seja, RAM. Tanto o upload em andamento quanto a extração do arquivo
> passam por essa pasta: um CBR de 800 MB consumiria ~1,6 GB de memória em pico e
> derrubaria a máquina. Por isso o padrão é `<STORAGE_ROOT>/tmp` — mesmo disco do
> destino final, o que também torna a promoção do arquivo um `rename` atômico em
> vez de uma cópia de centenas de MB.

Espaço em disco necessário por HQ, no pico: `original + extraído + WebP`. Para o
arquivo de 786 MB acima isso deu ~1,8 GB momentâneos, caindo para ~1 GB depois que
o temporário é limpo. O worker também varre temporários órfãos com mais de 6 h ao
iniciar, para o caso de uma extração ter morrido no meio.

---

## Como a leitura funciona

```
.cbr (RAR)                        ┌── PostgreSQL ── metadados + progresso
    │                             │
    ▼                             │
upload/import ──► fila (jobs) ──► worker ──► 0001.webp, 0002.webp ... ──► storage
    │                                                                       │
  202 Accepted                                                              ▼
                                                            GET /media/pages/:id/:n
                                                                            │
                                                                       leitor React
```

Decisões que valem registrar:

- **A extração nunca acontece dentro da requisição HTTP.** Upload responde em
  milissegundos; o arquivo fica `PENDING` e o worker processa.
- **A fila vive no PostgreSQL** (`SELECT ... FOR UPDATE SKIP LOCKED`), com retry e
  backoff exponencial. Vários workers podem rodar em paralelo. Trocar por
  Redis/BullMQ depois mexe só em `packages/database/src/queue.ts`.
- **O navegador nunca recebe o CBR.** Ele recebe páginas WebP, uma por request.
- **`status` só vira `READY`** quando todas as páginas estão em disco — o leitor
  nunca abre uma HQ pela metade (Estratégia A do RF0001 §9).
- **Todo acesso a arquivo passa por `StorageService.resolveKey`**, que bloqueia path
  traversal. Trocar disco local por S3/R2 é reimplementar essa classe.

---

## Segurança

O que já está no código:

- **argon2id** (19 MiB, 2 iterações) para senhas — nunca SHA-256.
- **Access token de 15 min** em memória no frontend, nunca em `localStorage`.
- **Refresh token opaco** (48 bytes aleatórios) em cookie `httpOnly`, guardado
  apenas como SHA-256 no banco, com **rotação a cada uso**. Reusar um token já
  rotacionado revoga todas as sessões daquele usuário (detecção de vazamento).
- **Papel relido do banco a cada request** — rebaixar um admin tem efeito imediato,
  sem esperar o token expirar.
- **Guard global fail-closed**: toda rota exige autenticação, exceto as marcadas
  com `@Public()`. Esquecer um guard não abre um endpoint.
- **Autorização por recurso**: biblioteca e progresso são sempre consultados a
  partir do `userId` da sessão, nunca de um id vindo da URL — não existe
  `GET /users/123/library` para trocar o `123` (IDOR/BOLA).
- **Token de mídia separado**: `<img>` não envia header `Authorization`, então capas
  e páginas são autorizadas por um JWT curto na query. Se vazar num log de proxy,
  dá acesso apenas a leitura de imagens e expira em `PAGE_TOKEN_TTL`.
- Helmet, CORS restrito a `WEB_ORIGIN`, rate limit (5/min no registro, 10/min no
  login), validação Zod em toda entrada, limite de upload configurável.
- Login responde a mesma mensagem para e-mail inexistente e senha errada, gastando
  tempo comparável nos dois caminhos (sem oráculo por timing).

Exercícios que sobraram de propósito, se você quiser continuar estudando: CSRF nos
endpoints de mutação, revogação de token de mídia antes do vencimento, auditoria de
acessos, 2FA, política de senha vazada (k-anonymity do HaveIBeenPwned).

---


## Próximos passos sugeridos

Na ordem em que eu faria:

1. **Testes** — o parser de nomes já tem cobertura; faltam testes e2e de auth,
   autorização e do fluxo upload → processamento → leitura.
2. **CI** (GitHub Actions): lint, typecheck, testes, build.
3. **Processamento sob demanda** (Estratégia B do RF0001 §9): liberar a leitura a
   partir da primeira página extraída.
4. **Personagens como entrada** — o catálogo já entra por título/série; falta a
   jornada do RF0001 que começa em "pesquisar Batman → ver por onde começar".
5. **Redis + cache** dos guias mais acessados, quando houver acesso real.
6. **Deploy**: Nginx, HTTPS, storage S3/R2, backup do PostgreSQL.

---

## Licença

[MIT](./LICENSE) — o **código** é livre para usar, modificar e redistribuir.

Isso não se estende a nada que você coloque dentro dele: as HQs importadas
continuam pertencendo aos seus detentores de direito, e este repositório não
distribui nem inclui nenhuma delas (`HQ's/` e `storage/` estão no `.gitignore`).
