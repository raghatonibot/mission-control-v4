import React from 'react';

type State = { hasError: boolean; message?: string };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Erro inesperado na interface' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // mantém log local para diagnóstico sem quebrar UI
    // eslint-disable-next-line no-console
    console.error('UI_ERROR_BOUNDARY', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-lg w-full border border-border rounded-xl p-6 bg-card">
            <h1 className="text-xl font-semibold mb-2">Falha na interface</h1>
            <p className="text-sm text-muted-foreground mb-4">
              O Mission Control detectou um erro de renderização e entrou em modo seguro.
            </p>
            {this.state.message && (
              <pre className="text-xs bg-background border border-border rounded p-3 overflow-auto mb-4 whitespace-pre-wrap">{this.state.message}</pre>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500"
            >
              Recarregar painel
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
