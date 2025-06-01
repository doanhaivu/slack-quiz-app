// Server-side logging system
export class ServerLogger {
  private logs: string[] = [];
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  
  constructor() {
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }
  
  start() {
    this.logs = [];
    
    console.log = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      this.logs.push(message);
      this.originalConsoleLog(...args);
    };
    
    console.error = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      this.logs.push(`ERROR: ${message}`);
      this.originalConsoleError(...args);
    };
    
    console.warn = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      this.logs.push(`WARN: ${message}`);
      this.originalConsoleWarn(...args);
    };
  }
  
  stop() {
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    return [...this.logs];
  }
  
  getLogs() {
    return [...this.logs];
  }
} 