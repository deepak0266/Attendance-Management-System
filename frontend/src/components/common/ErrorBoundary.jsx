import React from 'react';
import { FaExclamationTriangle, FaRedo } from 'react-icons/fa';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    
    // Could send to error tracking service here
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
    
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      
      if (fallback) {
        return fallback(this.state.error, this.handleReset);
      }
      
      return (
        <div className="error-boundary">
          <div className="card" style={{ maxWidth: '500px', margin: '50px auto', textAlign: 'center' }}>
            <div className="card-body">
              <FaExclamationTriangle size={50} color="var(--danger-color)" />
              <h3 className="mt-2">Something went wrong</h3>
              <p className="text-secondary mt-1">
                We encountered an unexpected error. Please try again.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-2" style={{ textAlign: 'left' }}>
                  <summary className="cursor-pointer">Error Details</summary>
                  <pre className="mt-1 p-2" style={{ 
                    background: 'var(--bg-tertiary)', 
                    borderRadius: '8px',
                    overflow: 'auto',
                    fontSize: '12px'
                  }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              
              <div className="d-flex gap-2 justify-center mt-3">
                <button className="btn btn-primary" onClick={this.handleReset}>
                  <FaRedo /> Try Again
                </button>
                <button className="btn btn-secondary" onClick={this.handleReload}>
                  Reload Page
                </button>
              </div>
            </div>
          </div>
          
          <style jsx>{`
            .error-boundary {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              background: var(--bg-primary);
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;