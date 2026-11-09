import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, LogOut, ShieldCheck, ShieldOff } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { toast } from '../../stores/toast';

type Mode = 'idle' | 'set' | 'change' | 'remove';

/** PIN opcional: protege o Kortex quando ele é aberto por outros aparelhos ou pela rede. */
export function SecurityCard() {
  const { pinEnabled, refresh, lock } = useAuth();
  const [mode, setMode] = useState<Mode>('idle');
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; pin?: string; confirm?: string }>({});

  const reset = () => {
    setMode('idle');
    setCurrent('');
    setPin('');
    setConfirm('');
    setErrors({});
  };

  const save = useMutation({
    mutationFn: () => api.post('/auth/pin', { pin, currentPin: pinEnabled ? current : undefined }),
    onSuccess: async () => {
      toast.success(
        mode === 'set' ? 'PIN ativado' : 'PIN alterado',
        'Outros aparelhos precisarão do novo PIN.',
      );
      reset();
      await refresh();
    },
    onError: (e: Error) => setErrors({ current: e.message }),
  });

  const remove = useMutation({
    mutationFn: () => api.post('/auth/pin/remove', { currentPin: current }),
    onSuccess: async () => {
      toast.info('PIN removido', 'O Kortex abre sem senha neste servidor.');
      reset();
      await refresh();
    },
    onError: (e: Error) => setErrors({ current: e.message }),
  });

  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => lock(),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'remove') {
      if (!current) return setErrors({ current: 'Digite o PIN atual' });
      return remove.mutate();
    }
    const next = {
      current: pinEnabled && !current ? 'Digite o PIN atual' : undefined,
      pin: pin.length < 4 ? 'Use ao menos 4 caracteres (6 ou mais é melhor)' : undefined,
      confirm: confirm !== pin ? 'Os dois campos precisam ser iguais' : undefined,
    };
    setErrors(next);
    if (!next.current && !next.pin && !next.confirm) save.mutate();
  }

  return (
    <Card>
      <CardHeader
        icon={pinEnabled ? <ShieldCheck className="size-5" /> : <ShieldOff className="size-5" />}
        title="Segurança"
        subtitle="PIN para abrir o Kortex"
        action={
          <Badge color={pinEnabled ? '#4DF5B8' : '#9AA3B2'}>
            {pinEnabled ? 'PIN ativo' : 'Sem PIN'}
          </Badge>
        }
      />

      {mode === 'idle' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {pinEnabled
              ? 'Quem abrir o Kortex por outro aparelho ou pela rede precisa digitar o PIN. A sessão dura 30 dias em cada aparelho.'
              : 'Só você usa este computador? Pode deixar sem PIN. Se for abrir o Kortex pelo celular ou pela rede, crie um PIN.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {pinEnabled ? (
              <>
                <Button icon={<KeyRound className="size-4" />} onClick={() => setMode('change')}>
                  Trocar PIN
                </Button>
                <Button variant="danger" onClick={() => setMode('remove')}>
                  Remover PIN
                </Button>
                <Button
                  variant="ghost"
                  icon={<LogOut className="size-4" />}
                  onClick={() => logout.mutate()}
                >
                  Sair deste aparelho
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                icon={<KeyRound className="size-4" />}
                onClick={() => setMode('set')}
              >
                Criar PIN
              </Button>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {(mode === 'change' || mode === 'remove') && (
            <Input
              label="PIN atual"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              error={errors.current}
              autoFocus
            />
          )}
          {mode !== 'remove' && (
            <>
              <Input
                label={mode === 'set' ? 'Novo PIN' : 'Novo PIN'}
                type="password"
                autoComplete="new-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                error={errors.pin}
                hint="Números ou letras, de 4 a 64 caracteres."
                autoFocus={mode === 'set'}
              />
              <Input
                label="Repita o novo PIN"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={errors.confirm}
              />
              {mode === 'set' && errors.current && (
                <p className="text-xs text-danger">{errors.current}</p>
              )}
            </>
          )}
          {mode === 'remove' && (
            <p className="text-sm text-muted">
              Sem PIN, qualquer pessoa que alcançar este servidor na rede abre o Kortex.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={reset}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={mode === 'remove' ? 'danger' : 'primary'}
              disabled={save.isPending || remove.isPending}
            >
              {mode === 'remove'
                ? 'Remover PIN'
                : mode === 'set'
                  ? 'Ativar PIN'
                  : 'Salvar novo PIN'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
