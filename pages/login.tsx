import { NextPage } from 'next';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/LoginForm';

const LoginPage: NextPage = () => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      // Redirect to home page if already logged in
      router.push('/');
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Redirecting...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Login - Slack Quiz App</title>
        <meta name="description" content="Admin login for Slack Quiz App" />
      </Head>
      <LoginForm />
    </>
  );
};

export default LoginPage; 