import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTheme } from '../contexts/ThemeContext';
import styles from './Sidebar.module.css';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const menuItems = [
    {
      href: '/',
      icon: '🏠',
      label: 'Home',
      description: 'Content extraction and management'
    },
    {
      href: '/quiz-report',
      icon: '📊',
      label: 'Quiz Reports',
      description: 'Quiz performance analytics'
    },
    {
      href: '/lunch-admin',
      icon: '🍽️',
      label: 'Lunch Admin',
      description: 'Lunch order management'
    },
    {
      href: '/bot-admin',
      icon: '🤖',
      label: 'Bot Admin',
      description: 'Bot configuration settings'
    }
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return router.pathname === '/';
    }
    return router.pathname === href;
  };

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${theme === 'dark' ? styles.dark : ''}`}>
      <div className={styles.header}>
        {!isCollapsed && (
          <h2 className={styles.title}>Quiz App</h2>
        )}
        <button 
          className={styles.toggleButton}
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      <nav className={styles.navigation}>
        <ul className={styles.menuList}>
          {menuItems.map((item) => (
            <li key={item.href} className={styles.menuItem}>
              <Link 
                href={item.href}
                className={`${styles.menuLink} ${isActive(item.href) ? styles.active : ''}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                {!isCollapsed && (
                  <div className={styles.labelContainer}>
                    <span className={styles.label}>{item.label}</span>
                    <span className={styles.description}>{item.description}</span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.footer}>
        <button 
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          )}
          {!isCollapsed && (
            <span className={styles.themeLabel}>
              {theme === 'light' ? 'Dark' : 'Light'} Mode
            </span>
          )}
        </button>
        
        {!isCollapsed && (
          <div className={styles.footerText}>
            <span>Slack Quiz App</span>
            <span className={styles.version}>v1.0</span>
          </div>
        )}
      </div>
    </aside>
  );
} 