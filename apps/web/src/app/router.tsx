import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AppDownloadPage } from '../features/app/AppDownloadPage';
import { LoginPage } from '../features/auth/LoginPage';
import { ProfilePage } from '../features/auth/ProfilePage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { RegisterPage } from '../features/auth/RegisterPage';
import { AdminCharactersPage } from '../features/admin/AdminCharactersPage';
import { AdminComicsPage } from '../features/admin/AdminComicsPage';
import { AdminDashboard } from '../features/admin/AdminDashboard';
import { AdminGuidesPage } from '../features/admin/AdminGuidesPage';
import { AdminJobsPage } from '../features/admin/AdminJobsPage';
import { AdminLayout } from '../features/admin/AdminLayout';
import { AdminSeriesPage } from '../features/admin/AdminSeriesPage';
import { AdminUsersPage } from '../features/admin/AdminUsersPage';
import { CollectionPage } from '../features/collections/CollectionPage';
import { CharacterPage } from '../features/characters/CharacterPage';
import { CharactersPage } from '../features/characters/CharactersPage';
import { CatalogPage } from '../features/comics/CatalogPage';
import { ComicDetailPage } from '../features/comics/ComicDetailPage';
import { EventPage } from '../features/events/EventPage';
import { EventsPage } from '../features/events/EventsPage';
import { HomePage } from '../features/comics/HomePage';
import { GuideDetailPage } from '../features/guides/GuideDetailPage';
import { GuidesPage } from '../features/guides/GuidesPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { ReaderPage } from '../features/reader/ReaderPage';
import { SeriesPage } from '../features/series/SeriesPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="/registrar" element={<RegisterPage />} />
      {/* Pública: é o link que se manda para quem ainda não tem conta. */}
      <Route path="/app" element={<AppDownloadPage />} />

      <Route element={<ProtectedRoute />}>
        {/* O leitor fica fora do AppShell: ocupa a tela inteira. */}
        <Route path="/ler/:id" element={<ReaderPage />} />

        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="/catalogo" element={<CatalogPage />} />
          <Route path="/hq/:id" element={<ComicDetailPage />} />
          <Route path="/serie/:slug" element={<SeriesPage />} />
          <Route path="/biblioteca" element={<LibraryPage />} />
          <Route path="/biblioteca/pasta/:id" element={<CollectionPage />} />
          <Route path="/guias" element={<GuidesPage />} />
          <Route path="/guias/:slug" element={<GuideDetailPage />} />
          <Route path="/personagens" element={<CharactersPage />} />
          <Route path="/personagens/:slug" element={<CharacterPage />} />
          <Route path="/eventos" element={<EventsPage />} />
          <Route path="/eventos/:slug" element={<EventPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requireAdmin />}>
        <Route element={<AppShell />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="hqs" element={<AdminComicsPage />} />
            <Route path="series" element={<AdminSeriesPage />} />
            <Route path="guias" element={<AdminGuidesPage />} />
            <Route path="personagens" element={<AdminCharactersPage />} />
            <Route path="fila" element={<AdminJobsPage />} />
            <Route path="usuarios" element={<AdminUsersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
