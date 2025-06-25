import { ReactNode } from 'react';

interface ThreeColumnLayoutProps {
  leftSidebar: ReactNode;
  mainContent: ReactNode;
  rightSidebar: ReactNode;
}

export const ThreeColumnLayout = ({ 
  leftSidebar, 
  mainContent, 
  rightSidebar 
}: ThreeColumnLayoutProps) => {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '300px 1fr 280px', 
      gap: '20px', 
      height: '100vh',
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <div style={{ 
        borderRight: '1px solid #eee', 
        paddingRight: '16px',
        overflow: 'auto'
      }}>
        {leftSidebar}
      </div>
      <div style={{ 
        overflow: 'auto',
        padding: '0 16px'
      }}>
        {mainContent}
      </div>
      <div style={{ 
        borderLeft: '1px solid #eee', 
        paddingLeft: '16px',
        backgroundColor: '#f8f9fa',
        overflow: 'auto'
      }}>
        {rightSidebar}
      </div>
    </div>
  );
}; 