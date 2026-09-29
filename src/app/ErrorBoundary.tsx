import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
// By file, not via the `@/ui/components` barrel: the barrel would pull Motion into the entry chunk.
import { Button } from '@/ui/components/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Changing this (e.g. the route) clears the error. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function CrashScreen({ error }: { error: Error }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-full place-items-center bg-night p-6 text-paper">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-6xl" aria-hidden="true">
          🃏
        </p>
        <h1 className="font-display text-3xl tracking-wide">{t('app.crashTitle')}</h1>
        <p className="text-paper/80">{t('app.crashBody')}</p>
        <Button variant="gold" onClick={() => window.location.reload()}>
          {t('app.reload')}
        </Button>
        <details className="text-left text-xs text-paper/50">
          <summary className="cursor-pointer">{t('app.crashDetails')}</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
        </details>
      </div>
    </div>
  );
}

/**
 * Catches render errors, including lazy chunks that fail to load after a new deploy, and shows
 * a friendly reload screen instead of a blank page (docs/06 §4 `app/`).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI crashed', error, info.componentStack);
  }

  override componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey)
      this.setState({ error: null });
  }

  override render(): ReactNode {
    return this.state.error ? <CrashScreen error={this.state.error} /> : this.props.children;
  }
}
