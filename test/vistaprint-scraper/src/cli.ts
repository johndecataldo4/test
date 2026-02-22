#!/usr/bin/env node
/**
 * CLI interface for the Vistaprint Image Scraper
 */

import { writeFileSync } from 'fs';
import { scrapeProductPage, scrapeMultiplePages, closeBrowser } from './scraper.js';
import { selectBestImage } from './analyzer.js';
import { parseCsvFile, generateCsvOutput } from './csv.js';
import type { AnalysisResult } from './types.js';

function printUsage(): void {
  console.log(`
Vistaprint Image Scraper - CLI

Usage:
  npx tsx src/cli.ts <url>                    Analyze a single product page
  npx tsx src/cli.ts --csv <input.csv>        Analyze URLs from CSV file
  npx tsx src/cli.ts --csv <input.csv> --out <output.csv>

Options:
  --csv <file>     Input CSV file with URLs
  --out <file>     Output CSV file (default: output.csv)
  --no-ai          Disable AI analysis, use heuristic only
  --help           Show this help message

Environment Variables:
  OPENAI_API_KEY   Required for AI-powered image analysis

Examples:
  npx tsx src/cli.ts "https://www.vistaprint.com/business-cards/standard"
  npx tsx src/cli.ts --csv products.csv --out results.csv
  `);
}

async function analyzeSingleUrl(url: string, useAI: boolean): Promise<void> {
  console.log(`\nAnalyzing: ${url}\n`);

  try {
    const product = await scrapeProductPage(url);
    console.log(`Found ${product.images.length} images for: ${product.productName}`);

    const result = await selectBestImage(product, useAI);

    console.log('\n' + '='.repeat(60));
    console.log('ANALYSIS RESULT');
    console.log('='.repeat(60));
    console.log(`Product: ${result.productName}`);
    console.log(`\nSelected Image URL:`);
    console.log(result.selectedImageUrl);
    console.log(`\nReasoning:`);
    console.log(result.selectedImageReasoning);
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}

async function analyzeCsvFile(
  inputFile: string,
  outputFile: string,
  useAI: boolean
): Promise<void> {
  console.log(`\nProcessing CSV: ${inputFile}\n`);

  try {
    const urls = await parseCsvFile(inputFile);

    if (urls.length === 0) {
      console.error('No valid Vistaprint URLs found in CSV');
      process.exit(1);
    }

    console.log(`Found ${urls.length} URLs to process\n`);

    // Scrape all pages
    const { results: scrapedProducts, errors: scrapeErrors } =
      await scrapeMultiplePages(urls);

    // Analyze images
    const analysisResults: AnalysisResult[] = [];
    const analysisErrors: Array<{ url: string; error: string }> = [
      ...scrapeErrors,
    ];

    for (const product of scrapedProducts) {
      try {
        console.log(`Analyzing: ${product.productName}`);
        const result = await selectBestImage(product, useAI);
        analysisResults.push(result);
        console.log(`  ✓ Selected image for ${product.productName}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        analysisErrors.push({ url: product.sourceUrl, error: errorMessage });
        console.log(`  ✗ Failed: ${errorMessage}`);
      }
    }

    // Generate output CSV
    const csvOutput = await generateCsvOutput(analysisResults, analysisErrors);
    writeFileSync(outputFile, csvOutput);

    console.log('\n' + '='.repeat(60));
    console.log('PROCESSING COMPLETE');
    console.log('='.repeat(60));
    console.log(`Successful: ${analysisResults.length}`);
    console.log(`Errors: ${analysisErrors.length}`);
    console.log(`Output saved to: ${outputFile}`);
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const useAI = !args.includes('--no-ai');
  const csvIndex = args.indexOf('--csv');
  const outIndex = args.indexOf('--out');

  try {
    if (csvIndex !== -1) {
      // CSV mode
      const inputFile = args[csvIndex + 1];
      const outputFile = outIndex !== -1 ? args[outIndex + 1] : 'output.csv';

      if (!inputFile) {
        console.error('Error: CSV file path required');
        printUsage();
        process.exit(1);
      }

      await analyzeCsvFile(inputFile, outputFile, useAI);
    } else {
      // Single URL mode
      const url = args.find((arg) => arg.includes('vistaprint.com'));

      if (!url) {
        console.error('Error: Vistaprint URL required');
        printUsage();
        process.exit(1);
      }

      await analyzeSingleUrl(url, useAI);
    }
  } finally {
    await closeBrowser();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
