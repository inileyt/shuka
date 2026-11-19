import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-600.css';
import '@fontsource/noto-sans/latin-700.css';
import '@fontsource/noto-sans/latin-800.css';
import '@fontsource/noto-sans/cyrillic-400.css';
import '@fontsource/noto-sans/cyrillic-600.css';
import '@fontsource/noto-sans/cyrillic-700.css';
import '@fontsource/noto-sans/cyrillic-800.css';
import '@fontsource/noto-sans-armenian/armenian-400.css';
import '@fontsource/noto-sans-armenian/armenian-600.css';
import '@fontsource/noto-sans-armenian/armenian-700.css';
import '@fontsource/noto-sans-armenian/armenian-800.css';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { I18nProvider } from './i18n.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
