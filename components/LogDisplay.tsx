import { useEffect, useRef } from 'react';

interface LogDisplayProps {
  logs: string[];
}

const LogDisplay: React.FC<LogDisplayProps> = ({ logs }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Auto-scroll to bottom when logs change
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);
  
  return (
    <div 
      ref={logContainerRef}
      style={{
        height: '100%',
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#333',
        border: '1px solid #ddd'
      }}
    >
      {logs.map((log, index) => (
        <div 
          key={index}
          style={{
            marginBottom: '5px',
            borderBottom: '1px solid #eee',
            paddingBottom: '5px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {log}
        </div>
      ))}
    </div>
  );
};

export default LogDisplay; 