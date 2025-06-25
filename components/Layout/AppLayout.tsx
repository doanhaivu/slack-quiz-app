import { useState, ReactNode } from 'react';
import Sidebar from '../Sidebar';
import UserMenu from '../UserMenu';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className={styles.appLayout}>
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={toggleSidebar} 
      />
      <main className={`${styles.mainContent} ${isSidebarCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.topBar}>
          <UserMenu />
        </div>
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
} 