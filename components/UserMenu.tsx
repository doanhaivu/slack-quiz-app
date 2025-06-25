import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './UserMenu.module.css';

export default function UserMenu() {
  const { user, logout, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  return (
    <div className={styles.userMenu}>
      <button
        className={styles.userButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        👤 {user.username}
      </button>
      
      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <div className={styles.username}>{user.username}</div>
            <div className={styles.role}>{user.role}</div>
          </div>
          <hr className={styles.separator} />
          <button
            className={styles.logoutButton}
            onClick={handleLogout}
          >
            🚪 Logout
          </button>
        </div>
      )}
      
      {isOpen && (
        <div 
          className={styles.backdrop}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
} 