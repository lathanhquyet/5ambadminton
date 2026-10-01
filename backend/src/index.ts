import dotenv from 'dotenv';
import { createApp } from './app';
import { runSeed } from './database/seed';

dotenv.config();

const PORT = process.env.PORT || 3001;

// Run database migrations and seed default data on startup
runSeed()
  .then(() => {
    const app = createApp();
    app.listen(PORT, () => {
      console.log(`[Badminton Fund API] Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
