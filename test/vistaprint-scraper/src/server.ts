/**
 * Express web server for the Vistaprint Image Scraper
 */

import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeProductPage, scrapeMultiplePages, closeBrowser } from './scraper.js';
import { selectBestImage } from './analyzer.js';
import { parseCsvBuffer, generateCsvOutput } from './csv.js';
import type { AnalysisResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// HTML Template
const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vistaprint Image Scraper</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 2rem;
      font-size: 2.5rem;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .card h2 {
      color: #333;
      margin-bottom: 1rem;
      font-size: 1.5rem;
    }
    .card p {
      color: #666;
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    label {
      display: block;
      color: #333;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    input[type="text"],
    input[type="url"] {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus,
    input[type="url"]:focus {
      outline: none;
      border-color: #667eea;
    }
    input[type="file"] {
      padding: 12px;
      border: 2px dashed #e0e0e0;
      border-radius: 8px;
      width: 100%;
      cursor: pointer;
    }
    button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .result {
      margin-top: 1.5rem;
      padding: 1.5rem;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .result h3 {
      color: #333;
      margin-bottom: 1rem;
    }
    .result-item {
      margin-bottom: 1rem;
    }
    .result-item strong {
      color: #667eea;
    }
    .result-image {
      max-width: 100%;
      margin-top: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .url-link {
      color: #667eea;
      word-break: break-all;
    }
    .error {
      background: #fee;
      border: 1px solid #fcc;
      color: #c00;
      padding: 1rem;
      border-radius: 8px;
      margin-top: 1rem;
    }
    .loading {
      display: none;
      text-align: center;
      padding: 2rem;
    }
    .loading.active {
      display: block;
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .checkbox-group input {
      width: 18px;
      height: 18px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Vistaprint Image Scraper</h1>
    
    <!-- Single URL Analysis -->
    <div class="card">
      <h2>Single URL Analysis</h2>
      <p>Enter a Vistaprint product page URL to find the best image for advertising.</p>
      <form id="singleForm">
        <div class="form-group">
          <label for="url">Product Page URL</label>
          <input type="url" id="url" name="url" placeholder="https://www.vistaprint.com/..." required>
        </div>
        <div class="form-group">
          <div class="checkbox-group">
            <input type="checkbox" id="useAI" name="useAI" checked>
            <label for="useAI" style="margin: 0;">Use AI Analysis (requires OPENAI_API_KEY)</label>
          </div>
        </div>
        <button type="submit">Analyze</button>
      </form>
      <div class="loading" id="singleLoading">
        <div class="spinner"></div>
        <p>Analyzing page... This may take 15-30 seconds.</p>
      </div>
      <div id="singleResult"></div>
    </div>
    
    <!-- Bulk Analysis -->
    <div class="card">
      <h2>Bulk Analysis</h2>
      <p>Upload a CSV file with product page URLs. The CSV should have a column named "url" or "URL" containing Vistaprint product page URLs.</p>
      <form id="bulkForm" enctype="multipart/form-data">
        <div class="form-group">
          <label for="csvFile">CSV File</label>
          <input type="file" id="csvFile" name="csvFile" accept=".csv" required>
        </div>
        <div class="form-group">
          <div class="checkbox-group">
            <input type="checkbox" id="bulkUseAI" name="useAI" checked>
            <label for="bulkUseAI" style="margin: 0;">Use AI Analysis (requires OPENAI_API_KEY)</label>
          </div>
        </div>
        <button type="submit">Process CSV</button>
      </form>
      <div class="loading" id="bulkLoading">
        <div class="spinner"></div>
        <p>Processing URLs... This may take a while for large files.</p>
      </div>
      <div id="bulkResult"></div>
    </div>
  </div>

  <script>
    // Single URL Form
    document.getElementById('singleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('url').value;
      const useAI = document.getElementById('useAI').checked;
      const loading = document.getElementById('singleLoading');
      const result = document.getElementById('singleResult');
      
      loading.classList.add('active');
      result.innerHTML = '';
      
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, useAI })
        });
        
        const data = await response.json();
        
        if (data.error) {
          result.innerHTML = '<div class="error">' + data.error + '</div>';
        } else {
          result.innerHTML = \`
            <div class="result">
              <h3>Analysis Result</h3>
              <div class="result-item">
                <strong>Product:</strong> \${data.productName}
              </div>
              <div class="result-item">
                <strong>Selected Image URL:</strong><br>
                <a href="\${data.selectedImageUrl}" target="_blank" class="url-link">\${data.selectedImageUrl}</a>
              </div>
              <div class="result-item">
                <strong>Selection Reasoning:</strong><br>
                \${data.selectedImageReasoning}
              </div>
              <img src="\${data.selectedImageUrl}" alt="Selected product image" class="result-image">
            </div>
          \`;
        }
      } catch (err) {
        result.innerHTML = '<div class="error">Error: ' + err.message + '</div>';
      } finally {
        loading.classList.remove('active');
      }
    });

    // Bulk Form
    document.getElementById('bulkForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const loading = document.getElementById('bulkLoading');
      const result = document.getElementById('bulkResult');
      
      loading.classList.add('active');
      result.innerHTML = '';
      
      try {
        const response = await fetch('/api/analyze-bulk', {
          method: 'POST',
          body: formData
        });
        
        if (response.headers.get('Content-Type')?.includes('text/csv')) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'vistaprint-images-' + new Date().toISOString().slice(0,10) + '.csv';
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          
          result.innerHTML = '<div class="result"><h3>Success!</h3><p>CSV file downloaded successfully.</p></div>';
        } else {
          const data = await response.json();
          if (data.error) {
            result.innerHTML = '<div class="error">' + data.error + '</div>';
          }
        }
      } catch (err) {
        result.innerHTML = '<div class="error">Error: ' + err.message + '</div>';
      } finally {
        loading.classList.remove('active');
      }
    });
  </script>
</body>
</html>
`;

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.send(htmlTemplate);
});

// Single URL analysis endpoint
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { url, useAI = true } = req.body;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    if (!url.includes('vistaprint.com')) {
      res.status(400).json({ error: 'URL must be a vistaprint.com page' });
      return;
    }

    console.log(`Analyzing: ${url}`);
    
    // Scrape the page
    const scrapedProduct = await scrapeProductPage(url);
    
    // Analyze images
    const result = await selectBestImage(scrapedProduct, useAI);
    
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Analysis error:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// Bulk analysis endpoint
app.post('/api/analyze-bulk', upload.single('csvFile'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const useAI = req.body.useAI !== 'false';

    if (!file) {
      res.status(400).json({ error: 'CSV file is required' });
      return;
    }

    console.log(`Processing CSV file: ${file.originalname}`);
    
    // Parse CSV
    const urls = await parseCsvBuffer(file.buffer);
    
    if (urls.length === 0) {
      res.status(400).json({ error: 'No valid Vistaprint URLs found in CSV' });
      return;
    }

    console.log(`Found ${urls.length} URLs to process`);
    
    // Scrape all pages
    const { results: scrapedProducts, errors: scrapeErrors } = await scrapeMultiplePages(urls);
    
    // Analyze images for each product
    const analysisResults: AnalysisResult[] = [];
    const analysisErrors: Array<{ url: string; error: string }> = [...scrapeErrors];

    for (const product of scrapedProducts) {
      try {
        const result = await selectBestImage(product, useAI);
        analysisResults.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        analysisErrors.push({ url: product.sourceUrl, error: errorMessage });
      }
    }

    // Generate CSV output
    const csvOutput = await generateCsvOutput(analysisResults, analysisErrors);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vistaprint-images-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csvOutput);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Bulk analysis error:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await closeBrowser();
  process.exit(0);
});

export { app };
