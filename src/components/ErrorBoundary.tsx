import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Ocorreu um erro inesperado no aplicativo.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && parsed.error) {
          friendlyMessage = `Erro de sincronização (${parsed.operationType}): ${parsed.error}`;
        }
      } catch {
        // Keep raw message if not JSON
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFB] dark:bg-[#0D1117] text-[#0F172A] dark:text-[#EDF2F7] p-6">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141923] p-6 space-y-4">
            <h2 className="text-lg font-semibold font-display">Algo interrompeu a leitura</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 break-words">
              {friendlyMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-xl bg-[#3B5BDB] hover:bg-[#364FC7] text-white text-sm font-medium transition-colors"
            >
              Recarregar biblioteca
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
