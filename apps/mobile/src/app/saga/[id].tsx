import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BulkLibraryResult, ComicSummary, SeriesDetail } from '@comicz/shared';

import { CollectionPicker } from '@/components/CollectionPicker';
import { ComicRow } from '@/components/ComicRow';
import { QueryError } from '@/components/QueryError';
import { Badge, Body, Button, Eyebrow, Loading, MediaImage } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { cancelDownload, enqueueDownloads, useDownloads } from '@/lib/downloads';
import {
  comicLabel,
  creditRoleLabel,
  groupCredits,
  plural,
  seriesStatusLabel,
  seriesYears,
} from '@/lib/format';
import { useLibraryActions, useSeries } from '@/lib/queries';

export default function SeriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useSeries(id);

  if (query.isPending) return <Loading />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;

  const series = query.data;
  return (
    <>
      <Stack.Screen options={{ title: series.name }} />
      <FlatList
        style={styles.screen}
        data={series.comics}
        keyExtractor={(comic) => comic.id}
        renderItem={({ item }) => <ComicRow comic={item} showSeries={false} />}
        ListHeaderComponent={<Header series={series} />}
        ListEmptyComponent={
          <Body muted style={{ padding: Spacing.three }}>
            Nenhuma edição ainda.
          </Body>
        }
        contentContainerStyle={{ paddingBottom: Spacing.five }}
      />
    </>
  );
}

function Header({ series }: { series: SeriesDetail }) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const read = series.comics.filter((comic) => comic.progress?.completed).length;
  const status = seriesStatusLabel(series.status);
  const years = seriesYears(series.startYear, series.endYear, series.status);
  const credits = groupCredits(series.creators);

  // "6 de 12 edições" só faz sentido quando a saga tem mais do que temos aqui.
  const issues =
    series.totalIssues && series.totalIssues > series.comics.length
      ? `${series.comics.length} de ${series.totalIssues} edições`
      : plural(series.comics.length, 'edição', 'edições');

  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <MediaImage url={series.coverUrl} style={styles.cover} />
        <View style={{ flex: 1, gap: Spacing.two }}>
          <Text style={styles.title}>{series.name}</Text>
          <View style={styles.badges}>
            {status ? (
              <Badge label={status} tone={series.status === 'COMPLETED' ? 'success' : 'brand'} />
            ) : null}
            <Badge label={issues} />
            {series.publisher ? <Badge label={series.publisher.name} /> : null}
            {years ? <Badge label={years} /> : null}
            {read > 0 ? (
              <Badge
                label={`${read} de ${series.comics.length} lidas`}
                tone={read === series.comics.length ? 'success' : 'neutral'}
              />
            ) : null}
          </View>
        </View>
      </View>

      {series.description ? (
        <View>
          <Body
            style={{ color: Colors.ink300, lineHeight: 22 }}
            numberOfLines={descriptionOpen ? undefined : 5}
          >
            {series.description}
          </Body>
          <Text style={styles.more} onPress={() => setDescriptionOpen((open) => !open)}>
            {descriptionOpen ? 'mostrar menos' : 'ler mais'}
          </Text>
        </View>
      ) : null}

      {credits.length > 0 ? (
        <View style={styles.credits}>
          {credits.map((credit) => (
            <View key={credit.role} style={{ gap: 2, minWidth: '40%' }}>
              <Eyebrow>{creditRoleLabel(credit.role)}</Eyebrow>
              <Text style={styles.creditNames}>{credit.names.join(', ')}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {series.creatorsFromIssues ? (
        <Text style={styles.hint}>
          Créditos tirados das edições — a saga ainda não tem créditos próprios.
        </Text>
      ) : null}

      <SeriesActions series={series} />
    </View>
  );
}

/** A edição por onde seguir: a primeira pronta que ainda não foi lida até o fim. */
function nextToRead(series: SeriesDetail): ComicSummary | null {
  const ready = series.comics.filter((comic) => comic.file?.status === 'READY');
  return ready.find((comic) => !comic.progress?.completed) ?? null;
}

/**
 * O que se faz com a saga: seguir lendo (a ação principal), baixar o que
 * falta de uma vez, e guardar na biblioteca ou numa pasta.
 */
function SeriesActions({ series }: { series: SeriesDetail }) {
  const library = useLibraryActions();
  const { comics: downloaded, active } = useDownloads();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = series.comics.length;
  if (total === 0) return null;

  const inLibrary = series.comics.filter((comic) => comic.inLibrary).length;
  const missing = total - inLibrary;
  const busy = library.addSeries.isPending || library.removeSeries.isPending;
  const ready = series.comics.filter((comic) => comic.file?.status === 'READY');
  const onDevice = ready.filter((comic) => downloaded[comic.id]).length;
  const working = ready.filter((comic) => active[comic.id] && !active[comic.id]!.error);
  const failed = ready.filter((comic) => active[comic.id]?.error).length;
  const toDownload = ready.filter((comic) => !downloaded[comic.id] && !working.includes(comic));
  const next = nextToRead(series);
  const nextStarted = Boolean(next?.progress && next.progress.currentPage > 1);

  async function run(action: 'add' | 'remove') {
    setError(null);
    setFeedback(null);
    try {
      const result: BulkLibraryResult =
        action === 'add'
          ? await library.addSeries.mutateAsync(series.id)
          : await library.removeSeries.mutateAsync(series.id);
      if (action === 'remove') {
        setFeedback(plural(result.removed, 'edição removida', 'edições removidas'));
      } else if (result.alreadyInLibrary > 0) {
        setFeedback(`${result.added} adicionadas · ${result.alreadyInLibrary} já estavam`);
      } else {
        setFeedback(plural(result.added, 'edição adicionada', 'edições adicionadas'));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não deu para salvar');
    }
  }

  const downloadAll = () =>
    enqueueDownloads(toDownload.map((comic) => ({ comicId: comic.id, coverUrl: comic.coverUrl })));
  const cancelAll = () => working.forEach((comic) => cancelDownload(comic.id));

  return (
    <View style={{ gap: Spacing.two }}>
      {next ? (
        <Button
          label={
            nextStarted
              ? `Continuar na ${comicLabel(next)} · página ${next.progress!.currentPage}`
              : next === ready[0]
                ? `Começar pela ${comicLabel(next)}`
                : `Seguir na ${comicLabel(next)}`
          }
          onPress={() => router.push({ pathname: '/ler/[id]', params: { id: next.id } })}
        />
      ) : null}

      {ready.length > 0 ? (
        <View style={styles.downloadCard}>
          <View style={styles.downloadHead}>
            <Ionicons
              name={onDevice === ready.length ? 'checkmark-circle' : 'arrow-down-circle-outline'}
              size={22}
              color={onDevice === ready.length ? Colors.success : Colors.brandLight}
            />
            <Text style={styles.downloadTitle}>
              {onDevice === ready.length
                ? 'A saga inteira está no celular'
                : working.length > 0
                  ? `Baixando · ${onDevice} de ${ready.length} no celular`
                  : onDevice > 0
                    ? `${onDevice} de ${ready.length} no celular`
                    : 'Ler sem internet'}
            </Text>
          </View>
          {onDevice < ready.length ? (
            <View style={styles.downloadTrack}>
              <View
                style={[
                  styles.downloadFill,
                  { width: `${Math.round((onDevice / ready.length) * 100)}%` },
                ]}
              />
            </View>
          ) : null}
          {failed > 0 ? (
            <Text style={styles.error}>
              {plural(failed, 'edição falhou', 'edições falharam')} — toque em baixar para tentar de
              novo.
            </Text>
          ) : null}
          {working.length > 0 ? (
            <Button variant="secondary" label="Cancelar downloads" onPress={cancelAll} />
          ) : toDownload.length > 0 ? (
            <Button
              variant="secondary"
              label={
                onDevice === 0
                  ? `Baixar a saga inteira (${toDownload.length})`
                  : `Baixar as ${toDownload.length} que faltam`
              }
              icon={<Ionicons name="arrow-down" size={18} color={Colors.ink100} />}
              onPress={downloadAll}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.row}>
        {missing > 0 ? (
          <Button
            variant="secondary"
            label={inLibrary === 0 ? 'Guardar na biblioteca' : `Guardar as ${missing} restantes`}
            loading={library.addSeries.isPending}
            disabled={busy}
            style={{ flex: 1 }}
            onPress={() => void run('add')}
          />
        ) : (
          <Button
            variant="quiet"
            label="Tirar da biblioteca"
            disabled={busy}
            style={{ flex: 1 }}
            onPress={() => void run('remove')}
          />
        )}
        <Button variant="secondary" label="Pasta" onPress={() => setPickerOpen(true)} />
      </View>
      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <CollectionPicker
        target={{ kind: 'series', id: series.id }}
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onDone={setFeedback}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink900 },
  header: {
    padding: Spacing.three,
    gap: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ink800,
    marginBottom: Spacing.two,
  },
  top: { flexDirection: 'row', gap: Spacing.three },
  cover: { width: 110, height: 165, borderRadius: 8, boxShadow: `4px 4px 0 0 ${Colors.brand}` },
  title: {
    color: Colors.ink100,
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: 0.5,
  },
  downloadCard: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ink700,
    backgroundColor: Colors.ink850,
  },
  downloadHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  downloadTitle: { flex: 1, color: Colors.ink100, fontSize: 15, fontWeight: '700' },
  downloadTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.ink700, overflow: 'hidden' },
  downloadFill: { height: '100%', backgroundColor: Colors.success },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  more: { color: Colors.brandLight, fontSize: 13, marginTop: 4 },
  credits: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  creditNames: { color: Colors.ink200, fontSize: 14 },
  hint: { color: Colors.ink500, fontSize: 12 },
  row: { flexDirection: 'row', gap: Spacing.two },
  feedback: { color: '#6ee7b7', fontSize: 14 },
  error: { color: Colors.accent, fontSize: 14 },
});

export { ErrorBoundary } from '@/components/RouteError';
