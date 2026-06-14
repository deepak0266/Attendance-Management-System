import React from 'react';

const LoadingSpinner = ({ size = 'medium', text = 'Loading...', fullScreen = false }) => {
  const sizeClass = {
    small: 'spinner-sm',
    medium: '',
    large: 'spinner-lg'
  }[size] || '';
  
  if (fullScreen) {
    return (
      <div className="loading-screen">
        <div className="text-center">
          <div className={`spinner ${sizeClass}`}></div>
          {text && <p className="mt-2 text-secondary">{text}</p>}
        </div>
      </div>
    );
  }
  
  return (
    <div className="d-flex justify-center align-center" style={{ padding: '20px' }}>
      <div className={`spinner ${sizeClass}`}></div>
      {text && <span className="ml-2 text-secondary">{text}</span>}
    </div>
  );
};

export default LoadingSpinner;