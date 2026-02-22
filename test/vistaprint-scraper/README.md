# Vistaprint Image Scraper

A web scraping application that analyzes Vistaprint product pages and selects the optimal image for paid advertisements. Uses AI-powered analysis (OpenAI GPT-4 Vision) or heuristic fallback to select images that:

- Show the full product clearly
- Demonstrate product customization capabilities
- Help customers understand the product's purpose and use

## Features

- **Single URL Analysis**: Analyze one product page at a time via web interface or CLI
- **Bulk Analysis**: Process multiple URLs from a CSV file
- **AI-Powered Selection**: Uses OpenAI GPT-4 Vision API for intelligent image selection
- **Heuristic Fallback**: Works without API key using image metadata and position heuristics
- **Web Interface**: User-friendly browser-based interface
- **CLI Support**: Command-line interface for automation and scripting

## Installation

```bash
# Clone or navigate to the project directory
cd vistaprint-scraper

# Install dependencies
npm install

# Copy environment example (optional, for AI features)
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Usage

### Web Interface

Start the server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

**Single URL Analysis:**
1. Enter a Vistaprint product page URL
2. Click "Analyze"
3. View the selected image and reasoning

**Bulk Analysis:**
1. Upload a CSV file with product URLs
2. Click "Process CSV"
3. Download the results CSV file

### CLI

```bash
# Analyze a single URL
npx tsx src/cli.ts "https://www.vistaprint.com/business-cards/standard"

# Process a CSV file
npx tsx src/cli.ts --csv input.csv --out results.csv

# Use heuristic analysis only (no API key needed)
npx tsx src/cli.ts --no-ai "https://www.vistaprint.com/business-cards/standard"
```

### API Endpoints

```bash
# Single URL analysis
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.vistaprint.com/business-cards/standard"}'

# Bulk analysis (upload CSV)
curl -X POST http://localhost:3000/api/analyze-bulk \
  -F "csvFile=@input.csv" \
  -o results.csv

# Health check
curl http://localhost:3000/api/health
```

## CSV Format

### Input CSV

The input CSV should have a column named `url`, `URL`, `link`, or `product_url`:

```csv
url
https://www.vistaprint.com/business-cards/standard
https://www.vistaprint.com/marketing-materials/flyers
https://www.vistaprint.com/signs-posters/banners
```

### Output CSV

The output CSV contains:

| Column | Description |
|--------|-------------|
| Source URL | Original product page URL |
| Product Name | Product name from the page |
| Selected Image URL | URL of the best image for advertising |
| Selection Reasoning | Explanation of why this image was selected |
| Status | `success` or `error` |
| Error Message | Error details if status is `error` |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For AI analysis | OpenAI API key for GPT-4 Vision |
| `PORT` | No | Server port (default: 3000) |

## How It Works

1. **Web Scraping**: Uses Puppeteer to load the Vistaprint product page and extract images from the product carousel/gallery
2. **Image Analysis**: Evaluates each image based on:
   - Does it show the full product? (40% weight)
   - Does it show customization? (35% weight)
   - Is the product purpose clear? (25% weight)
3. **Selection**: Returns the best image URL with reasoning

### AI Analysis (with OPENAI_API_KEY)

When an API key is provided, the application sends images to GPT-4 Vision for intelligent analysis considering visual content, composition, and advertising effectiveness.

### Heuristic Analysis (fallback)

Without an API key, uses heuristics based on:
- Image dimensions (larger = better)
- Image position (first images are typically hero shots)
- Alt text keywords (custom, personalized, design)
- URL patterns (main, hero)

## Project Structure

```
vistaprint-scraper/
├── src/
│   ├── index.ts      # Main entry point (web server)
│   ├── cli.ts        # Command-line interface
│   ├── server.ts     # Express server and routes
│   ├── scraper.ts    # Puppeteer web scraper
│   ├── analyzer.ts   # Image analysis (AI + heuristic)
│   ├── csv.ts        # CSV parsing and generation
│   └── types.ts      # TypeScript type definitions
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Limitations

- Only works with vistaprint.com URLs
- Website structure changes may require selector updates
- AI analysis requires OpenAI API credits
- Rate limiting may apply for bulk processing

## Troubleshooting

**"No product images found"**
- The page structure may have changed
- Try a different product page URL

**"OPENAI_API_KEY required"**
- Set the environment variable or use `--no-ai` flag

**Puppeteer errors on macOS**
- Run `xcode-select --install` for required tools

## License

MIT
