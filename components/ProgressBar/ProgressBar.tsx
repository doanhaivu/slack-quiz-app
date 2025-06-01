interface ProgressBarProps {
  progress: number;
  status: string;
  isVisible: boolean;
}

export const ProgressBar = ({ progress, status, isVisible }: ProgressBarProps) => {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      backgroundColor: 'white',
      borderBottom: '1px solid #ddd',
      padding: '8px 16px'
    }}>
      <div style={{ fontSize: '12px', marginBottom: '4px' }}>{status}</div>
      <div style={{
        width: '100%',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div
          style={{
            width: `${progress}%`,
            height: '8px',
            backgroundColor: '#0070f3',
            transition: 'width 0.3s ease'
          }}
        />
      </div>
    </div>
  );
}; 