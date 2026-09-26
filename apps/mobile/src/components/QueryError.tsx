import { router } from 'expo-router';

import { OfflineError, offlineMessage } from '@/lib/api';
import { Button, EmptyState } from './ui';

/**
 * Erro de carregamento. Sem rede, lembra que as HQs baixadas continuam ali —
 * é justamente a situação para a qual o download existe.
 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const offline = error instanceof OfflineError;
  return (
    <EmptyState
      title={offline ? 'Sem conexão' : 'Algo deu errado'}
      message={
        offline
          ? `Suas HQs baixadas continuam disponíveis na aba Baixadas.${__DEV__ ? `\n\n${offlineMessage(error)}` : ''}`
          : error instanceof Error
            ? error.message
            : undefined
      }
      action={
        <>
          <Button label="Tentar de novo" onPress={onRetry} />
          {offline ? (
            <Button
              label="Ver baixadas"
              variant="ghost"
              style={{ marginTop: 8 }}
              onPress={() => router.navigate('/baixadas')}
            />
          ) : null}
        </>
      }
    />
  );
}
