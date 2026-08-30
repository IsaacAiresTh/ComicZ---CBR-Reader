# Como uma mudança chega em produção

`main` é produção. Um push nela dispara, ao mesmo tempo, o deploy do frontend na
Vercel e o do backend no Render — e o build do Render roda `prisma migrate
deploy` **contra o banco de produção**. Não existe etapa de aprovação no meio.

Por isso nada é commitado direto na `main`.

```
main ──────●───────────────●──────────► produção
           ↑               ↑
         merge           merge
           │               │
  feat/algo ●     fix/outra-coisa ●
           │               │
        CI verde        CI verde
```

## O ciclo

```sh
git checkout main && git pull
git checkout -b feat/nome-curto
# trabalha, commita
git push -u origin feat/nome-curto
```

Abra o PR pelo link que o `git push` imprime. O CI roda sozinho: typecheck nos
seis workspaces, testes e build. Merge só com o CI verde.

Prefixos em uso: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`.

## Onde testar

**No seu ambiente local.** `npm run dev` sobe tudo contra o Postgres do Docker e
o storage em disco (`STORAGE_DRIVER=local`), que é uma cópia completa e
descartável do sistema. É lá que uma mudança se prova.

**Não use o preview da Vercel para isso.** O rewrite do `vercel.json` aponta
para `comicz-api.onrender.com` de forma fixa, então um preview seria um frontend
novo conversando com a API e o banco **de produção** — cadastrar ou apagar algo
nele mexeria no acervo real. Por isso `git.deploymentEnabled` desliga o deploy
automático para as branches de trabalho.

## O que mais merece cuidado

**Migrations.** É a única mudança sem desfazer: o merge na `main` aplica o
schema novo no Neon de produção durante o build. Antes de mergear uma migration,
vale ensaiá-la em uma branch do Neon (o plano free permite 10) restaurando o
estado depois.

**`render.yaml`.** O blueprint é sincronizado a partir da `main`. Uma variável
errada ali derruba a API — foi o que aconteceu com a `DATABASE_URL` colada com o
prefixo `psql`. A sorte estrutural é que as migrations rodam no `buildCommand`:
um valor inválido quebra o build antes de substituir a instância que está no ar.

**`vercel.json`.** O destino do rewrite é fixo por arquivo. Se o serviço do
Render mudar de nome, é aqui que se ajusta.
