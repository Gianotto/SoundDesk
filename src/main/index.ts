import { start } from '@main/app/bootstrap';

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
