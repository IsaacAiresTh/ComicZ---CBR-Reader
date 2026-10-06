import { useState } from 'react';
import type { GuideSummary } from '@comicz/shared';
import {
  ActionMenu,
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  ErrorNote,
  Field,
  Input,
  Spinner,
  Textarea,
} from '../../components/ui';
import { ApiError, mediaUrl } from '../../services/api';
import { AdminHeader } from './AdminHeader';
import { useGuides } from '../comics/queries';
import { GuideEditor } from './GuideEditor';
import { useCreateGuide, useDeleteGuide } from './queries';

export function AdminGuidesPage() {
  const { data: guides, isLoading } = useGuides();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [excluindo, setExcluindo] = useState<GuideSummary | null>(null);
  const deleteGuide = useDeleteGuide();

  if (editingId) {
    return <GuideEditor guideId={editingId} onBack={() => setEditingId(null)} />;
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Guias"
        count={guides ? `${guides.length} ${guides.length === 1 ? 'guia' : 'guias'}` : undefined}
        description="Um guia é uma lista ordenada de HQs — a principal ferramenta para quem está começando."
        actions={<Button onClick={() => setCreating(true)}>+ Novo guia</Button>}
      />

      {isLoading ? (
        <Spinner />
      ) : (guides?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
          Nenhum guia criado ainda.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {guides?.map((guide: GuideSummary) => {
            const capa = mediaUrl(guide.coverUrl);
            return (
              <li
                key={guide.id}
                className="flex items-center gap-4 rounded-2xl border border-ink-800 bg-ink-900 p-3 pr-4"
              >
                <button
                  type="button"
                  onClick={() => setEditingId(guide.id)}
                  className="block h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-800"
                  aria-label={`Editar ${guide.title}`}
                >
                  {capa ? (
                    <img src={capa} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="capa-vazia block h-full" />
                  )}
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(guide.id)}
                      className="truncate text-left text-[15px] font-bold text-ink-100 hover:text-brand-400"
                    >
                      {guide.title}
                    </button>
                    <Badge tone={guide.published ? 'success' : 'warning'}>
                      {guide.published ? 'publicado' : 'rascunho'}
                    </Badge>
                    {guide.kind === 'EVENT' && <Badge tone="brand">grande saga</Badge>}
                  </div>
                  {guide.summary && (
                    <p className="line-clamp-1 text-sm text-ink-400">{guide.summary}</p>
                  )}
                  <p className="text-xs text-ink-500">
                    {guide.itemCount} {guide.itemCount === 1 ? 'HQ' : 'HQs'}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setEditingId(guide.id)}>
                  Editar
                </Button>
                <ActionMenu
                  small
                  items={[{ label: 'Excluir…', danger: true, onSelect: () => setExcluindo(guide) }]}
                />
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <Drawer title="Novo guia" onClose={() => setCreating(false)}>
          <NewGuideForm onClose={() => setCreating(false)} onCreated={setEditingId} />
        </Drawer>
      )}

      {excluindo && (
        <ConfirmDialog
          title={`Excluir o guia “${excluindo.title}”?`}
          confirmLabel="Excluir guia"
          busy={deleteGuide.isPending}
          onCancel={() => setExcluindo(null)}
          onConfirm={() =>
            deleteGuide.mutate(excluindo.id, { onSuccess: () => setExcluindo(null) })
          }
        >
          <p>As HQs continuam no catálogo; some só a ordem de leitura e as notas deste guia.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function NewGuideForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const createGuide = useCreateGuide();
  const [form, setForm] = useState({ title: '', summary: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const guide = await createGuide.mutateAsync({
        title: form.title.trim(),
        summary: form.summary.trim() || undefined,
        description: form.description.trim() || undefined,
        published: false,
      });
      onClose();
      onCreated(guide.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Erro ao criar');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field label="Título">
        <Input
          value={form.title}
          onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))}
          placeholder="Por onde começar no Batman"
          required
        />
      </Field>
      <Field label="Resumo" hint="Uma linha que aparece na listagem">
        <Input
          value={form.summary}
          onChange={(event) => setForm((c) => ({ ...c, summary: event.target.value }))}
          placeholder="A ordem ideal para quem nunca leu Batman"
        />
      </Field>
      <Field label="Descrição">
        <Textarea
          rows={4}
          value={form.description}
          onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
          placeholder="Explique a lógica da ordem, o que esperar, o que pode ser pulado..."
        />
      </Field>
      <div className="flex gap-3">
        <Button type="submit" disabled={createGuide.isPending}>
          Criar e adicionar HQs
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
