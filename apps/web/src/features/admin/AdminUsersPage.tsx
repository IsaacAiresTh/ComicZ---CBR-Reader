import { useState } from 'react';
import { ActionMenu, ConfirmDialog, Paginacao, Spinner } from '../../components/ui';
import { useAuth } from '../auth/AuthContext';
import { AdminHeader } from './AdminHeader';
import { useAdminUsers, useDeleteUser, useSetUserRole, type AdminUser } from './queries';

/**
 * Contas do site.
 *
 * O papel saiu de dentro da tabela: era uma lista suspensa que gravava no
 * ato, e um clique errado tirava o admin de alguem. Mudar o papel e remover
 * a conta ficam no menu da linha, os dois com confirmacao — remover pede o
 * nome digitado, porque leva junto a biblioteca e o progresso da pessoa.
 */
export function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminUsers(page);
  const setRole = useSetUserRole();
  const deleteUser = useDeleteUser();
  const { user: currentUser } = useAuth();
  const [mudandoPapel, setMudandoPapel] = useState<AdminUser | null>(null);
  const [removendo, setRemovendo] = useState<AdminUser | null>(null);

  if (isLoading) return <Spinner />;

  const admins = (data?.items ?? []).filter((user) => user.role === 'ADMIN').length;

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Usuários"
        count={
          data
            ? `${data.total} ${data.total === 1 ? 'conta' : 'contas'}${admins ? ` · ${admins} ${admins === 1 ? 'admin' : 'admins'} nesta página` : ''}`
            : undefined
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-ink-800">
        <table className="w-full min-w-2xl text-sm">
          <thead className="bg-ink-900 text-left text-[11px] uppercase tracking-[0.14em] text-ink-400">
            <tr>
              <th className="px-5 py-3 font-bold">Usuário</th>
              <th className="px-4 py-3 font-bold">E-mail</th>
              <th className="px-4 py-3 font-bold">Biblioteca</th>
              <th className="px-4 py-3 font-bold">Desde</th>
              <th className="px-4 py-3 font-bold">Papel</th>
              <th className="px-4 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {data?.items.map((user) => {
              const voce = user.id === currentUser?.id;
              return (
                <tr key={user.id} className="hover:bg-ink-900">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-700 text-xs font-bold uppercase text-ink-200">
                        {user.username.slice(0, 2)}
                      </span>
                      <span className="font-semibold text-ink-100">{user.username}</span>
                      {voce && (
                        <span className="rounded-full border border-ink-600 px-2 py-px text-[11px] text-ink-400">
                          você
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-300">{user.email}</td>
                  <td className="px-4 py-3 text-ink-300">
                    {user.libraryCount} {user.libraryCount === 1 ? 'item' : 'itens'}
                  </td>
                  <td className="px-4 py-3 text-ink-400">
                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        user.role === 'ADMIN'
                          ? 'bg-brand-500/15 text-brand-400'
                          : 'bg-ink-800 text-ink-300'
                      }`}
                    >
                      {user.role === 'ADMIN' ? 'Admin' : 'Leitor'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {/* A propria conta nao se rebaixa nem se remove: a API recusa de qualquer forma. */}
                    {voce ? (
                      <span className="text-xs text-ink-500">—</span>
                    ) : (
                      <div className="inline-flex">
                        <ActionMenu
                          small
                          label={`Ações para ${user.username}`}
                          items={[
                            {
                              label: user.role === 'ADMIN' ? 'Tornar leitor…' : 'Tornar admin…',
                              onSelect: () => setMudandoPapel(user),
                            },
                            {
                              label: 'Remover conta…',
                              danger: true,
                              onSelect: () => setRemovendo(user),
                            },
                          ]}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Paginacao pagina={page} total={data?.totalPages ?? 1} onIr={setPage} />

      {mudandoPapel && (
        <ConfirmDialog
          title={
            mudandoPapel.role === 'ADMIN'
              ? `Tirar o admin de ${mudandoPapel.username}?`
              : `Tornar ${mudandoPapel.username} admin?`
          }
          confirmLabel={mudandoPapel.role === 'ADMIN' ? 'Tornar leitor' : 'Tornar admin'}
          busy={setRole.isPending}
          onCancel={() => setMudandoPapel(null)}
          onConfirm={() =>
            setRole.mutate(
              { userId: mudandoPapel.id, role: mudandoPapel.role === 'ADMIN' ? 'USER' : 'ADMIN' },
              { onSuccess: () => setMudandoPapel(null) },
            )
          }
        >
          <p>
            {mudandoPapel.role === 'ADMIN'
              ? 'A pessoa perde o acesso ao painel de administração na próxima vez que entrar.'
              : 'A pessoa passa a poder enviar, editar e excluir HQs, sagas, guias e contas.'}
          </p>
        </ConfirmDialog>
      )}

      {removendo && (
        <ConfirmDialog
          title={`Remover ${removendo.username}?`}
          confirmLabel="Remover conta"
          typeToConfirm={removendo.username}
          busy={deleteUser.isPending}
          onCancel={() => setRemovendo(null)}
          onConfirm={() => deleteUser.mutate(removendo.id, { onSuccess: () => setRemovendo(null) })}
        >
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Somem{' '}
              <strong>
                {removendo.libraryCount} {removendo.libraryCount === 1 ? 'item' : 'itens'} da
                biblioteca
              </strong>{' '}
              e todo o progresso de leitura.
            </li>
            <li>As pastas que a pessoa criou somem junto.</li>
            <li className="text-ink-400">HQs, sagas e guias do acervo não são afetados.</li>
          </ul>
        </ConfirmDialog>
      )}
    </div>
  );
}
