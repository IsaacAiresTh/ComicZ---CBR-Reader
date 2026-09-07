import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { CharacterDetail, CharacterFont, CharacterSummary } from '@comicz/shared';
import { Button, ErrorNote, Field, Input, Select, Spinner, Textarea } from '../../components/ui';
import { CoverError, prepararCapa } from '../../lib/cover';
import { ApiError, mediaUrl } from '../../services/api';
import { useCharacter, useCharacters } from '../comics/queries';
import { FONTES } from '../characters/estilo';
import { useAddCharacterImage, useRemoveCharacterImage, useUpdateCharacter } from './queries';

/** A foto ocupa a coluna inteira do texto; 500px como a capa sairia borrada. */
const LARGURA_DA_FOTO = 900;

export function AdminCharactersPage() {
  const { data: personagens, isLoading } = useCharacters();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todos = personagens ?? [];
    const filtrados = termo
      ? todos.filter((p) => p.name.toLowerCase().includes(termo))
      : [...todos].sort((a, b) => b.comicCount - a.comicCount || a.name.localeCompare(b.name));
    return filtrados.slice(0, 60);
  }, [personagens, busca]);

  if (isLoading) return <Spinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar personagem"
        />
        <ul className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
          {lista.map((personagem) => (
            <li key={personagem.id}>
              <ItemDaLista
                personagem={personagem}
                ativo={personagem.slug === escolhido}
                onEscolher={() => setEscolhido(personagem.slug)}
              />
            </li>
          ))}
        </ul>
      </div>

      {escolhido ? (
        <Editor slug={escolhido} />
      ) : (
        <p className="rounded-xl border border-dashed border-ink-700 px-6 py-12 text-center text-sm text-ink-400">
          Escolha um personagem para escrever a história dele.
        </p>
      )}
    </div>
  );
}

function ItemDaLista({
  personagem,
  ativo,
  onEscolher,
}: {
  personagem: CharacterSummary;
  ativo: boolean;
  onEscolher: () => void;
}) {
  const retrato = mediaUrl(personagem.portraitUrl);
  return (
    <button
      type="button"
      onClick={onEscolher}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
        ativo ? 'bg-ink-800 text-ink-100' : 'text-ink-300 hover:bg-ink-850'
      }`}
    >
      <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-ink-850">
        {retrato && <img src={retrato} alt="" className="h-full w-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{personagem.name}</span>
      {/* Sem texto, o personagem nao tem pagina de verdade — vale ver de longe. */}
      {!personagem.summary && <span className="text-[10px] text-ink-600">vazio</span>}
    </button>
  );
}

function Editor({ slug }: { slug: string }) {
  const { data: personagem, isLoading } = useCharacter(slug);
  if (isLoading || !personagem) return <Spinner />;
  return <Formulario key={personagem.id} personagem={personagem} />;
}

function Formulario({ personagem }: { personagem: CharacterDetail }) {
  const salvar = useUpdateCharacter();
  const adicionar = useAddCharacterImage();
  const remover = useRemoveCharacterImage();

  const [summary, setSummary] = useState(personagem.summary ?? '');
  const [description, setDescription] = useState(personagem.description ?? '');
  const [aliases, setAliases] = useState(personagem.aliases.join(', '));
  const [cor1, setCor1] = useState(personagem.accentColor ?? '#f5b301');
  const [cor2, setCor2] = useState(personagem.accentColor2 ?? '#f5b301');
  const [fonte, setFonte] = useState<CharacterFont>(personagem.displayFont ?? 'bangers');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState<{ atual: number; total: number } | null>(null);
  /*
   * Contador, e nao booleano: dragleave dispara toda vez que o ponteiro passa
   * de um filho para outro dentro da area, e com booleano a moldura piscaria a
   * cada miniatura por baixo do cursor.
   */
  const [arrastes, setArrastes] = useState(0);

  async function enviar() {
    setErro(null);
    setOk(false);
    try {
      await salvar.mutateAsync({
        id: personagem.id,
        dados: {
          summary: summary.trim() || null,
          description: description.trim() || null,
          // Campo de texto separado por virgula, como o de criadores da saga.
          aliases: aliases
            .split(',')
            .map((alias) => alias.trim())
            .filter(Boolean),
          accentColor: cor1,
          accentColor2: cor2,
          displayFont: fonte,
        },
      });
      setOk(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar');
    }
  }

  /*
   * Errar o alvo nao pode custar o texto. Sem isto, uma foto solta fora da area
   * faz o navegador ABRIR a imagem na aba — e a biografia digitada e ainda nao
   * salva vai junto. O guard vale so enquanto o editor esta montado, entao
   * arrastar arquivo no resto do painel continua se comportando como sempre.
   */
  useEffect(() => {
    const engolir = (evento: DragEvent) => {
      if (evento.dataTransfer?.types.includes('Files')) evento.preventDefault();
    };
    window.addEventListener('dragover', engolir);
    window.addEventListener('drop', engolir);
    return () => {
      window.removeEventListener('dragover', engolir);
      window.removeEventListener('drop', engolir);
    };
  }, []);

  /**
   * Envia uma de cada vez, e nao em paralelo, de proposito: a posicao de cada
   * imagem e calculada a partir da ultima existente no servidor. Disparando
   * tudo junto, tres uploads leriam a mesma "ultima" e brigariam pela mesma
   * posicao — e posicao aqui decide quem e retrato, quem e o topo e a ordem no
   * texto. Sequencial, a ordem de chegada e a ordem em que foram soltas.
   */
  async function subir(arquivos: File[]) {
    setErro(null);

    const imagens = arquivos.filter((arquivo) => arquivo.type.startsWith('image/'));
    if (imagens.length === 0) {
      setErro('Solte um arquivo de imagem.');
      return;
    }
    if (imagens.length < arquivos.length) {
      setErro(`${arquivos.length - imagens.length} arquivo(s) ignorado(s): só imagem.`);
    }

    for (const [i, arquivo] of imagens.entries()) {
      setEnviando({ atual: i + 1, total: imagens.length });
      try {
        const imagem = await prepararCapa(arquivo, LARGURA_DA_FOTO);
        await adicionar.mutateAsync({ id: personagem.id, imagem });
      } catch (e) {
        setErro(
          e instanceof CoverError || e instanceof ApiError
            ? e.message
            : `Não foi possível enviar ${arquivo.name}`,
        );
        break;
      }
    }
    setEnviando(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl tracking-wide text-ink-100">{personagem.name}</h2>
        <p className="mt-1 text-xs text-ink-500">
          {personagem.comicCount} {personagem.comicCount === 1 ? 'edição' : 'edições'} no acervo ·
          /personagens/{personagem.slug}
        </p>
      </div>

      {erro && <ErrorNote>{erro}</ErrorNote>}

      <Field label="Resumo" hint="Uma linha, mostrada sob o nome.">
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} />
      </Field>

      <Field
        label="A história"
        hint="Parágrafos separados por linha em branco. As imagens entram entre eles."
      >
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={14}
          className="font-normal"
        />
      </Field>

      <Field
        label="Apelidos"
        hint="Separados por vírgula. Servem só para o nome virar link no texto: sem “Prime” aqui, uma descrição que o chame assim não vira link."
      >
        <Input value={aliases} onChange={(e) => setAliases(e.target.value)} />
      </Field>

      <section className="rounded-xl border border-ink-800 p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
          Estilo
        </h3>
        <p className="mb-4 text-xs text-ink-500">
          Entram só nos acentos — nome, filete, halo e os links do texto. O fundo continua o do
          site: pintar a página inteira cansa em dois parágrafos.
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <Field label="Cor 1">
            <input
              type="color"
              value={cor1}
              onChange={(e) => setCor1(e.target.value)}
              className="h-10 w-20 cursor-pointer rounded border border-ink-700 bg-ink-850"
            />
          </Field>
          <Field label="Cor 2">
            <input
              type="color"
              value={cor2}
              onChange={(e) => setCor2(e.target.value)}
              className="h-10 w-20 cursor-pointer rounded border border-ink-700 bg-ink-850"
            />
          </Field>
          <Field label="Fonte do nome">
            <Select value={fonte} onChange={(e) => setFonte(e.target.value as CharacterFont)}>
              {Object.entries(FONTES).map(([chave, { nome }]) => (
                <option key={chave} value={chave}>
                  {nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Previa com as variaveis aplicadas: escolher cor no escuro sem ver o
            resultado e adivinhar duas vezes. */}
        <div
          className="personagem mt-4 rounded-lg bg-ink-950 px-4 py-5"
          style={
            {
              '--accent': cor1,
              '--accent-2': cor2,
              '--fonte-personagem': FONTES[fonte].familia,
            } as CSSProperties
          }
        >
          <p className="personagem-nome text-4xl leading-none tracking-wide">{personagem.name}</p>
          <div className="personagem-filete mt-3 h-1 w-20 rounded-full" />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={enviar} disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
        {ok && <span className="text-xs text-emerald-400">Salvo.</span>}
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
          Imagens
        </h3>
        <p className="mb-3 text-xs text-ink-500">
          Arraste as fotos para cá, ou clique. A ordem tem papel: a 1ª é o retrato (o círculo da
          lista, onde o rosto precisa caber num quadrado), a 2ª é a arte grande do topo e as
          seguintes entram no meio do texto, alternando os lados. Recorte com fundo transparente
          funciona melhor que foto em moldura.
        </p>

        <div
          onDragEnter={(e) => {
            if (e.dataTransfer.types.includes('Files')) setArrastes((n) => n + 1);
          }}
          onDragLeave={() => setArrastes((n) => Math.max(0, n - 1))}
          onDragOver={(e) => {
            // Sem isto o navegador abre a imagem numa aba e o drop nunca chega.
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => {
            e.preventDefault();
            setArrastes(0);
            const arquivos = [...e.dataTransfer.files];
            if (arquivos.length) void subir(arquivos);
          }}
          className={`flex flex-wrap gap-3 rounded-xl border-2 border-dashed p-3 transition-colors ${
            arrastes > 0 ? 'border-brand-500 bg-brand-500/5' : 'border-transparent'
          }`}
        >
          {personagem.images.map((imagem, i) => (
            <figure key={imagem.id} className="w-32">
              <img
                src={mediaUrl(imagem.url) ?? ''}
                alt=""
                className="h-32 w-32 rounded-lg border border-ink-800 object-cover"
              />
              <figcaption className="mt-1 flex items-center justify-between text-[11px] text-ink-500">
                <span>{i === 0 ? 'retrato' : i === 1 ? 'topo' : `no texto ${i - 1}`}</span>
                <button
                  type="button"
                  onClick={() => remover.mutate(imagem.id)}
                  className="text-accent-400 hover:underline"
                >
                  remover
                </button>
              </figcaption>
            </figure>
          ))}

          <label
            className={`grid h-32 w-32 cursor-pointer place-items-center rounded-lg border border-dashed px-2 text-center text-xs transition-colors ${
              arrastes > 0
                ? 'border-brand-500 text-brand-400'
                : 'border-ink-700 text-ink-400 hover:border-ink-500'
            }`}
          >
            {enviando
              ? `enviando ${enviando.atual} de ${enviando.total}...`
              : arrastes > 0
                ? 'solte aqui'
                : '+ imagem ou arraste'}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const arquivos = [...(e.target.files ?? [])];
                if (arquivos.length) void subir(arquivos);
                // Limpa para o mesmo arquivo poder ser escolhido de novo.
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
