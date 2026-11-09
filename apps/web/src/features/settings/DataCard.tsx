import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  HardDriveDownload,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { BackupFile, BackupInfo, ImportResult } from '@kortex/shared';
import { Button, Card, CardHeader, Modal } from '../../components/ui';
import { api } from '../../lib/api';
import { toast } from '../../stores/toast';

const fmtSize = (b: number) =>
  b < 1024 * 1024
    ? `${Math.max(1, Math.round(b / 1024))} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`;
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
const KIND: Record<string, string> = {
  manual: 'Manual',
  auto: 'Automático',
  'pre-import': 'Antes de restaurar',
  'pre-restore': 'Antes de restaurar (script)',
  script: 'Script',
};
const kindOf = (name: string) => {
  const k = Object.keys(KIND)
    .sort((a, b) => b.length - a.length)
    .find((x) => name.startsWith(`kortex-${x}-`));
  return k ? KIND[k] : 'Backup';
};

/** Exportar (JSON/CSV), backups .db e restauração a partir de JSON. */
export function DataCard() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: string; data: BackupFile } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: backups = [] } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get<BackupInfo[]>('/backups'),
  });

  const create = useMutation({
    mutationFn: () => api.post<BackupInfo>('/backups'),
    onSuccess: (b) => {
      void qc.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup criado', `${b.name} · ${fmtSize(b.size)}`);
    },
    onError: (e: Error) => toast.error('Falha no backup', e.message),
  });

  const remove = useMutation({
    mutationFn: (name: string) => api.delete(`/backups/${encodeURIComponent(name)}`),
    onSuccess: () => {
      setConfirmDelete(null);
      void qc.invalidateQueries({ queryKey: ['backups'] });
      toast.info('Backup excluído');
    },
    onError: (e: Error) => toast.error('Não foi possível excluir', e.message),
  });

  const restore = useMutation({
    mutationFn: (data: BackupFile) => api.post<ImportResult>('/import', data),
    onSuccess: (r) => {
      setPending(null);
      void qc.invalidateQueries(); // todos os módulos mudaram
      const total = Object.values(r.counts).reduce((n, c) => n + c, 0);
      toast.success(
        'Dados restaurados',
        `${total} registros · cópia do estado anterior: ${r.safetyBackup}`,
      );
    },
    onError: (e: Error) => toast.error('Restauração cancelada — nada foi alterado', e.message),
  });

  async function pickFile(f: File | undefined) {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as BackupFile;
      if (data?.format !== 'kortex-backup' || !data.tables)
        throw new Error('Este arquivo não é um backup do Kortex.');
      setPending({ file: f.name, data });
    } catch (e) {
      toast.error('Arquivo inválido', (e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const counts = pending
    ? Object.entries(pending.data.tables)
        .map(([t, rows]) => [t, rows.length] as const)
        .filter(([, n]) => n > 0)
    : [];

  return (
    <Card>
      <CardHeader
        icon={<Database className="size-5" />}
        title="Dados e backup"
        subtitle="Seus dados ficam só nesta máquina, em data/kortex.db"
      />

      <div className="space-y-6">
        {/* Exportar */}
        <section aria-label="Exportar">
          <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
            Exportar tudo
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href="/api/export?format=json"
              download
              className="flex items-center gap-3 rounded-2xl p-4 shadow-neu-sm transition-all hover:-translate-y-0.5 hover:text-accent-ink"
            >
              <FileJson className="size-6 shrink-0 text-accent-ink" />
              <span>
                <span className="block text-sm font-semibold">JSON</span>
                <span className="block text-xs text-muted">Backup completo, restaurável</span>
              </span>
            </a>
            <a
              href="/api/export?format=csv"
              download
              className="flex items-center gap-3 rounded-2xl p-4 shadow-neu-sm transition-all hover:-translate-y-0.5 hover:text-accent-ink"
            >
              <FileSpreadsheet className="size-6 shrink-0 text-accent-ink" />
              <span>
                <span className="block text-sm font-semibold">CSV (.zip)</span>
                <span className="block text-xs text-muted">Uma planilha por tabela (Excel)</span>
              </span>
            </a>
          </div>
        </section>

        {/* Backups .db */}
        <section aria-label="Backups">
          <div className="mb-3 flex items-center gap-3">
            <h3 className="flex-1 text-xs font-semibold tracking-wider text-muted uppercase">
              Backups do banco
            </h3>
            <Button
              size="sm"
              variant="primary"
              icon={<HardDriveDownload className="size-4" />}
              onClick={() => create.mutate()}
              disabled={create.isPending}
            >
              Fazer backup agora
            </Button>
          </div>
          <p className="mb-3 flex items-start gap-2 px-1 text-xs text-muted">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-accent-ink" />
            Um backup automático é feito ao iniciar o app (1 por dia, guardando os 7 mais recentes)
            em data/backups.
          </p>
          {backups.length === 0 ? (
            <p className="rounded-2xl px-4 py-5 text-center text-sm text-muted shadow-neu-inset-sm">
              Nenhum backup ainda.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {backups.map((b) => (
                <li
                  key={b.name}
                  className="flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-neu-inset-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{kindOf(b.name)}</p>
                    <p className="truncate text-[11px] text-muted" title={b.name}>
                      {fmtWhen(b.createdAt)} · {fmtSize(b.size)}
                    </p>
                  </div>
                  <a
                    href={`/api/backups/${encodeURIComponent(b.name)}`}
                    download
                    aria-label={`Baixar ${b.name}`}
                    title="Baixar"
                    className="grid size-8 place-items-center rounded-lg text-muted hover:text-accent-ink"
                  >
                    <Download className="size-4" />
                  </a>
                  <button
                    type="button"
                    aria-label={
                      confirmDelete === b.name
                        ? `Confirmar exclusão de ${b.name}`
                        : `Excluir ${b.name}`
                    }
                    onClick={() =>
                      confirmDelete === b.name ? remove.mutate(b.name) : setConfirmDelete(b.name)
                    }
                    className={
                      confirmDelete === b.name
                        ? 'h-8 rounded-lg px-2 text-xs font-semibold text-danger'
                        : 'grid size-8 place-items-center rounded-lg text-muted hover:text-danger'
                    }
                  >
                    {confirmDelete === b.name ? 'Excluir?' : <Trash2 className="size-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Restaurar */}
        <section aria-label="Restaurar">
          <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
            Restaurar
          </h3>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            id="restore-file"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <label
            htmlFor="restore-file"
            className="flex cursor-pointer items-center gap-3 rounded-2xl p-4 text-sm shadow-neu-sm transition-colors hover:text-accent-ink"
          >
            <RotateCcw className="size-5 shrink-0 text-accent-ink" />
            <span>
              <span className="block font-semibold">Restaurar de um backup JSON…</span>
              <span className="block text-xs text-muted">
                Substitui todos os dados. Uma cópia do estado atual é salva antes.
              </span>
            </span>
          </label>
          <p className="mt-2 px-1 text-[11px] text-muted">
            Backups .db se restauram pelo terminal:{' '}
            <code>python scripts/restore.py arquivo.db</code>
          </p>
        </section>
      </div>

      <Modal
        open={pending != null}
        onClose={() => setPending(null)}
        size="sm"
        title="Restaurar backup?"
        description={
          pending ? `${pending.file} · exportado em ${fmtWhen(pending.data.exportedAt)}` : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => pending && restore.mutate(pending.data)}
              disabled={restore.isPending}
            >
              {restore.isPending ? 'Restaurando…' : 'Substituir meus dados'}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          <strong>Todos os dados atuais serão substituídos</strong> pelos deste arquivo. Antes
          disso, o Kortex salva automaticamente uma cópia do estado atual em data/backups.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded-2xl p-4 text-xs shadow-neu-inset-sm">
          {counts.length === 0 ? (
            <li className="col-span-2 text-muted">O arquivo não tem registros.</li>
          ) : (
            counts.map(([t, n]) => (
              <li key={t} className="flex justify-between gap-2">
                <span className="truncate text-muted">{t}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </li>
            ))
          )}
        </ul>
      </Modal>
    </Card>
  );
}
