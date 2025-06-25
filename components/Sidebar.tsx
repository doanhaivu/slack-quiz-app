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
  const { theme } = useTheme();

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

      {!isCollapsed && (
        <div className={styles.footer}>
          <div className={styles.footerText}>
            <span>Slack Quiz App</span>
            <span className={styles.version}>v1.0</span>
          </div>
        </div>
      )}
    </aside>
  );
} 