import { Component, type ErrorInfo, type ReactNode } from 'react';
import clsx from 'clsx';
import { RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react';

/** Falha ao baixar um pedaço do app (normal após atualizar o Kortex com a aba aberta). */
const CHUNK_ERROR =
  /dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically/i;

interface Props {
  children: ReactNode;
  /** Quando muda (ex.: a rota), o erro é limpo e a tela tenta de novo. */
  resetKey?: string;
  /** Ocupa a tela toda (usado no nível mais alto, onde não há menu). */
  fullscreen?: boolean;
}

/** Evita a "tela branca": mostra uma explicação e formas de se recuperar. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro na interface:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const updated = CHUNK_ERROR.test(error.message);
    return (
      <div
        role="alert"
        className={clsx(
          'grid place-items-center px-4',
          this.props.fullscreen ? 'min-h-dvh bg-bg' : 'py-10',
        )}
      >
        <div className="w-full max-w-md rounded-3xl bg-bg p-8 text-center shadow-neu">
          <span className="mx-auto mb-5 grid size-14 place-items-center rounded-3xl text-amber shadow-neu-inset">
            <TriangleAlert className="size-7" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">
            {updated ? 'O Kortex foi atualizado' : 'Algo deu errado nesta tela'}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {updated
              ? 'Esta aba está com uma versão antiga. Recarregue para continuar; seus dados estão salvos.'
              : 'Seus dados estão salvos. Tente de novo; se continuar, recarregue a página.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!updated && (
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-bg px-5 text-sm font-medium shadow-neu-sm transition-all hover:text-accent-ink active:shadow-neu-inset-sm"
              >
                <RotateCcw className="size-4" aria-hidden /> Tentar de novo
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-accent px-5 text-sm font-medium text-on-accent shadow-glow transition-all hover:bg-accent-hover"
            >
              <RefreshCw className="size-4" aria-hidden /> Recarregar a página
            </button>
          </div>
          {!updated && (
            <details className="mt-6 text-left text-xs text-muted">
              <summary className="cursor-pointer">Detalhes técnicos</summary>
              <pre className="mt-2 overflow-x-auto rounded-2xl p-3 whitespace-pre-wrap shadow-neu-inset-sm">
                {error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
