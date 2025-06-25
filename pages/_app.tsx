import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LogProvider } from '../contexts/LogContext';
import { AuthProvider } from '../contexts/AuthContext';
import AppLayout from '../components/Layout/AppLayout';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LogProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppLayout>
            <Component {...pageProps} />
          </AppLayout>
        </AuthProvider>
      </ThemeProvider>
    </LogProvider>
  );
} 