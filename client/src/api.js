import axios from 'axios';

// withCredentials makes the browser send our login cookie with every request
const api = axios.create({ baseURL: '/api', withCredentials: true });

export default api;