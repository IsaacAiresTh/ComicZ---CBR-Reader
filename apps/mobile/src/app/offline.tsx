import { DownloadsList } from '@/components/DownloadsList';

/**
 * As HQs baixadas, fora da conta. Quando a sessão expira sem rede para entrar
 * de novo, é o que sobra — e é justamente para isso que o download existe.
 */
export default function OfflineScreen() {
  return <DownloadsList />;
}

export { ErrorBoundary } from '@/components/RouteError';
