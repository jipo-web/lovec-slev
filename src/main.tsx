import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// Self-hosted font (no request to Google Fonts – visitors' IPs stay with us)
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
