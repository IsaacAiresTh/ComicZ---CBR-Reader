import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type {
  CharacterDetail,
  CharacterFont,
  CharacterImportReport,
  CharacterSummary,
  ComicSummary,
  ImportCharactersInput,
  MilestoneArtStyle,
  SeriesListItem,
} from '@comicz/shared';
import { IconDownload, IconExternal, IconSearch, IconUpload } from '../../components/icons';
import {
  Button,
  Chip,
  ErrorNote,
  Field,
  IconButton,
  Input,
  Select,
  Spinner,
  Textarea,
} from '../../components/ui';
import { AdminHeader } from './AdminHeader';
import { BarraDeSalvar, SalvarTudoProvider, useSecao } from './SalvarTudo';
import { CoverError, prepararCapa } from '../../lib/cover';
import { comicLabel } from '../../lib/format';
import { ApiError, mediaUrl } from '../../services/api';
import { useCharacter, useCharacters, useSeriesList } from '../comics/queries';
import { FONTES } from '../characters/estilo';

/** Sem acento e em minuscula, para a busca do painel achar "Perpetua". */
function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
import {
  useAddCharacterImage,
  useBuscarSaga,
  useImportCharacters,
  useRemoveCharacterImage,
  useReorderCharacterImages,
  useSeriesDetail,
  useSetCharacterComics,
  useSetMilestones,
  useSetSeriesNotes,
  useUpdateCharacter,
} from './queries';

/** A foto ocupa a coluna inteira do texto; 500px como a capa sairia borrada. */
const LARGURA_DA_FOTO = 900;

export function AdminCharactersPage() {
  const { data: personagens, isLoading } = useCharacters();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  /*
   * O import e um MODO, e nao a tela vazia: com um personagem aberto a tela
   * vazia nao existe mais, e o botao sumia justo depois de alguem escolher
   * alguem — que e quando se percebe que era mais rapido subir um arquivo.
   */
  const [importando, setImportando] = useState(false);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<'edicoes' | 'nome'>('edicoes');
  const [soIncompletos, setSoIncompletos] = useState(false);

  /*
   * A lista inteira, sem teto. Antes eu cortava em 60 e quem quisesse o 61º era
   * obrigado a saber o nome para buscar — o que inverte o papel de uma lista.
   * Sao 189 nomes curtos numa coluna que ja rola; o custo e nenhum.
   */
  const lista = useMemo(() => {
    const termo = normalizar(busca.trim());
    const todos = personagens ?? [];
    const filtrados = todos.filter(
      (p) =>
        (!termo || normalizar(p.name).includes(termo)) &&
        (!soIncompletos || !p.summary || !p.portraitUrl),
    );
    return [...filtrados].sort((a, b) =>
      ordem === 'nome'
        ? a.name.localeCompare(b.name, 'pt-BR')
        : b.comicCount - a.comicCount || a.name.localeCompare(b.name, 'pt-BR'),
    );
  }, [personagens, busca, ordem, soIncompletos]);

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Personagens"
        count={`${(personagens ?? []).length} personagens`}
        actions={
          <Button variant="secondary" onClick={() => setImportando(true)}>
            <IconUpload />
            Importar fichas
          </Button>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3 lg:sticky lg:top-6">
          <label className="flex h-10 items-center gap-2 rounded-[10px] border border-ink-700 bg-ink-850 px-3 text-ink-400 focus-within:border-brand-500">
            <IconSearch className="shrink-0" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar personagem"
              aria-label="Buscar personagem"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
            />
          </label>

          <div className="flex items-center gap-1.5">
            <Chip active={!soIncompletos} onClick={() => setSoIncompletos(false)}>
              Todos
            </Chip>
            <Chip active={soIncompletos} onClick={() => setSoIncompletos(true)}>
              Incompletos
            </Chip>
            <button
              type="button"
              onClick={() => setOrdem((atual) => (atual === 'edicoes' ? 'nome' : 'edicoes'))}
              className="ml-auto text-xs text-ink-400 hover:text-ink-100"
            >
              {ordem === 'edicoes' ? 'por edições' : 'A–Z'}
            </button>
          </div>

          <p className="text-xs text-ink-500">
            {lista.length === (personagens ?? []).length
              ? `${lista.length} personagens`
              : `${lista.length} de ${(personagens ?? []).length}`}{' '}
            · os tracinhos dizem se tem resumo, imagem e tags
          </p>
          <ul className="max-h-[68vh] space-y-0.5 overflow-y-auto pr-1">
            {lista.map((personagem) => (
              <li key={personagem.id}>
                <ItemDaLista
                  personagem={personagem}
                  ativo={personagem.slug === escolhido}
                  onEscolher={() => {
                    setEscolhido(personagem.slug);
                    setImportando(false);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>

        {importando || !escolhido ? (
          <div className="space-y-4">
            {!escolhido && !importando && (
              <p className="rounded-xl border border-dashed border-ink-700 px-6 py-8 text-center text-sm text-ink-400">
                Escolha um personagem para escrever a história dele — ou suba um arquivo.
              </p>
            )}
            <ImportarFichas onFechar={escolhido ? () => setImportando(false) : undefined} />
          </div>
        ) : (
          <Editor slug={escolhido} />
        )}
      </div>
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
  // O que da para saber sem abrir a ficha: resumo, imagem e tags.
  const partes = [Boolean(personagem.summary), Boolean(retrato), personagem.tags.length > 0];
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-current={ativo ? 'true' : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
        ativo
          ? 'bg-ink-800 text-ink-100 shadow-[inset_3px_0_0_var(--color-brand-500)]'
          : 'text-ink-300 hover:bg-ink-850'
      }`}
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full font-display text-base text-ink-950"
        style={{ backgroundColor: personagem.accentColor ?? 'var(--color-ink-700)' }}
      >
        {retrato ? (
          <img src={retrato} alt="" className="h-full w-full object-cover" />
        ) : (
          personagem.name.slice(0, 1)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{personagem.name}</span>
        <span
          className="mt-1 flex gap-0.5"
          aria-label={`${partes.filter(Boolean).length} de 3 preenchidos`}
        >
          {partes.map((ok, i) => (
            <span
              key={i}
              className={`h-1 w-3.5 rounded-sm ${ok ? 'bg-emerald-400' : 'bg-ink-700'}`}
            />
          ))}
        </span>
      </span>
      <span className="text-[11px] text-ink-500">{personagem.comicCount}</span>
    </button>
  );
}

/**
 * A ficha no formato do arquivo.
 *
 * O que sai daqui e exatamente o que o import aceita, e e de proposito: o ciclo
 * util e baixar, editar fora e subir de volta. Saga vai por NOME, e nao por id,
 * porque id de saga nao atravessa ambiente — e atravessar ambiente (escrever no
 * local, subir em producao) e o motivo de existir o arquivo.
 */
function fichaParaArquivo(personagem: CharacterDetail) {
  return {
    slug: personagem.slug,
    ficha: {
      summary: personagem.summary,
      description: personagem.description,
      aliases: personagem.aliases,
      accentColor: personagem.accentColor,
      accentColor2: personagem.accentColor2,
      displayFont: personagem.displayFont,
      tags: personagem.tags,
      firstAppearance: personagem.firstAppearance,
      firstAppearanceYear: personagem.firstAppearanceYear,
      affiliations: personagem.affiliations,
      powers: personagem.powers,
      powerLevel: personagem.powerLevel,
      powerLevelRank: personagem.powerLevelRank,
      status: personagem.status,
      statusNote: personagem.statusNote,
      primer: personagem.primer,
      whyMatters: personagem.whyMatters,
    },
    comecarPor: personagem.startHere
      ? { saga: personagem.startHere.name, nota: personagem.startHere.note }
      : null,
    marcos: personagem.milestones.map((marco) => ({
      era: marco.era,
      headline: marco.headline,
      body: marco.body,
      spoiler: marco.spoiler,
      sourceLabel: marco.sourceLabel,
    })),
    sagas: personagem.appearances
      .filter((grupo) => grupo.seriesId)
      .map((grupo) => ({ saga: grupo.name, nota: grupo.note })),
  };
}

function BotaoDeExportar({ personagem }: { personagem: CharacterDetail }) {
  function baixar() {
    const conteudo = JSON.stringify([fichaParaArquivo(personagem)], null, 2);
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${personagem.slug}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <IconButton
      label="Baixar a ficha em JSON (o formato que o import aceita)"
      small
      onClick={baixar}
    >
      <IconDownload />
    </IconButton>
  );
}

/**
 * Import de fichas por arquivo.
 *
 * O arquivo e um ARRAY de fichas — uma so e um array de um. Nao ha dois
 * formatos nem duas rotas, entao subir os 189 e o mesmo caminho de subir um.
 * Um objeto solto tambem passa: e o que sai do "baixar JSON" de uma ficha, e
 * seria estranho ele nao voltar.
 *
 * Nada e gravado antes da previa. O servidor roda o import inteiro em modo
 * simulacao e devolve, personagem a personagem, o que entraria — e como e o
 * MESMO codigo da gravacao, a previa nao tem como prometer o que o import nao
 * faz. So depois dela aparece o botao que grava.
 */
function ImportarFichas({
  personagem,
  onFechar,
}: {
  /**
   * Quando vem, ELE manda: o slug do arquivo e substituido pelo dele.
   *
   * Saber o slug era um pre-requisito escondido — "illyana-rasputina", na
   * grafia da Marvel, contra "ilyana-rasputina" no acervo derruba o import
   * inteiro por uma letra. Nao e quem escreve a ficha que tem que descobrir
   * como o banco chama o personagem; escolhendo antes, a pergunta some.
   */
  personagem?: CharacterDetail;
  onFechar?: () => void;
}) {
  const importar = useImportCharacters();
  const [trocaDeSlug, setTrocaDeSlug] = useState<string | null>(null);
  const [sobrando, setSobrando] = useState(0);
  const [fichas, setFichas] = useState<ImportCharactersInput['personagens'] | null>(null);
  const [rotulo, setRotulo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<CharacterImportReport[] | null>(null);
  const [gravado, setGravado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Contador, e nao booleano: entrar num filho dispara dragleave no pai.
  const [arrastes, setArrastes] = useState(0);

  async function ler(arquivo: File) {
    setErro(null);
    setPrevia(null);
    setGravado(false);
    setFichas(null);
    setRotulo(null);
    setTrocaDeSlug(null);
    setSobrando(0);
    try {
      const bruto: unknown = JSON.parse(await arquivo.text());
      const lida = (Array.isArray(bruto) ? bruto : [bruto]) as ImportCharactersInput['personagens'];
      const primeira = lida[0];
      if (!primeira) {
        setErro('O arquivo não tem nenhuma ficha.');
        return;
      }

      let lista = lida;
      if (personagem) {
        if (primeira.slug && primeira.slug !== personagem.slug) setTrocaDeSlug(primeira.slug);
        // Numa ficha especifica so a primeira entra: as outras iriam para o
        // personagem errado, que e o oposto de ter escolhido antes.
        setSobrando(lida.length - 1);
        lista = [{ ...primeira, slug: personagem.slug }];
      }

      setFichas(lista);
      setRotulo(`${arquivo.name} — ${lista.length} ${lista.length === 1 ? 'ficha' : 'fichas'}`);
      setPrevia(await importar.mutateAsync({ personagens: lista, simular: true }));
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.message
          : e instanceof SyntaxError
            ? 'O arquivo não é um JSON válido.'
            : 'Não foi possível ler o arquivo.',
      );
    }
  }

  async function gravar() {
    if (!fichas) return;
    setErro(null);
    try {
      setPrevia(await importar.mutateAsync({ personagens: fichas, simular: false }));
      setGravado(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível gravar o import.');
    }
  }

  const validos = previa?.filter((linha) => !linha.erro).length ?? 0;

  return (
    <section className="rounded-xl border border-ink-800 p-4">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
          Importar fichas
        </h3>
        {onFechar && (
          <button
            type="button"
            onClick={onFechar}
            className="text-xs text-ink-400 transition-colors hover:text-ink-100"
          >
            voltar para a ficha
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-ink-500">
        {personagem ? (
          <>
            O arquivo vai para <strong className="text-ink-300">{personagem.name}</strong>, que você
            escolheu aqui — o <code>slug</code> que estiver dentro dele é ignorado. Campo presente
            grava por cima, campo ausente não é tocado, <code>null</code> limpa.
          </>
        ) : (
          <>
            Um JSON com uma ficha ou com várias, cada uma com o <code>slug</code> do personagem.
            Campo presente grava por cima, campo ausente não é tocado, <code>null</code> limpa.
            Vínculo de edição não entra aqui; isso continua saindo de “Onde aparece”.
          </>
        )}
      </p>

      {personagem && (
        <p className="mb-4 text-xs text-ink-500">
          Não sabe o formato? Use o <strong className="text-ink-300">baixar JSON</strong> aí em
          cima: ele sai com os nomes de saga exatamente como o acervo os tem.
        </p>
      )}

      <label
        onDragEnter={(e) => {
          e.preventDefault();
          setArrastes((n) => n + 1);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setArrastes((n) => Math.max(0, n - 1))}
        onDrop={(e) => {
          e.preventDefault();
          setArrastes(0);
          const arquivo = e.dataTransfer.files[0];
          if (arquivo) void ler(arquivo);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center text-sm transition-colors ${
          arrastes > 0
            ? 'border-brand-500 text-ink-100'
            : 'border-ink-700 text-ink-400 hover:border-ink-500'
        }`}
      >
        {importar.isPending && !gravado
          ? 'conferindo...'
          : (rotulo ?? 'Solte o JSON aqui, ou clique para escolher')}
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void ler(arquivo);
            e.target.value = '';
          }}
        />
      </label>

      {trocaDeSlug && personagem && (
        <p className="mt-3 text-xs text-amber-400">
          O arquivo dizia <code>{trocaDeSlug}</code>; vai para <strong>{personagem.name}</strong> (
          <code>{personagem.slug}</code>).
        </p>
      )}
      {sobrando > 0 && (
        <p className="mt-2 text-xs text-amber-400">
          O arquivo tem mais {sobrando} {sobrando === 1 ? 'ficha' : 'fichas'} — só a primeira entra
          aqui. Para as outras, use o “importar JSON” da lista.
        </p>
      )}

      {erro && (
        <div className="mt-3">
          <ErrorNote>{erro}</ErrorNote>
        </div>
      )}

      {previa && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-ink-500">
            {gravado ? 'Gravado:' : 'Prévia — nada foi gravado ainda:'}
          </p>
          <ul className="space-y-1">
            {previa.map((linha) => (
              <LinhaDoRelatorio key={linha.slug} linha={linha} />
            ))}
          </ul>

          {!gravado && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => void gravar()} disabled={importar.isPending || validos === 0}>
                {importar.isPending
                  ? 'Gravando...'
                  : `Gravar ${validos} ${validos === 1 ? 'ficha' : 'fichas'}`}
              </Button>
              {validos === 0 && (
                <span className="text-xs text-ink-500">Nenhuma ficha do arquivo pode entrar.</span>
              )}
            </div>
          )}
          {gravado && <p className="mt-3 text-xs text-emerald-400">Pronto.</p>}
        </div>
      )}
    </section>
  );
}

function LinhaDoRelatorio({ linha }: { linha: CharacterImportReport }) {
  if (linha.erro) {
    return (
      <li className="rounded border border-rose-500/40 px-3 py-2 text-sm">
        <span className="text-ink-200">{linha.slug}</span>{' '}
        <span className="text-rose-400">— {linha.erro}</span>
        {linha.sugestao && (
          <p className="mt-0.5 text-xs text-ink-400">
            O mais parecido no acervo é <code className="text-ink-200">{linha.sugestao}</code>.
          </p>
        )}
      </li>
    );
  }

  const partes = [`${linha.campos.length} campos`];
  if (linha.marcos !== null) partes.push(`${linha.marcos} marcos`);
  if (linha.sagas !== null) partes.push(`${linha.sagas} sagas`);
  if (linha.ancorasMantidas > 0) partes.push(`${linha.ancorasMantidas} âncoras mantidas`);

  return (
    <li className="rounded border border-ink-800 px-3 py-2 text-sm">
      <span className="text-ink-100">{linha.name}</span>{' '}
      <span className="text-xs text-ink-400">— {partes.join(' · ')}</span>
      {linha.sagasAusentes.length > 0 && (
        <>
          <p className="mt-0.5 text-xs text-amber-400">
            saga não encontrada entre as aparições dele: {linha.sagasAusentes.join(', ')}
          </p>
          {linha.sagasDisponiveis.length > 0 && (
            <p className="mt-0.5 text-xs text-ink-500">
              as que ele tem: {linha.sagasDisponiveis.join(' · ')}
            </p>
          )}
        </>
      )}
    </li>
  );
}

function Editor({ slug }: { slug: string }) {
  const { data: personagem, isLoading } = useCharacter(slug);
  // Descartar remonta o formulario, que volta a ler tudo do servidor.
  const [versao, setVersao] = useState(0);
  if (isLoading || !personagem) return <Spinner />;
  return (
    <div className="min-w-0">
      <SalvarTudoProvider key={`${personagem.id}-${versao}`}>
        <Formulario personagem={personagem} />
        <BarraDeSalvar onDescartar={() => setVersao((v) => v + 1)} />
      </SalvarTudoProvider>
    </div>
  );
}

type AbaDoEditor = 'ficha' | 'imagens' | 'marcos' | 'aparicoes' | 'estilo';

function Formulario({ personagem }: { personagem: CharacterDetail }) {
  const salvar = useUpdateCharacter();
  const adicionar = useAddCharacterImage();
  const remover = useRemoveCharacterImage();
  const reordenar = useReorderCharacterImages();

  const [summary, setSummary] = useState(personagem.summary ?? '');
  const [description, setDescription] = useState(personagem.description ?? '');
  const [aliases, setAliases] = useState(personagem.aliases.join(', '));
  const [tags, setTags] = useState(personagem.tags.join(', '));
  const [estreia, setEstreia] = useState(personagem.firstAppearance ?? '');
  const [ano, setAno] = useState(personagem.firstAppearanceYear?.toString() ?? '');
  const [afiliacoes, setAfiliacoes] = useState(personagem.affiliations.join(', '));
  const [poderes, setPoderes] = useState(personagem.powers.join(', '));
  const [nivelTexto, setNivelTexto] = useState(personagem.powerLevel ?? '');
  const [nivel, setNivel] = useState<number | null>(personagem.powerLevelRank);
  const [status, setStatus] = useState(personagem.status ?? '');
  const [statusNota, setStatusNota] = useState(personagem.statusNote ?? '');
  const [primer, setPrimer] = useState(personagem.primer ?? '');
  const [porQueImporta, setPorQueImporta] = useState(personagem.whyMatters ?? '');
  const [comecarPor, setComecarPor] = useState(personagem.startHere?.seriesId ?? '');
  const [comecarNota, setComecarNota] = useState(personagem.startHere?.note ?? '');
  const [cor1, setCor1] = useState(personagem.accentColor ?? '#f5b301');
  const [cor2, setCor2] = useState(personagem.accentColor2 ?? '#f5b301');
  const [fonte, setFonte] = useState<CharacterFont>(personagem.displayFont ?? 'bangers');
  const [erro, setErro] = useState<string | null>(null);
  const [subindoJson, setSubindoJson] = useState(false);
  const [enviando, setEnviando] = useState<{ atual: number; total: number } | null>(null);
  /*
   * Contador, e nao booleano: dragleave dispara toda vez que o ponteiro passa
   * de um filho para outro dentro da area, e com booleano a moldura piscaria a
   * cada miniatura por baixo do cursor.
   */
  const [arrastes, setArrastes] = useState(0);

  const [aba, setAba] = useState<AbaDoEditor>('ficha');

  function dados() {
    return {
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
      tags: emLista(tags),
      firstAppearance: estreia.trim() || null,
      firstAppearanceYear: ano.trim() ? Number(ano) : null,
      affiliations: emLista(afiliacoes),
      powers: emLista(poderes),
      powerLevel: nivelTexto.trim() || null,
      powerLevelRank: nivel,
      status: status.trim() || null,
      statusNote: statusNota.trim() || null,
      primer: primer.trim() || null,
      whyMatters: porQueImporta.trim() || null,
      startHereSeriesId: comecarPor || null,
      startHereNote: comecarNota.trim() || null,
    };
  }

  /*
   * "Sujo" e o que difere do que foi lido (ou gravado por ultimo). Comparar o
   * payload, e nao campo a campo, garante que a barra so acende quando o
   * Salvar de fato mandaria algo diferente.
   */
  const atual = JSON.stringify(dados());
  const [base, setBase] = useState(atual);

  async function enviar(): Promise<boolean> {
    setErro(null);
    try {
      await salvar.mutateAsync({ id: personagem.id, dados: dados() });
      setBase(atual);
      return true;
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar');
      return false;
    }
  }

  useSecao('ficha', 'Ficha e estilo', atual !== base, enviar);

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

  /**
   * Troca de lugar com a vizinha e manda a lista inteira.
   *
   * Trocar com a vizinha, e nao "mover para o inicio": duas trocas ja levam
   * qualquer foto ao retrato, e o movimento e reversivel na hora — clicar a
   * seta oposta desfaz. Com "mover para o inicio" nao existe o desfazer, e a
   * ordem das outras muda sem que ninguem tenha pedido.
   */
  function trocar(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= personagem.images.length) return;

    const ordem = personagem.images.map((imagem) => imagem.id);
    const atual = ordem[indice];
    const vizinho = ordem[alvo];
    if (!atual || !vizinho) return;
    ordem[indice] = vizinho;
    ordem[alvo] = atual;

    reordenar.mutate(
      { id: personagem.id, ids: ordem },
      { onError: () => setErro('Não foi possível mudar a ordem') },
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4 border-b border-ink-800">
        <div className="flex flex-wrap items-center gap-3.5">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 font-display text-xl text-ink-950"
            style={{ borderColor: cor2, backgroundColor: cor1 }}
          >
            {mediaUrl(personagem.portraitUrl) ? (
              <img
                src={mediaUrl(personagem.portraitUrl) ?? ''}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              personagem.name.slice(0, 1)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-3xl leading-none tracking-wide text-ink-100">
              {personagem.name}
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              {personagem.comicCount} {personagem.comicCount === 1 ? 'edição' : 'edições'} no acervo
              · /personagens/{personagem.slug}
            </p>
          </div>
          <Link
            to={`/personagens/${personagem.slug}`}
            target="_blank"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-ink-600 px-3.5 text-[13px] font-semibold text-ink-100 hover:border-ink-500"
          >
            Ver página <IconExternal />
          </Link>
          <BotaoDeExportar personagem={personagem} />
          <IconButton
            label="Subir ficha em JSON"
            small
            active={subindoJson}
            onClick={() => setSubindoJson((valor) => !valor)}
          >
            <IconUpload />
          </IconButton>
        </div>
        {/*
          Abas no lugar de uma pagina com seis formularios empilhados. As que
          nao estao a vista continuam montadas (so escondidas), para nenhuma
          alteracao pendente se perder ao trocar de aba.
        */}
        <nav role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {(
            [
              ['ficha', 'Ficha', undefined],
              ['imagens', 'Imagens', String(personagem.images.length)],
              ['marcos', 'Marcos', String(personagem.milestones.length)],
              ['aparicoes', 'Onde aparece', String(personagem.appearances.length)],
              ['estilo', 'Estilo', undefined],
            ] as [AbaDoEditor, string, string | undefined][]
          ).map(([id, rotulo, conta]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className={`min-h-10 shrink-0 px-3.5 text-sm ${
                aba === id
                  ? 'font-bold text-ink-100 shadow-[inset_0_-2px_0_var(--color-brand-500)]'
                  : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {rotulo} {conta && <span className="text-xs text-ink-500">{conta}</span>}
            </button>
          ))}
        </nav>
      </header>

      {subindoJson && (
        <ImportarFichas personagem={personagem} onFechar={() => setSubindoJson(false)} />
      )}

      {erro && <ErrorNote>{erro}</ErrorNote>}

      <div hidden={aba !== 'ficha'} className="space-y-6">
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

        <Field label="Tags" hint="Separadas por vírgula. Aparecem sob o resumo, no topo.">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>

        <section className="rounded-xl border border-ink-800 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
            A ficha
          </h3>
          <p className="mb-4 text-xs text-ink-500">
            Cada campo some da página quando fica vazio — meia ficha é informação, ficha vazia é
            ruído. Não precisa preencher tudo.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primeira aparição">
              <Input
                value={estreia}
                onChange={(e) => setEstreia(e.target.value)}
                placeholder="DC Comics Presents #87"
              />
            </Field>
            <Field label="Ano">
              <Input
                value={ano}
                onChange={(e) => setAno(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1985"
                inputMode="numeric"
              />
            </Field>

            <Field label="Afiliações" hint="A primeira aparece em destaque; as outras, apagadas.">
              <Input value={afiliacoes} onChange={(e) => setAfiliacoes(e.target.value)} />
            </Field>
            <Field label="Poderes" hint="Viram chips, separados por vírgula.">
              <Input value={poderes} onChange={(e) => setPoderes(e.target.value)} />
            </Field>

            <Field label="Status atual">
              <Input value={status} onChange={(e) => setStatus(e.target.value)} />
            </Field>
            <Field label="Ressalva do status" hint="A segunda linha: “pós-Death Metal”.">
              <Input value={statusNota} onChange={(e) => setStatusNota(e.target.value)} />
            </Field>

            <Field label="Nível de poder" hint="O rótulo: “Classe multiversal”.">
              <Input value={nivelTexto} onChange={(e) => setNivelTexto(e.target.value)} />
            </Field>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink-300">A barra</span>
              <BarraEditavel nivel={nivel} onEscolher={setNivel} />
              <span className="mt-1 block text-xs text-ink-500">
                {nivel
                  ? `${nivel} de 5 — clique no mesmo degrau para tirar a barra.`
                  : 'Sem barra. Clique num degrau para dar um nível.'}
              </span>
            </div>
          </div>
        </section>

        <Field
          label="Se é sua primeira vez"
          hint="Três frases para quem nunca leu o personagem. Aparece antes da história."
        >
          <Textarea value={primer} onChange={(e) => setPrimer(e.target.value)} rows={4} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Se só for ler uma coisa" hint="Entre as sagas em que ele aparece.">
            <Select value={comecarPor} onChange={(e) => setComecarPor(e.target.value)}>
              <option value="">Nenhuma</option>
              {personagem.appearances
                .filter((grupo) => grupo.seriesId)
                .map((grupo) => (
                  <option key={grupo.seriesId} value={grupo.seriesId ?? ''}>
                    {grupo.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Por que essa" hint="“é aqui que ele se torna o vilão”.">
            <Input value={comecarNota} onChange={(e) => setComecarNota(e.target.value)} />
          </Field>
        </div>

        <Field label="Por que ele importa" hint="O fecho da página, depois da história.">
          <Textarea
            value={porQueImporta}
            onChange={(e) => setPorQueImporta(e.target.value)}
            rows={4}
          />
        </Field>
      </div>

      <section hidden={aba !== 'estilo'} className="rounded-xl border border-ink-800 p-4">
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

      <section hidden={aba !== 'imagens'}>
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
              <figcaption className="mt-1 space-y-1 text-[11px] text-ink-500">
                <div className="flex items-center justify-between">
                  <span>{i === 0 ? 'retrato' : i === 1 ? 'topo' : `no texto ${i - 1}`}</span>
                  <button
                    type="button"
                    onClick={() => remover.mutate(imagem.id)}
                    className="text-accent-400 hover:underline"
                  >
                    remover
                  </button>
                </div>
                <div className="flex gap-1">
                  <SetaDeOrdem
                    direcao="esquerda"
                    desabilitada={i === 0 || reordenar.isPending}
                    onClick={() => trocar(i, -1)}
                  />
                  <SetaDeOrdem
                    direcao="direita"
                    desabilitada={i === personagem.images.length - 1 || reordenar.isPending}
                    onClick={() => trocar(i, 1)}
                  />
                </div>
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

      <div hidden={aba !== 'marcos'}>
        <EditorDeMarcos personagem={personagem} />
      </div>
      <div hidden={aba !== 'aparicoes'}>
        <EditorDeAparicoes personagem={personagem} />
      </div>
    </div>
  );
}

interface MarcoEmEdicao {
  era: string;
  headline: string;
  body: string;
  spoiler: boolean;
  imageId: string | null;
  sourceLabel: string;
  artStyle: MilestoneArtStyle | null;
}

/**
 * A linha do tempo.
 *
 * O estado e local e so vai para o servidor no "Salvar": editar seis marcos
 * salvando a cada tecla seria seis requisicoes por palavra. A lista sobe
 * inteira, entao a posicao e o indice do array e nao existe estado intermediario
 * com dois marcos disputando o mesmo lugar.
 */
function EditorDeMarcos({ personagem }: { personagem: CharacterDetail }) {
  const salvar = useSetMilestones();
  const [marcos, setMarcos] = useState<MarcoEmEdicao[]>(() =>
    personagem.milestones.map((marco) => ({
      era: marco.era,
      headline: marco.headline ?? '',
      body: marco.body,
      spoiler: marco.spoiler,
      imageId: personagem.images.find((imagem) => imagem.url === marco.imageUrl)?.id ?? null,
      sourceLabel: marco.sourceLabel ?? '',
      artStyle: marco.artStyle,
    })),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function altera(indice: number, mudanca: Partial<MarcoEmEdicao>) {
    setMarcos((atual) =>
      atual.map((marco, i) => (i === indice ? { ...marco, ...mudanca } : marco)),
    );
  }

  function move(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= marcos.length) return;
    const copia = [...marcos];
    const atual = copia[indice];
    const vizinho = copia[alvo];
    if (!atual || !vizinho) return;
    copia[indice] = vizinho;
    copia[alvo] = atual;
    setMarcos(copia);
  }

  const atual = JSON.stringify(marcos);
  const [base, setBase] = useState(atual);

  async function enviar(): Promise<boolean> {
    setErro(null);
    setOk(false);
    if (marcos.some((marco) => !marco.era.trim() || !marco.body.trim())) {
      setErro('Todo marco precisa de era e texto.');
      return false;
    }
    try {
      await salvar.mutateAsync({
        id: personagem.id,
        marcos: marcos.map((marco) => ({
          era: marco.era.trim(),
          headline: marco.headline.trim() || null,
          body: marco.body.trim(),
          spoiler: marco.spoiler,
          imageId: marco.imageId,
          sourceLabel: marco.sourceLabel.trim() || null,
          artStyle: marco.imageId ? marco.artStyle : null,
        })),
      });
      setBase(atual);
      setOk(true);
      return true;
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar a linha do tempo');
      return false;
    }
  }

  useSecao('marcos', 'Marcos', atual !== base, enviar);

  return (
    <section className="rounded-xl border border-ink-800 p-4">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
        A história, em marcos
      </h3>
      <p className="mb-4 text-xs text-ink-500">
        Sem nenhum marco, a página mostra o texto corrido da descrição — ninguém perde o que já
        escreveu. Com marcos, eles substituem esse texto.
      </p>

      {erro && <ErrorNote>{erro}</ErrorNote>}

      <div className="space-y-4">
        {marcos.map((marco, i) => (
          <div key={i} className="rounded-lg border border-ink-800 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs tabular-nums text-ink-500">
                {String(i + 1).padStart(2, '0')}
              </span>
              <Input
                value={marco.era}
                onChange={(e) => altera(i, { era: e.target.value })}
                placeholder="Era — vira o chip do índice"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="h-8 w-8 rounded border border-ink-700 text-ink-300 disabled:border-ink-800 disabled:text-ink-700"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === marcos.length - 1}
                className="h-8 w-8 rounded border border-ink-700 text-ink-300 disabled:border-ink-800 disabled:text-ink-700"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setMarcos((atual) => atual.filter((_, j) => j !== i))}
                className="px-2 text-xs text-accent-400 hover:underline"
              >
                remover
              </button>
            </div>

            <Input
              value={marco.headline}
              onChange={(e) => altera(i, { headline: e.target.value })}
              placeholder="A frase de efeito (opcional)"
              className="mb-2"
            />
            <Textarea
              value={marco.body}
              onChange={(e) => altera(i, { body: e.target.value })}
              rows={5}
              placeholder="O texto do marco. Parágrafos separados por linha em branco."
            />

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Select
                className="w-auto"
                value={marco.imageId ?? ''}
                onChange={(e) => altera(i, { imageId: e.target.value || null })}
              >
                <option value="">Sem imagem</option>
                {personagem.images.map((imagem, j) => (
                  <option key={imagem.id} value={imagem.id}>
                    Imagem {j + 1}
                    {j === 0 ? ' (retrato)' : j === 1 ? ' (topo)' : ''}
                  </option>
                ))}
              </Select>

              <SeletorDeMoldura
                valor={marco.artStyle}
                desabilitado={!marco.imageId}
                onEscolher={(artStyle) => altera(i, { artStyle })}
              />

              <Input
                value={marco.sourceLabel}
                onChange={(e) => altera(i, { sourceLabel: e.target.value })}
                placeholder="De onde veio a arte: “Crise Infinita #1”"
                className="min-w-48 flex-1"
              />

              <label className="flex items-center gap-2 text-xs text-ink-300">
                <input
                  type="checkbox"
                  checked={marco.spoiler}
                  onChange={(e) => altera(i, { spoiler: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-850"
                />
                spoiler
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          onClick={() =>
            setMarcos((atual) => [
              ...atual,
              {
                era: '',
                headline: '',
                body: '',
                spoiler: false,
                imageId: null,
                sourceLabel: '',
                artStyle: null,
              },
            ])
          }
        >
          + marco
        </Button>
        {ok && <span className="text-xs text-emerald-400">Linha do tempo salva.</span>}
      </div>
    </section>
  );
}

interface SagaEmEdicao {
  seriesId: string;
  name: string;
  note: string;
  /** As edicoes marcadas. E delas que sai o vinculo — a saga em si nao e gravada. */
  edicoes: string[];
}

/**
 * "Onde aparece": quais sagas entram, em que ordem, e o porque de cada uma.
 *
 * O vinculo entre personagem e edicao nasceu do metadado dos arquivos, e erra
 * em bloco: uma saga inteira herda o elenco da primeira edicao e o personagem
 * passa a "aparecer" onde nunca esteve. Por isso a unidade daqui e a SAGA, que
 * e como o erro chega e como a pagina mostra; quem precisar de precisao abre a
 * saga e desmarca edicao por edicao.
 *
 * Salvar manda o CONJUNTO inteiro de edicoes, e nao "tire esta, ponha aquela":
 * o que fica gravado e exatamente o que estava na tela.
 */
function EditorDeAparicoes({ personagem }: { personagem: CharacterDetail }) {
  const salvarEdicoes = useSetCharacterComics();
  const salvarNotas = useSetSeriesNotes();
  const buscarSaga = useBuscarSaga();
  const { data: catalogo } = useSeriesList();

  const [sagas, setSagas] = useState<SagaEmEdicao[]>(() =>
    personagem.appearances.flatMap((grupo) =>
      grupo.seriesId
        ? [
            {
              seriesId: grupo.seriesId,
              name: grupo.name,
              note: grupo.note ?? '',
              edicoes: grupo.comics.map((comic) => comic.id),
            },
          ]
        : [],
    ),
  );

  /*
   * As edicoes sem saga nao tem linha aqui, mas fazem parte do conjunto que
   * sobe no Salvar: esquecer delas seria apaga-las sem ninguem pedir. Da para
   * tirar uma; para ACRESCENTAR uma avulsa, o caminho e a pagina da HQ, onde o
   * elenco se edita do outro lado do vinculo.
   */
  const [avulsas, setAvulsas] = useState<ComicSummary[]>(
    () => personagem.appearances.find((grupo) => !grupo.seriesId)?.comics ?? [],
  );

  const [aberta, setAberta] = useState<string | null>(null);
  const [termo, setTermo] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const sugestoes = useMemo(() => {
    const busca = normalizar(termo.trim());
    if (!busca) return [];
    const presentes = new Set(sagas.map((saga) => saga.seriesId));
    return (catalogo ?? [])
      .filter((serie) => !presentes.has(serie.id) && normalizar(serie.name).includes(busca))
      .slice(0, 8);
  }, [catalogo, sagas, termo]);

  function move(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= sagas.length) return;
    const copia = [...sagas];
    const atual = copia[indice];
    const vizinho = copia[alvo];
    if (!atual || !vizinho) return;
    copia[indice] = vizinho;
    copia[alvo] = atual;
    setSagas(copia);
  }

  function altera(seriesId: string, mudanca: Partial<SagaEmEdicao>) {
    setSagas((atual) =>
      atual.map((saga) => (saga.seriesId === seriesId ? { ...saga, ...mudanca } : saga)),
    );
  }

  /** Entra com TODAS as edicoes marcadas, e ja aberta: desmarcar fica a um clique. */
  async function adiciona(serie: SeriesListItem) {
    setErro(null);
    setOk(false);
    setAdicionando(true);
    try {
      const detalhe = await buscarSaga(serie.id);
      setSagas((atual) => [
        ...atual,
        {
          seriesId: serie.id,
          name: serie.name,
          note: '',
          edicoes: detalhe.comics.map((comic) => comic.id),
        },
      ]);
      setAberta(serie.id);
      setTermo('');
    } catch {
      setErro('Não foi possível carregar as edições dessa saga.');
    } finally {
      setAdicionando(false);
    }
  }

  const total = sagas.reduce((soma, saga) => soma + saga.edicoes.length, 0) + avulsas.length;
  const salvando = salvarEdicoes.isPending || salvarNotas.isPending;

  const estado = (lista: SagaEmEdicao[], soltas: ComicSummary[]) =>
    JSON.stringify({
      sagas: lista.map((saga) => [saga.seriesId, saga.note, saga.edicoes]),
      avulsas: soltas.map((comic) => comic.id),
    });
  const atual = estado(sagas, avulsas);
  const [base, setBase] = useState(atual);

  async function enviar(): Promise<boolean> {
    setErro(null);
    setOk(false);
    // Saga sem nenhuma edicao marcada nao existe na pagina: nao entra no
    // conjunto nem leva nota. A linha some da tela quando o servidor concorda.
    const comEdicoes = sagas.filter((saga) => saga.edicoes.length > 0);
    try {
      await salvarEdicoes.mutateAsync({
        id: personagem.id,
        comicIds: [
          ...comEdicoes.flatMap((saga) => saga.edicoes),
          ...avulsas.map((comic) => comic.id),
        ],
      });
      await salvarNotas.mutateAsync({
        id: personagem.id,
        sagas: comEdicoes.map((saga) => ({
          seriesId: saga.seriesId,
          note: saga.note.trim() || null,
        })),
      });
      setSagas(comEdicoes);
      setBase(estado(comEdicoes, avulsas));
      setOk(true);
      return true;
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível salvar as aparições');
      return false;
    }
  }

  useSecao('aparicoes', 'Onde aparece', atual !== base, enviar);

  return (
    <section className="rounded-xl border border-ink-800 p-4">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
        Onde aparece
      </h3>
      <p className="mb-4 text-xs text-ink-500">
        Cada saga daqui vira uma linha na página do personagem, na ordem em que estiverem. Adicionar
        marca todas as edições dela — abra a saga para desmarcar aquelas em que ele não está.
      </p>

      {sagas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-700 px-4 py-6 text-center text-xs text-ink-500">
          Nenhuma saga marcada. A seção “Onde aparece” não vai sair na página.
        </p>
      ) : (
        <div className="space-y-2">
          {sagas.map((saga, i) => (
            <LinhaDeSagaEditavel
              key={saga.seriesId}
              saga={saga}
              numero={i + 1}
              primeira={i === 0}
              ultima={i === sagas.length - 1}
              aberta={aberta === saga.seriesId}
              onAbrir={() => setAberta((atual) => (atual === saga.seriesId ? null : saga.seriesId))}
              onNota={(note) => altera(saga.seriesId, { note })}
              onEdicoes={(edicoes) => altera(saga.seriesId, { edicoes })}
              onMover={(direcao) => move(i, direcao)}
              onRemover={() => {
                setSagas((atual) => atual.filter((item) => item.seriesId !== saga.seriesId));
                if (aberta === saga.seriesId) setAberta(null);
              }}
            />
          ))}
        </div>
      )}

      <div className="relative mt-3">
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Adicionar saga — busque pelo nome"
          disabled={adicionando}
        />
        {sugestoes.length > 0 && (
          <ul className="mt-1 divide-y divide-ink-800 overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
            {sugestoes.map((serie) => (
              <li key={serie.id}>
                <button
                  type="button"
                  onClick={() => void adiciona(serie)}
                  disabled={adicionando}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm text-ink-200 transition-colors hover:bg-ink-850"
                >
                  <span className="truncate">{serie.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-500">
                    {serie.comicCount} ed.
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {termo.trim() && sugestoes.length === 0 && (
          <p className="mt-1 text-xs text-ink-500">Nenhuma saga fora da lista com esse nome.</p>
        )}
      </div>

      {avulsas.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-ink-500">
            Edições avulsas — sem saga, aparecem uma a uma na página.
          </p>
          <ul className="space-y-1">
            {avulsas.map((comic) => (
              <li key={comic.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-200">
                  {comicLabel(comic.title, comic.issueNumber)}
                </span>
                <BotaoDeTirar
                  rotulo={`Tirar ${comic.title}`}
                  onClick={() =>
                    setAvulsas((atual) => atual.filter((item) => item.id !== comic.id))
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {erro && (
        <div className="mt-3">
          <ErrorNote>{erro}</ErrorNote>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {salvando && <span className="text-xs text-ink-400">Salvando...</span>}
        <span className="text-xs tabular-nums text-ink-500">
          {total} {total === 1 ? 'edição' : 'edições'} · {sagas.length}{' '}
          {sagas.length === 1 ? 'saga' : 'sagas'}
        </span>
        {ok && <span className="text-xs text-emerald-400">Salvo.</span>}
      </div>
    </section>
  );
}

function LinhaDeSagaEditavel({
  saga,
  numero,
  primeira,
  ultima,
  aberta,
  onAbrir,
  onNota,
  onEdicoes,
  onMover,
  onRemover,
}: {
  saga: SagaEmEdicao;
  numero: number;
  primeira: boolean;
  ultima: boolean;
  aberta: boolean;
  onAbrir: () => void;
  onNota: (note: string) => void;
  onEdicoes: (edicoes: string[]) => void;
  onMover: (direcao: -1 | 1) => void;
  onRemover: () => void;
}) {
  const vazia = saga.edicoes.length === 0;

  return (
    <div
      className={`rounded-lg border ${vazia ? 'border-dashed border-ink-700' : 'border-ink-800'}`}
    >
      <div className="flex flex-wrap items-center gap-2 p-2">
        <span className="w-6 text-xs tabular-nums text-ink-500">
          {String(numero).padStart(2, '0')}
        </span>
        <span className="min-w-40 flex-1 truncate text-sm text-ink-200">{saga.name}</span>
        <Input
          value={saga.note}
          onChange={(e) => onNota(e.target.value)}
          placeholder="“leitura de contexto”"
          className="min-w-48 flex-1"
        />
        <button
          type="button"
          onClick={onAbrir}
          aria-expanded={aberta}
          className="h-8 shrink-0 rounded border border-ink-700 px-2 text-xs tabular-nums text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
        >
          {vazia ? 'nenhuma edição' : `${saga.edicoes.length} ed.`} {aberta ? '▴' : '▾'}
        </button>
        <button
          type="button"
          onClick={() => onMover(-1)}
          disabled={primeira}
          title="Subir"
          aria-label="Subir"
          className="h-8 w-8 rounded border border-ink-700 text-ink-300 disabled:border-ink-800 disabled:text-ink-700"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMover(1)}
          disabled={ultima}
          title="Descer"
          aria-label="Descer"
          className="h-8 w-8 rounded border border-ink-700 text-ink-300 disabled:border-ink-800 disabled:text-ink-700"
        >
          ↓
        </button>
        <BotaoDeTirar rotulo={`Tirar ${saga.name}`} onClick={onRemover} />
      </div>

      {vazia && (
        <p className="px-2 pb-2 text-xs text-ink-500">
          Sem edição marcada esta saga sai da página quando você salvar.
        </p>
      )}

      {aberta && (
        <EdicoesDaSaga seriesId={saga.seriesId} marcadas={saga.edicoes} onAlterar={onEdicoes} />
      )}
    </div>
  );
}

/**
 * As edicoes da saga, uma a uma.
 *
 * So carrega quando alguem abre: a lista completa de cada uma das 88 sagas do
 * acervo nao serve para quem entrou aqui so para reordenar ou escrever a nota.
 */
function EdicoesDaSaga({
  seriesId,
  marcadas,
  onAlterar,
}: {
  seriesId: string;
  marcadas: string[];
  onAlterar: (ids: string[]) => void;
}) {
  const { data, isLoading, error } = useSeriesDetail(seriesId);

  if (isLoading) {
    return (
      <p className="border-t border-ink-800 p-3 text-xs text-ink-500">Carregando edições...</p>
    );
  }
  if (error || !data) {
    return (
      <p className="border-t border-ink-800 p-3 text-xs text-rose-400">
        Não foi possível carregar as edições desta saga.
      </p>
    );
  }

  const escolhidas = new Set(marcadas);
  const todas = data.comics.map((comic) => comic.id);

  return (
    <div className="border-t border-ink-800 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="tabular-nums text-ink-500">
          {escolhidas.size} de {todas.length} marcadas
        </span>
        <button
          type="button"
          onClick={() => onAlterar(todas)}
          className="text-ink-300 underline-offset-2 hover:text-ink-100 hover:underline"
        >
          marcar todas
        </button>
        <button
          type="button"
          onClick={() => onAlterar([])}
          className="text-ink-300 underline-offset-2 hover:text-ink-100 hover:underline"
        >
          desmarcar todas
        </button>
      </div>

      <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {data.comics.map((comic) => (
          <li key={comic.id}>
            <label className="flex items-center gap-2 text-sm text-ink-300">
              <input
                type="checkbox"
                checked={escolhidas.has(comic.id)}
                onChange={(e) =>
                  onAlterar(
                    e.target.checked
                      ? [...marcadas, comic.id]
                      : marcadas.filter((id) => id !== comic.id),
                  )
                }
                className="h-3.5 w-3.5 shrink-0 rounded border-ink-600 bg-ink-850"
              />
              <span className="truncate">{comicLabel(comic.title, comic.issueNumber)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** O × de tirar da lista. Só some da tela: o vínculo cai no Salvar. */
function BotaoDeTirar({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={rotulo}
      aria-label={rotulo}
      className="h-8 w-8 shrink-0 rounded border border-ink-700 text-ink-400 transition-colors hover:border-rose-500/60 hover:text-rose-400"
    >
      ×
    </button>
  );
}

/** Uma seta da ordem. O titulo diz o efeito, que e o que importa: a 1ª e o retrato. */
function SetaDeOrdem({
  direcao,
  desabilitada,
  onClick,
}: {
  direcao: 'esquerda' | 'direita';
  desabilitada: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={desabilitada}
      onClick={onClick}
      title={direcao === 'esquerda' ? 'Mover para trás' : 'Mover para frente'}
      aria-label={direcao === 'esquerda' ? 'Mover para trás' : 'Mover para frente'}
      className="h-6 flex-1 rounded border border-ink-700 text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100 disabled:cursor-default disabled:border-ink-800 disabled:text-ink-700"
    >
      {direcao === 'esquerda' ? '←' : '→'}
    </button>
  );
}

/** Campo separado por virgula -> lista limpa. O zod ainda tira repetido e vazio. */
function emLista(valor: string): string[] {
  return valor
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * A barra de nivel, clicavel.
 *
 * Clicar no degrau que ja e o nivel TIRA a barra. Sem isso, um nivel dado por
 * engano nao teria como ser desfeito: nao existe degrau zero para clicar.
 */
function BarraEditavel({
  nivel,
  onEscolher,
}: {
  nivel: number | null;
  onEscolher: (nivel: number | null) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((degrau) => (
        <button
          key={degrau}
          type="button"
          onClick={() => onEscolher(nivel === degrau ? null : degrau)}
          aria-label={`Nível ${degrau}`}
          aria-pressed={nivel !== null && degrau <= nivel}
          className={`h-6 flex-1 rounded-sm transition-colors ${
            nivel !== null && degrau <= nivel ? 'bg-brand-500' : 'bg-ink-800 hover:bg-ink-700'
          }`}
        />
      ))}
    </div>
  );
}

/**
 * A moldura da arte do marco em miniaturas, no lugar de uma lista suspensa:
 * "Painel de HQ" ou "Saltando do quadro" dizem pouco ate se ver a forma.
 */
function SeletorDeMoldura({
  valor,
  desabilitado,
  onEscolher,
}: {
  valor: MilestoneArtStyle | null;
  desabilitado: boolean;
  onEscolher: (valor: MilestoneArtStyle | null) => void;
}) {
  const opcoes: { valor: MilestoneArtStyle | null; rotulo: string; amostra: ReactNode }[] = [
    {
      valor: null,
      rotulo: 'Automática',
      amostra: (
        <span className="h-9 w-4 rounded-t-full bg-brand-400 shadow-[0_0_14px_6px_rgba(63,174,90,0.25)]" />
      ),
    },
    {
      valor: 'dissolver',
      rotulo: 'Dissolver',
      amostra: <span className="h-9 w-7 bg-gradient-to-b from-brand-400 from-50% to-transparent" />,
    },
    {
      valor: 'painel',
      rotulo: 'Painel de HQ',
      amostra: (
        <span className="h-8 w-6 -rotate-3 border-2 border-ink-100 bg-ink-800 shadow-[3px_3px_0_0_#3fae5a]" />
      ),
    },
    {
      valor: 'saltando',
      rotulo: 'Saltando',
      amostra: (
        <span className="relative h-9 w-7">
          <span className="absolute inset-x-0 bottom-0 h-5 border-2 border-ink-100 bg-ink-800" />
          <span className="absolute bottom-2 left-1/2 h-7 w-3 -translate-x-1/2 rounded-t-full bg-brand-400" />
        </span>
      ),
    },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Como a arte entra na página"
      className="flex flex-wrap gap-1.5"
    >
      {opcoes.map((opcao) => {
        const ativa = valor === opcao.valor;
        return (
          <button
            key={opcao.rotulo}
            type="button"
            role="radio"
            aria-checked={ativa}
            disabled={desabilitado}
            title={desabilitado ? 'Escolha uma imagem primeiro' : opcao.rotulo}
            onClick={() => onEscolher(opcao.valor)}
            className={`flex w-[84px] flex-col items-center gap-1 rounded-lg p-1.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              ativa
                ? 'border-2 border-brand-500 bg-brand-500/[0.08] font-bold text-ink-100'
                : 'border border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-500'
            }`}
          >
            <span className="grid h-11 w-full place-items-end justify-center overflow-hidden rounded bg-ink-950 pb-0.5">
              {opcao.amostra}
            </span>
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
