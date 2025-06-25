import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import { LogProvider } from '../contexts/LogContext';
import AppLayout from '../components/Layout/AppLayout';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LogProvider>
      <ThemeProvider>
        <AppLayout>
          <ThemeToggle />
          <Component {...pageProps} />
        </AppLayout>
      </ThemeProvider>
    </LogProvider>
  );
} 