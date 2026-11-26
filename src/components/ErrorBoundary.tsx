import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ROJGAR SETU][ErrorBoundary] Uncaught UI error:', {
      message: error?.message,
      name: error?.name,
      componentStack: info?.componentStack,
    });
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let lang = 'mr';
    try {
      const saved = localStorage.getItem('rojgar_setu_lang');
      if (saved === 'en' || saved === 'hi' || saved === 'mr') lang = saved;
    } catch {
      // Ignore storage error
    }

    const title =
      lang === 'hi'
        ? 'पेज लोड करने में तकनीकी समस्या आई'
        : lang === 'en'
          ? 'Something went wrong on this screen'
          : 'ही स्क्रीन उघडताना तांत्रिक अडचण आली';
    const subtitle =
      lang === 'hi'
        ? 'कृपया पेज रीलोड करें। यदि समस्या बनी रहे तो लॉग आउट करके पुनः लॉगिन करें।'
        : lang === 'en'
          ? 'Please reload the page. If this keeps happening, sign out and sign in again.'
          : 'कृपया पेज रीलोड करा. अडचण कायम राहिल्यास लॉग आउट करून पुन्हा लॉगिन करा.';
    const btnText =
      lang === 'hi' ? 'पेज रीलोड करें' : lang === 'en' ? 'Reload Page' : 'पेज रीलोड करा';

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center space-y-4">
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600">{subtitle}</p>
          {this.state.errorMessage && (
            <p className="text-xs font-mono text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 break-words">
              {this.state.errorMessage.slice(0, 220)}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-xl bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors"
          >
            {btnText}
          </button>
        </div>
      </div>
    );
  }
}
