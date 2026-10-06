import { useQuery } from '@tanstack/react-query';
import { Logo } from '../../components/Logo';
import { Link } from 'react-router-dom';
import type { AppAndroidInfo } from '@comicz/shared';
import { useAuth } from '../auth/AuthContext';
import { formatBytes } from '../../lib/format';
import { API_BASE } from '../../services/api';

const DOWNLOAD_URL = `${API_BASE}/app/android`;

/**
 * A página de download do app Android.
 *
 * Pública, como o próprio download: é o link que se manda para alguém que
 * ainda não tem conta. O APK vem da API (GET /app/android), que o entrega do
 * storage — publicar uma versão nova é `npm run app:publicar`, sem deploy.
 *
 * Não há loja: o acervo não passaria na revisão da Play Store nem da App Store.
 * Por isso a página explica a instalação por APK, incluindo a permissão de
 * "fontes desconhecidas", que é o passo em que as pessoas travam.
 */
export function AppDownloadPage() {
  const { user } = useAuth();
  const info = useQuery({
    queryKey: ['app-android-info'],
    queryFn: async (): Promise<AppAndroidInfo | null> => {
      const response = await fetch(`${DOWNLOAD_URL}/info`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Erro ${response.status}`);
      return (await response.json()) as AppAndroidInfo;
    },
    staleTime: 5 * 60_000,
  });

  const published = info.data != null;

  return (
    <div className="min-h-dvh bg-ink-950 text-ink-100">
      <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <Logo />
        <Link to={user ? '/' : '/entrar'} className="text-sm text-ink-400 hover:text-ink-100">
          {user ? 'Voltar ao site' : 'Entrar no site'}
        </Link>
      </header>

      <main className="mx-auto max-w-3xl space-y-12 px-4 pb-16 pt-8">
        <section className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
          <img
            src="/app-icon.png"
            alt="Ícone do ComicZ"
            width={112}
            height={112}
            className="h-28 w-28 shrink-0 rounded-[26px] comic-shadow"
          />
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-semibold">ComicZ para Android</h1>
              <p className="mt-2 text-ink-300">
                Suas HQs no celular — inclusive sem internet. A mesma conta, a mesma biblioteca e o
                mesmo progresso do site.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 sm:items-start">
              {info.isLoading ? (
                <span className="text-sm text-ink-400">Verificando a versão disponível…</span>
              ) : published ? (
                <>
                  <a
                    href={DOWNLOAD_URL}
                    download="ComicZ.apk"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-base font-semibold text-ink-950 transition-colors hover:bg-brand-400"
                  >
                    Baixar para Android
                  </a>
                  <span className="text-xs text-ink-500">
                    Versão {info.data!.version} · {formatBytes(info.data!.sizeBytes)} · publicada em{' '}
                    {new Date(info.data!.publishedAt).toLocaleDateString('pt-BR')}
                  </span>
                </>
              ) : info.isError ? (
                <span className="text-sm text-accent-400">
                  Não foi possível verificar o app agora. Tente de novo em instantes.
                </span>
              ) : (
                <span className="rounded-lg border border-ink-800 px-4 py-3 text-sm text-ink-400">
                  O app ainda não foi publicado. Volte em breve.
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: 'Leia sem internet',
              text: 'Baixe edições ou sagas inteiras e leia no avião, no metrô, onde for.',
            },
            {
              title: 'Progresso sincronizado',
              text: 'A página em que você parou no celular aparece no site, e o contrário também.',
            },
            {
              title: 'Guias, eventos e personagens',
              text: 'As ordens de leitura e os mapas das grandes sagas, na palma da mão.',
            },
            {
              title: 'Feito para ler no celular',
              text: 'Pinça para ampliar, toque duplo, página a página ou rolagem contínua.',
            },
          ].map((feature) => (
            <div key={feature.title} className="rounded-xl border border-ink-800 bg-ink-900 p-5">
              <h2 className="font-semibold text-ink-100">{feature.title}</h2>
              <p className="mt-1 text-sm text-ink-400">{feature.text}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Como instalar</h2>
          <ol className="space-y-3">
            {[
              <>
                Toque em <strong className="text-ink-100">Baixar para Android</strong> no próprio
                celular. O arquivo <code className="text-brand-400">ComicZ.apk</code> vai para os
                downloads.
              </>,
              <>
                Abra o arquivo. Na primeira vez, o Android pede para{' '}
                <strong className="text-ink-100">permitir a instalação de apps desta fonte</strong>{' '}
                (o navegador que baixou). Permita e volte.
              </>,
              <>
                Toque em <strong className="text-ink-100">Instalar</strong> e entre com a mesma
                conta do site{user ? '' : ' — ou crie uma no próprio app'}.
              </>,
            ].map((step, index) => (
              <li key={index} className="flex gap-4 rounded-xl border border-ink-800 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-bold text-ink-950">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink-300">{step}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-400">
            <strong className="text-ink-200">Para atualizar</strong>, baixe de novo aqui e instale
            por cima: as HQs baixadas e o progresso continuam no aparelho.
          </p>
        </section>

        <section className="rounded-xl border border-ink-800 bg-ink-900 p-5 text-sm text-ink-400">
          <strong className="text-ink-200">Tem iPhone?</strong> Ainda não há versão para iOS. O site
          funciona no navegador do iPhone, só sem a leitura offline.
        </section>
      </main>
    </div>
  );
}
