/**
 * Main entry point - starts the web server
 */

import { app } from './server.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        Vistaprint Image Scraper is running!                ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Web Interface:  http://localhost:${PORT}                     ║
║                                                            ║
║  API Endpoints:                                            ║
║    POST /api/analyze      - Analyze single URL             ║
║    POST /api/analyze-bulk - Analyze CSV of URLs            ║
║    GET  /api/health       - Health check                   ║
║                                                            ║
║  Environment Variables:                                    ║
║    OPENAI_API_KEY - Required for AI-powered analysis       ║
║    PORT          - Server port (default: 3000)             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
