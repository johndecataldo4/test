/**
 * CSV processing utilities for bulk analysis
 */

import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import type { CsvInputRow, CsvOutputRow, AnalysisResult } from './types.js';

/**
 * Parse a CSV file and extract URLs
 */
export async function parseCsvFile(filePath: string): Promise<string[]> {
  const urls: string[] = [];

  return new Promise((resolve, reject) => {
    const parser = createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      })
    );

    parser.on('data', (row: Record<string, string>) => {
      // Look for URL in common column names
      const urlColumnNames = ['url', 'URL', 'Url', 'link', 'Link', 'LINK', 'product_url', 'productUrl'];
      
      for (const colName of urlColumnNames) {
        if (row[colName]) {
          const url = row[colName].trim();
          if (url && url.includes('vistaprint.com')) {
            urls.push(url);
            break;
          }
        }
      }

      // If no standard column found, check all columns for URLs
      if (urls.length === 0 || !urls.includes(Object.values(row)[0])) {
        for (const value of Object.values(row)) {
          if (typeof value === 'string' && value.includes('vistaprint.com')) {
            const trimmed = value.trim();
            if (!urls.includes(trimmed)) {
              urls.push(trimmed);
            }
            break;
          }
        }
      }
    });

    parser.on('error', reject);
    parser.on('end', () => resolve(urls));
  });
}

/**
 * Parse CSV from a string buffer
 */
export async function parseCsvBuffer(buffer: Buffer): Promise<string[]> {
  const urls: string[] = [];

  return new Promise((resolve, reject) => {
    const readable = Readable.from(buffer);
    const parser = readable.pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      })
    );

    parser.on('data', (row: Record<string, string>) => {
      // Look for URL in common column names
      const urlColumnNames = ['url', 'URL', 'Url', 'link', 'Link', 'LINK', 'product_url', 'productUrl'];
      
      for (const colName of urlColumnNames) {
        if (row[colName]) {
          const url = row[colName].trim();
          if (url && url.includes('vistaprint.com')) {
            urls.push(url);
            break;
          }
        }
      }

      // If no standard column found, check all columns for URLs
      for (const value of Object.values(row)) {
        if (typeof value === 'string' && value.includes('vistaprint.com')) {
          const trimmed = value.trim();
          if (!urls.includes(trimmed)) {
            urls.push(trimmed);
          }
          break;
        }
      }
    });

    parser.on('error', reject);
    parser.on('end', () => resolve([...new Set(urls)])); // Dedupe
  });
}

/**
 * Generate CSV output from analysis results
 */
export async function generateCsvOutput(
  results: AnalysisResult[],
  errors: Array<{ url: string; error: string }> = []
): Promise<string> {
  const rows: CsvOutputRow[] = [];

  // Add successful results
  for (const result of results) {
    rows.push({
      source_url: result.sourceUrl,
      product_name: result.productName,
      selected_image_url: result.selectedImageUrl,
      reasoning: result.selectedImageReasoning,
      status: 'success',
    });
  }

  // Add errors
  for (const error of errors) {
    rows.push({
      source_url: error.url,
      product_name: '',
      selected_image_url: '',
      reasoning: '',
      status: 'error',
      error_message: error.error,
    });
  }

  return new Promise((resolve, reject) => {
    stringify(
      rows,
      {
        header: true,
        columns: [
          { key: 'source_url', header: 'Source URL' },
          { key: 'product_name', header: 'Product Name' },
          { key: 'selected_image_url', header: 'Selected Image URL' },
          { key: 'reasoning', header: 'Selection Reasoning' },
          { key: 'status', header: 'Status' },
          { key: 'error_message', header: 'Error Message' },
        ],
      },
      (err: Error | undefined, output: string) => {
        if (err) reject(err);
        else resolve(output);
      }
    );
  });
}

/**
 * Generate a simple CSV with just URLs
 */
export async function generateSimpleCsvOutput(
  results: AnalysisResult[]
): Promise<string> {
  const rows = results.map((r) => ({
    source_url: r.sourceUrl,
    selected_image_url: r.selectedImageUrl,
  }));

  return new Promise((resolve, reject) => {
    stringify(
      rows,
      {
        header: true,
        columns: [
          { key: 'source_url', header: 'Source URL' },
          { key: 'selected_image_url', header: 'Selected Image URL' },
        ],
      },
      (err: Error | undefined, output: string) => {
        if (err) reject(err);
        else resolve(output);
      }
    );
  });
}
