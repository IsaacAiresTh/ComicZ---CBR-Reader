import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { GuideItemView } from '@comicz/shared';

import { Colors } from '@/constants/theme';
import { comicLabel } from '@/lib/format';
import { useMarkRead } from '@/lib/queries';
import { Button, MediaImage } from './ui';

/**
 * Uma parada da trilha de leitura: o trilho à esquerda (✓ verde nas lidas,
 * o número nas que faltam) e, na parada da vez, o cartão grande com a nota
 * do guia, "Ler agora" e "Já li".
 */
export function TrailStop({
  item,
  current,
  first,
  last,
  accent = Colors.brand,
}: {
  item: GuideItemView;
  current: boolean;
  first: boolean;
  last: boolean;
  accent?: string;
}) {
  const markRead = useMarkRead();
  const comic = item.comic;
  const read = Boolean(comic.progress?.completed);
  const ready = comic.file?.status === 'READY';
  const openComic = () => router.push({ pathname: '/hq/[id]', params: { id: comic.id } });

  return (
    <View style={styles.stop}>
      <View style={styles.rail}>
        <View style={[styles.line, first && { top: 22 }, last && { bottom: '50%' }]} />
        {read ? (
          <View style={[styles.node, styles.nodeRead]}>
            <Text style={styles.nodeReadText}>✓</Text>
          </View>
        ) : (
          <View
            style={[
              styles.node,
              current
                ? { backgroundColor: accent, borderColor: accent, width: 30, height: 30 }
                : null,
            ]}
          >
            <Text style={[styles.nodeText, current && { color: Colors.ink950 }]}>
              {item.position}
            </Text>
          </View>
        )}
      </View>

      {current ? (
        <View style={[styles.card, { borderColor: accent }]}>
          <Text style={[styles.here, { color: accent }]}>VOCÊ ESTÁ AQUI</Text>
          <Pressable style={styles.cardTop} onPress={openComic}>
            <MediaImage url={comic.coverUrl} style={styles.cover} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.cardTitle}>{comicLabel(comic)}</Text>
              {item.note ? <Text style={styles.note}>“{item.note}”</Text> : null}
              {item.optional ? <Text style={styles.optional}>OPCIONAL</Text> : null}
            </View>
          </Pressable>
          <View style={styles.actions}>
            <Button
              label={comic.progress && comic.progress.currentPage > 1 ? 'Continuar' : 'Ler agora'}
              disabled={!ready}
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/ler/[id]', params: { id: comic.id } })}
            />
            <Button
              label="Já li"
              variant="secondary"
              loading={markRead.isPending}
              onPress={() =>
                markRead
                  .mutateAsync({
                    comicId: comic.id,
                    pageCount: comic.progress?.pageCount ?? comic.file?.pageCount ?? 1,
                  })
                  .catch((error: unknown) =>
                    Alert.alert(
                      'Não deu para marcar',
                      error instanceof Error ? error.message : undefined,
                    ),
                  )
              }
            />
          </View>
        </View>
      ) : (
        <Pressable
          onPress={openComic}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <MediaImage url={comic.coverUrl} style={styles.thumb} />
          <Text style={[styles.rowTitle, read && { color: Colors.ink400 }]} numberOfLines={2}>
            {comicLabel(comic)}
          </Text>
          {read ? (
            <Text style={styles.readLabel}>lida</Text>
          ) : item.optional ? (
            <Text style={styles.optional}>OPCIONAL</Text>
          ) : !ready ? (
            <Text style={styles.pending}>em breve</Text>
          ) : null}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stop: { flexDirection: 'row', paddingRight: 16 },
  rail: { width: 52, alignItems: 'center' },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.ink700,
  },
  node: {
    marginTop: 14,
    width: 24,
    height: 24,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.ink600,
    backgroundColor: Colors.ink900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeText: { color: Colors.ink300, fontSize: 11, fontWeight: '800' },
  nodeRead: { backgroundColor: Colors.success, borderColor: Colors.success },
  nodeReadText: { color: Colors.ink950, fontSize: 12, fontWeight: '900' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  thumb: { width: 36, height: 54, borderRadius: 4 },
  rowTitle: { flex: 1, color: Colors.ink100, fontSize: 14, fontWeight: '600' },
  readLabel: { color: Colors.success, fontSize: 12 },
  pending: { color: Colors.ink500, fontSize: 12 },
  optional: {
    color: Colors.ink400,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  card: {
    flex: 1,
    gap: 10,
    marginVertical: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: '#13110a',
  },
  here: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  cardTop: { flexDirection: 'row', gap: 12 },
  cover: { width: 64, height: 96, borderRadius: 6 },
  cardTitle: { color: Colors.ink100, fontSize: 16, fontWeight: '800' },
  note: { color: Colors.ink200, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10 },
});
