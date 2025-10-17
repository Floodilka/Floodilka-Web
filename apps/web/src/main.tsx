import React from 'react';
import ReactDOM from 'react-dom/client';

/**
 * TODO: Реализовать web-входную точку c использованием общего renderer-пакета.
 */
function App() {
  return <div>Web app placeholder</div>;
}

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
