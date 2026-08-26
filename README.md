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
| Imagens com URL estável e versionada, cacheáveis por CDN | ✅ |
| Leitor: página única, rolagem contínua, zoom, tela cheia, teclado | ✅ |
| Progresso de leitura salvo e "continuar lendo" | ✅ |
| Catálogo agrupado por título: uma saga = um card → página com as edições | ✅ |
| Catálogo com busca (título, série, personagem), filtro e paginação | ✅ |
| Página da saga: sinopse, créditos, período, status e total de edições | ✅ |
| Admin de sagas: criar e editar os metadados que a página exibe | ✅ |
| Biblioteca: adicionar, favoritar, status, filtros | ✅ |
| Biblioteca agrupada: a saga é uma coleção, não 52 cards soltos | ✅ |
| Adicionar/remover uma saga inteira da biblioteca em um clique | ✅ |
| Import em lote de uma pasta local via CLI, com trava contra import acidental | ✅ |
| CI no GitHub Actions: typecheck, testes e build | ✅ |
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

npm run import -- --dry-run   # mostra o que seria importado, sem gravar
npm run gen:secrets    # gera segredos para colar no .env

npm run typecheck      # todos os workspaces
npm test               # todos os workspaces
npm run build          # build de produção
```

> `npm run import` chama o `tsx` direto, sem `npm run -w` no meio. A indireção
> engolia tudo depois do `--` — inclusive o `--dry-run` — e disparava um import
> completo do acervo sem filtro.

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

# Importe uma saga específica (recomendado)
npm run import -- --only "Superman Absolute" --publisher "DC Comics"

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
| `-y, --yes` | Confirma import de mais de 20 arquivos |
| `--no-process` | Cadastra sem enfileirar a extração |

O import é **idempotente**: rodar de novo não duplica o que já foi importado
(a chave é o nome original do arquivo).

#### Como as pastas viram sagas

**A pasta que contém o arquivo nomeia a saga; a pasta de primeiro nível dentro da
raiz lida vira a tag de coleção.** Lendo a raiz `HQ's`:

```
HQ's/Superman/Superman Absolute/Superman Absoluto #001 (2024).cbr
     └─ coleção ─┘└──── saga ────┘└─────── edição #01 ────────┘
```

Como `--dir` **troca a raiz**, apontá-lo direto para a subpasta mantém a saga certa
mas faz a coleção virar `Superman Absolute` — você perde a franquia. Para importar
uma saga aninhada sem perder isso, use `--only` mantendo a raiz padrão.

O nome do arquivo define a edição. O parser lida com os padrões reais de scanlation
— `#01`, `#012`, `Titulo#002`, `014 - Darkseid Club`, `04 de 09`, `(2018)`, `V4`,
`(DarkseidClub)`, `.cbr.cbr`, prefixos de ordenação de saga. Cobertura em
[`packages/shared/src/comic-filename.test.ts`](./packages/shared/src/comic-filename.test.ts).
O que ele errar, você corrige no admin.

#### A trava dos 20 arquivos

Sem filtro, a raiz padrão pega o acervo inteiro — copiar tudo para `storage/` e
enfileirar a extração consome dezenas de GB e horas de CPU. Por isso um import real
de **mais de 20 arquivos exige `--yes`**:

```
195 arquivos (8.6 GB) e mais do que 20. Confirme com --yes,
ou reduza com --only / --dir / --limit. Use --dry-run para ver a lista antes.
```

Depois de importar, vale abrir `/admin/series` e preencher sinopse, créditos,
status e total de edições da saga — é o que a página dela exibe.

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

## Catálogo, sagas e biblioteca

A unidade que o leitor vê é o **título**, não a edição. Uma saga de 52 edições ocupa
um card no catálogo e um card na biblioteca; abrir leva à página da saga, onde as
edições aparecem em ordem.

```
/catalogo ──► card da saga ──► /serie/:slug ──► card da edição ──► /ler/:id
              "7 edições"       sinopse,          #01 … #07          leitor
                                créditos, status
```

Três regras que valem registrar, porque não são óbvias:

- **O agrupamento acontece no servidor.** Se fosse no cliente, a paginação passaria a
  mentir: "24 por página" contaria edições, e o total de títulos ficaria errado.
- **As contagens descrevem a saga inteira; o filtro só decide se ela aparece.** Buscar
  algo que casa com uma edição de sete ainda mostra "7 edições" — um card nunca
  promete um número e abre outro. Vale para o catálogo e para as abas da biblioteca.
- **Uma edição só não é coleção.** HQ avulsa, ou saga com uma única edição e nada a
  dizer (sem sinopse, status, créditos ou total maior), aparece como a própria HQ —
  coleção com um item dentro seria um clique a mais para nada.

Dentro da saga, cada edição já salva na biblioteca leva um **✓**, para que agrupar não
esconda quais delas você tem.

---

## Cache de imagens

Toda a banda desta aplicação é imagem. Duas decisões fazem essa banda ser cacheável
em vez de recomprada a cada visita.

**A URL não carrega identidade.** A autorização vem de um cookie `httpOnly` com
escopo em `/api/v1/media`, não de um token na query. Uma `<img>` não manda
`Authorization`, mas manda cookies — então a URL de uma página é literalmente a
mesma para todos os leitores, e um cache compartilhado (CDN) pode guardar uma cópia
e servir a todos. Com o token na query, cada usuário gerava uma URL diferente para a
mesma imagem, e o token rotativo mudava a URL de novo a cada renovação: a taxa de
acerto de qualquer cache era zero.

**A URL carrega uma versão.** Reprocessar um arquivo reescreve as *mesmas* chaves em
storage — `attachUpload` reaproveita o `comicFileId`, e a capa mora em
`covers/<comicId>.webp`. Sem versão na URL, `immutable` faria um CDN servir as
páginas antigas por um ano depois de uma substituição. O segmento vem de
`processedAt` e muda a cada reprocessamento:

```
/api/v1/media/pages/<comicFileId>/<versao>/<n>
/api/v1/media/covers/<comicId>/<versao>
```

O servidor **ignora** o valor da versão — ela existe para ser chave de cache, e uma
URL com versão antiga continua resolvendo em vez de virar link quebrado.

Com isso as respostas saem como `public, max-age=31536000, immutable`.

> **O que `public` custa.** Atrás de um CDN, a URL passa a valer como credencial:
> quem souber o UUID busca a imagem sem cookie. Os UUIDs não são adivinháveis e a
> origem continua exigindo o cookie, mas para fechar isso de vez a validação precisa
> subir para a borda — um Worker no Cloudflare ou signed cookies do CloudFront.
> É uma troca deliberada: sem ela, não existe cache compartilhado.

---

## Como a leitura funciona

```
.cbr (RAR)                        ┌── PostgreSQL ── metadados + progresso
    │                             │
    ▼                             │
upload/import ──► fila (jobs) ──► worker ──► 0001.webp, 0002.webp ... ──► storage
    │                                                                       │
  202 Accepted                                                              ▼
                                              GET /media/pages/:id/:versao/:n
                                                       (cookie de mídia)     │
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
- **As URLs de imagem são iguais para todos os usuários e imutáveis**, servidas com
  `Cache-Control: public, max-age=31536000, immutable`. Ver
  ["Cache de imagens"](#cache-de-imagens).

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
- **Token de mídia separado**, em cookie `httpOnly` com escopo em `/api/v1/media`:
  `<img>` não envia header `Authorization`, mas envia cookies. Cada cookie tem seu
  próprio `path`, então o de mídia não viaja nas chamadas de API e o de refresh não
  viaja em cada imagem. O token dá acesso apenas a leitura de imagens e expira em
  `PAGE_TOKEN_TTL`; é renovado no login, no refresh e ao abrir o leitor.
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
   autorização, do fluxo upload → processamento → leitura e do agrupamento por saga.
2. **Processamento sob demanda** (Estratégia B do RF0001 §9): liberar a leitura a
   partir da primeira página extraída.
3. **Personagens como entrada** — o catálogo já entra por título/saga; falta a
   jornada do RF0001 que começa em "pesquisar Batman → ver por onde começar".
4. **Adicionar um guia inteiro à biblioteca** — a saga já vai de uma vez; o guia,
   que é a porta de entrada do produto, ainda vai edição por edição.
5. **Redis + cache** dos guias mais acessados, quando houver acesso real.
6. **Deploy**: Nginx, HTTPS, storage S3/R2, backup do PostgreSQL.

---

## Licença

[MIT](./LICENSE) — o **código** é livre para usar, modificar e redistribuir.

Isso não se estende a nada que você coloque dentro dele: as HQs importadas
continuam pertencendo aos seus detentores de direito, e este repositório não
distribui nem inclui nenhuma delas (`HQ's/` e `storage/` estão no `.gitignore`).
