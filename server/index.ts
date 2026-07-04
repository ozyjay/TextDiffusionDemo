import './registerEnv';
import { createApp } from './app';

const host = process.env.BACKEND_HOST ?? '127.0.0.1';
const port = Number(process.env.BACKEND_PORT ?? 8300);

createApp().listen(port, host, () => {
  console.log(`Text Diffusion Lab API listening at http://${host}:${port}`);
});
