import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, ExternalLink, Smartphone, TriangleAlert } from 'lucide-react';
import type { NetworkInfo } from '@kortex/shared';
import { Badge, Button, Card, CardHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { usePwa } from '../../stores/pwa';
import { toast } from '../../stores/toast';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Endereço copiado', text);
  } catch {
    toast.info('Copie manualmente', text); // clipboard só existe em HTTPS/localhost
  }
}

/** Como abrir o Kortex no celular: endereços da rede, instalar como app e avisos. */
export function AccessCard() {
  const { data: net } = useQuery({
    queryKey: ['network'],
    queryFn: () => api.get<NetworkInfo>('/network'),
  });
  const { canInstall, installed, install } = usePwa();
  const secure = window.isSecureContext;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <Card>
      <CardHeader
        icon={<Smartphone className="size-5" />}
        title="Acesso pelo celular"
        subtitle="Use o Kortex no bolso, como um app"
        action={
          net && (
            <Badge color={net.exposed ? '#FFD166' : '#4DF5B8'}>
              {net.exposed ? 'Na rede' : 'Só neste computador'}
            </Badge>
          )
        }
      />

      <div className="space-y-5">
        {/* Endereços */}
        {net?.exposed ? (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">
              Abra no celular (mesmo Wi-Fi)
            </p>
            {net.urls.length ? (
              <ul className="space-y-2">
                {net.urls.map((u) => (
                  <li
                    key={u}
                    className="flex items-center gap-2 rounded-2xl px-4 py-2.5 shadow-neu-inset-sm"
                  >
                    <code className="min-w-0 flex-1 truncate text-sm">{u}</code>
                    <button
                      type="button"
                      aria-label={`Copiar ${u}`}
                      onClick={() => copy(u)}
                      className="grid size-8 place-items-center rounded-lg text-muted hover:text-accent-ink"
                    >
                      <Copy className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Não encontrei o endereço da rede. Veja o terminal onde o Kortex está rodando.
              </p>
            )}
            {!net.pinEnabled && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm shadow-neu-inset-sm"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber" />
                <span>
                  Qualquer pessoa na sua rede consegue abrir o Kortex. <strong>Crie um PIN</strong>{' '}
                  em Segurança.
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl p-4 text-sm shadow-neu-inset-sm">
            <p className="mb-2 font-medium">Hoje só este computador acessa o Kortex.</p>
            <p className="text-muted">
              Para abrir no celular, feche o Kortex e inicie com{' '}
              <code className="rounded bg-line px-1.5 py-0.5">npm run start:lan</code>. O endereço
              aparece aqui.
            </p>
          </div>
        )}

        {/* Instalar */}
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">
            Instalar como app
          </p>
          {installed ? (
            <p className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-mint" /> Você já está usando o Kortex instalado.
            </p>
          ) : canInstall ? (
            <Button
              variant="primary"
              icon={<Download className="size-4" />}
              onClick={async () => {
                if (await install())
                  toast.success('Kortex instalado', 'Procure o ícone na tela inicial.');
              }}
            >
              Instalar o Kortex
            </Button>
          ) : (
            <div className="space-y-2 text-sm text-muted">
              {!secure && (
                <p>
                  Para instalar, o navegador exige <strong className="text-fg">HTTPS</strong> (ou
                  localhost). Pela rede local (http://) o Kortex abre normalmente, mas sem o botão
                  de instalar. A forma mais simples de ter HTTPS é o{' '}
                  <strong className="text-fg">Tailscale</strong>: veja o guia abaixo.
                </p>
              )}
              {secure && (
                <p>
                  {isIos
                    ? 'No iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”.'
                    : 'No menu do navegador (⋮), escolha “Instalar app” ou “Adicionar à tela inicial”.'}
                </p>
              )}
            </div>
          )}
        </div>

        <a
          href="https://github.com/joaogfigueiredo/Kortex/blob/main/docs/ACESSO-REMOTO.md"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-ink hover:underline"
        >
          Guia: acesso de qualquer lugar com Tailscale <ExternalLink className="size-3.5" />
        </a>
      </div>
    </Card>
  );
}
