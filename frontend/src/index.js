import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.jsx';
import './styles/globals.css';
import './styles/theme.css';
import './styles/components.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null,
    React.createElement(HelmetProvider, null,
      React.createElement(BrowserRouter, null,
        React.createElement(App, null)
      )
    )
  )
);