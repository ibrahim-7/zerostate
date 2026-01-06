import express from 'express';
import path from 'path';
import uploadRoute from './routes/upload.route';



export function createApp() {
const app = express();
    
  app.use(uploadRoute);
  app.use(express.json());
  app.use(express.static(path.join(process.cwd(), 'public')));

  return app;
}
