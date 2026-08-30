import { useState } from 'react';
import { Badge, Button, Select, Spinner } from '../../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useAdminUsers, useDeleteUser, useSetUserRole } from './queries';

export function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminUsers(page);
  const setRole = useSetUserRole();
  const deleteUser = useDeleteUser();
  const { user: currentUser } = useAuth();

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-ink-800">
        <table className="w-full min-w-2xl text-sm">
          <thead className="bg-ink-850 text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Biblioteca</th>
              <th className="px-4 py-3 font-medium">Desde</th>
              <th className="px-4 py-3 font-medium">Papel</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {data?.items.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 text-ink-100">
                  {user.username}
                  {user.id === currentUser?.id && (
                    <span className="ml-2">
                      <Badge tone="brand">você</Badge>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-400">{user.email}</td>
                <td className="px-4 py-3 text-ink-400">{user.libraryCount}</td>
                <td className="px-4 py-3 text-ink-500">
                  {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3">
                  <Select
                    className="w-auto"
                    value={user.role}
                    // Rebaixar a si mesmo tira o acesso ao painel: bloqueado na UI.
                    disabled={user.id === currentUser?.id || setRole.isPending}
                    onChange={(event) =>
                      setRole.mutate({
                        userId: user.id,
                        role: event.target.value as 'USER' | 'ADMIN',
                      })
                    }
                  >
                    <option value="USER">Usuário</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    title={
                      user.id === currentUser?.id
                        ? 'Você não pode remover a própria conta'
                        : `Remover ${user.username}`
                    }
                    // A API recusa a auto-remoção de qualquer forma; aqui o
                    // botão fica desabilitado para não oferecer o que não vai
                    // acontecer.
                    disabled={user.id === currentUser?.id || deleteUser.isPending}
                    onClick={() => {
                      const perdas = user.libraryCount
                        ? `${user.libraryCount} item(ns) na biblioteca e todo o progresso de leitura`
                        : 'todo o progresso de leitura';
                      if (
                        window.confirm(
                          `Remover "${user.username}"? Serão apagados ${perdas}. As HQs e os guias do acervo não são afetados.`,
                        )
                      ) {
                        deleteUser.mutate(user.id);
                      }
                    }}
                  >
                    🗑
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-ink-400">
            página {page} de {data?.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= (data?.totalPages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
