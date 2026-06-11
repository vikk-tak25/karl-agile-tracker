import { createApp } from './src/app.js';

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Agile Tracker server running at http://localhost:${PORT}`);
});
