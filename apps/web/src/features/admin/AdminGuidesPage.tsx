import { useState } from 'react';
import type { GuideSummary } from '@comicz/shared';
import { Badge, Button, ErrorNote, Field, Input, Spinner, Textarea } from '../../components/ui';
import { ApiError } from '../../services/api';
import { useGuides } from '../comics/queries';
import { GuideEditor } from './GuideEditor';
import { useCreateGuide, useDeleteGuide } from './queries';

export function AdminGuidesPage() {
  const { data: guides, isLoading } = useGuides();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const deleteGuide = useDeleteGuide();

  if (editingId) {
    return <GuideEditor guideId={editingId} onBack={() => setEditingId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-400">
          Um guia é uma lista ordenada de HQs — a principal ferramenta para quem está começando.
        </p>
        <Button onClick={() => setCreating(true)}>+ Novo guia</Button>
      </div>

      {creating && <NewGuideForm onClose={() => setCreating(false)} onCreated={setEditingId} />}

      {isLoading ? (
        <Spinner />
      ) : (guides?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-500">
          Nenhum guia criado ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {guides?.map((guide: GuideSummary) => (
            <li
              key={guide.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink-100">{guide.title}</p>
                  <Badge tone={guide.published ? 'success' : 'warning'}>
                    {guide.published ? 'publicado' : 'rascunho'}
                  </Badge>
                </div>
                {guide.summary && (
                  <p className="mt-1 line-clamp-1 text-sm text-ink-400">{guide.summary}</p>
                )}
                <p className="mt-1 text-xs text-ink-500">{guide.itemCount} HQs</p>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditingId(guide.id)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Excluir o guia "${guide.title}"?`)) {
                      deleteGuide.mutate(guide.id);
                    }
                  }}
                >
                  🗑
                </Button>
              </div>
            </li>
          ))}
        </ul>
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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-6"
    >
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
