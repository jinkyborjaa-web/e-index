const productionApiUrl = 'https://e-index-ir8v.onrender.com/api';
const isLocalDevelopment = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

window.__API_URL__ = window.__API_URL__ || (isLocalDevelopment ? '' : productionApiUrl);
