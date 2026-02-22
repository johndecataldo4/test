/**
 * Type definitions for the Vistaprint Image Scraper
 */

export interface ProductImage {
  url: string;
  alt: string;
  index: number;
  width?: number;
  height?: number;
}

export interface ScrapedProduct {
  sourceUrl: string;
  productName: string;
  images: ProductImage[];
  scrapedAt: Date;
}

export interface ImageAnalysisResult {
  imageUrl: string;
  score: number;
  reasoning: string;
  criteria: {
    showsFullProduct: boolean;
    showsCustomization: boolean;
    clearPurpose: boolean;
  };
}

export interface AnalysisResult {
  sourceUrl: string;
  productName: string;
  selectedImageUrl: string;
  selectedImageReasoning: string;
  allImagesAnalyzed: ImageAnalysisResult[];
  analyzedAt: Date;
}

export interface BulkAnalysisInput {
  urls: string[];
}

export interface BulkAnalysisResult {
  results: AnalysisResult[];
  errors: Array<{
    url: string;
    error: string;
  }>;
  processedAt: Date;
}

export interface CsvInputRow {
  url: string;
}

export interface CsvOutputRow {
  source_url: string;
  product_name: string;
  selected_image_url: string;
  reasoning: string;
  status: 'success' | 'error';
  error_message?: string;
}
