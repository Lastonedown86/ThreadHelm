import { createRoot } from 'react-dom/client';
import '@xterm/xterm/css/xterm.css';
import './styles.css';
import { App } from './App.js';

createRoot(document.querySelector('#root')!).render(<App />);
