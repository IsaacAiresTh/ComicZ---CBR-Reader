import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { BulkLibraryResult, SeriesDetail } from '@comicz/shared';

import { CollectionPicker } from '@/components/CollectionPicker';
import { ComicRow } from '@/components/ComicRow';
import { QueryError } from '@/components/QueryError';
import { Badge, Body, Button, Eyebrow, Loading, MediaImage } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { startDownload, useDownloads } from '@/lib/downloads';
import {
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

/**
 * Biblioteca, pasta e download da saga inteira de uma vez. Adicionar edição a
 * edição continua funcionando pela página de cada HQ.
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
  const toDownload = series.comics.filter(
    (comic) => comic.file?.status === 'READY' && !downloaded[comic.id] && !active[comic.id],
  );
  const readyCount = series.comics.filter((comic) => comic.file?.status === 'READY').length;

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

  // Em fila, uma HQ por vez: cada uma já baixa 3 páginas em paralelo.
  async function downloadAll() {
    for (const comic of toDownload) await startDownload(comic.id, comic.coverUrl);
  }

  return (
    <View style={{ gap: Spacing.two }}>
      {missing > 0 ? (
        <Button
          label={
            inLibrary === 0
              ? `Adicionar saga à biblioteca (${total})`
              : `Adicionar as ${missing} restantes`
          }
          loading={library.addSeries.isPending}
          disabled={busy}
          onPress={() => void run('add')}
        />
      ) : null}
      {inLibrary > 0 ? (
        <Button
          variant="ghost"
          label={
            missing === 0 ? 'Remover saga da biblioteca' : `Remover as ${inLibrary} da biblioteca`
          }
          disabled={busy}
          onPress={() => void run('remove')}
        />
      ) : null}
      <View style={styles.row}>
        <Button
          variant="ghost"
          label="Guardar em pasta"
          style={{ flex: 1 }}
          onPress={() => setPickerOpen(true)}
        />
        {toDownload.length > 0 ? (
          <Button
            variant="ghost"
            label={
              toDownload.length === readyCount ? 'Baixar todas' : `Baixar ${toDownload.length}`
            }
            style={{ flex: 1 }}
            onPress={() => void downloadAll()}
          />
        ) : null}
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
  cover: { width: 110, height: 165, borderRadius: 8 },
  title: { color: Colors.ink100, fontSize: 22, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  more: { color: Colors.brandLight, fontSize: 13, marginTop: 4 },
  credits: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  creditNames: { color: Colors.ink200, fontSize: 14 },
  hint: { color: Colors.ink500, fontSize: 12 },
  row: { flexDirection: 'row', gap: Spacing.two },
  feedback: { color: '#6ee7b7', fontSize: 14 },
  error: { color: Colors.accent, fontSize: 14 },
});
