/**
 * Image analyzer module using OpenAI Vision API
 * Selects the best product image for paid advertisements
 */

import OpenAI from 'openai';
import type {
  ProductImage,
  ScrapedProduct,
  ImageAnalysisResult,
  AnalysisResult,
} from './types.js';

const ANALYSIS_PROMPT = `You are an expert marketing analyst selecting images for paid product advertisements.

Analyze the provided product images and select the BEST one for a paid advertisement based on these criteria:

1. **Shows Full Product** (40% weight): The image should display the complete product clearly, not cropped or partially hidden.

2. **Shows Customization** (35% weight): The image should demonstrate that the product is customizable (e.g., shows personalized text, custom design, or indicates customization options).

3. **Clear Purpose/Use** (25% weight): A viewer should immediately understand what the product is and how it's used.

For each image, provide:
- A score from 0-100
- Whether it meets each criterion (true/false)
- Brief reasoning

Then select the single best image.

Respond in this exact JSON format:
{
  "images": [
    {
      "index": 0,
      "score": 85,
      "showsFullProduct": true,
      "showsCustomization": true,
      "clearPurpose": true,
      "reasoning": "Clear full view of business card with custom design visible"
    }
  ],
  "selectedIndex": 0,
  "selectedReasoning": "This image best represents the product for advertising because..."
}`;

let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client
 */
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is required for image analysis'
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Convert image URL to a format suitable for OpenAI Vision API
 */
function prepareImageUrl(url: string): string {
  // Ensure the URL is absolute
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
}

/**
 * Analyze product images and select the best one for advertising
 */
export async function analyzeImages(
  product: ScrapedProduct
): Promise<AnalysisResult> {
  const openai = getOpenAI();

  if (product.images.length === 0) {
    throw new Error('No images to analyze');
  }

  // Limit to first 8 images to stay within API limits
  const imagesToAnalyze = product.images.slice(0, 8);

  // Prepare messages with images
  const imageDescriptions = imagesToAnalyze
    .map((img, idx) => `Image ${idx + 1}: ${img.alt || 'No description'}`)
    .join('\n');

  const imageContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: `Product: ${product.productName}\n\nImages to analyze:\n${imageDescriptions}\n\n${ANALYSIS_PROMPT}`,
    },
    ...imagesToAnalyze.map(
      (img): OpenAI.Chat.ChatCompletionContentPart => ({
        type: 'image_url',
        image_url: {
          url: prepareImageUrl(img.url),
          detail: 'low', // Use low detail to reduce costs
        },
      })
    ),
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: imageContent,
        },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const analysis = JSON.parse(content) as {
      images: Array<{
        index: number;
        score: number;
        showsFullProduct: boolean;
        showsCustomization: boolean;
        clearPurpose: boolean;
        reasoning: string;
      }>;
      selectedIndex: number;
      selectedReasoning: string;
    };

    // Map analysis results
    const allImagesAnalyzed: ImageAnalysisResult[] = analysis.images.map(
      (img, idx) => ({
        imageUrl: imagesToAnalyze[idx].url,
        score: img.score,
        reasoning: img.reasoning,
        criteria: {
          showsFullProduct: img.showsFullProduct,
          showsCustomization: img.showsCustomization,
          clearPurpose: img.clearPurpose,
        },
      })
    );

    const selectedImage = imagesToAnalyze[analysis.selectedIndex];
    if (!selectedImage) {
      // Fallback to highest scored image
      const sorted = [...allImagesAnalyzed].sort((a, b) => b.score - a.score);
      return {
        sourceUrl: product.sourceUrl,
        productName: product.productName,
        selectedImageUrl: sorted[0].imageUrl,
        selectedImageReasoning: sorted[0].reasoning,
        allImagesAnalyzed,
        analyzedAt: new Date(),
      };
    }

    return {
      sourceUrl: product.sourceUrl,
      productName: product.productName,
      selectedImageUrl: selectedImage.url,
      selectedImageReasoning: analysis.selectedReasoning,
      allImagesAnalyzed,
      analyzedAt: new Date(),
    };
  } catch (error) {
    // If OpenAI fails, use heuristic fallback
    console.warn('OpenAI analysis failed, using heuristic fallback:', error);
    return analyzeImagesHeuristic(product);
  }
}

/**
 * Heuristic-based image selection (fallback when OpenAI is unavailable)
 */
export function analyzeImagesHeuristic(
  product: ScrapedProduct
): AnalysisResult {
  const scoredImages: ImageAnalysisResult[] = product.images.map((img) => {
    let score = 50; // Base score
    const criteria = {
      showsFullProduct: false,
      showsCustomization: false,
      clearPurpose: false,
    };

    // Heuristic: Larger images tend to show full product
    if (img.width && img.width >= 800) {
      score += 15;
      criteria.showsFullProduct = true;
    }

    // Heuristic: Alt text with certain keywords suggests customization/purpose
    const altLower = (img.alt || '').toLowerCase();
    if (
      altLower.includes('custom') ||
      altLower.includes('personalized') ||
      altLower.includes('design')
    ) {
      score += 20;
      criteria.showsCustomization = true;
    }

    // Heuristic: First few images are usually the main product shots
    if (img.index === 0) {
      score += 10;
      criteria.clearPurpose = true;
    } else if (img.index === 1) {
      score += 5;
    }

    // Heuristic: Images with certain URL patterns might be main images
    const urlLower = img.url.toLowerCase();
    if (urlLower.includes('main') || urlLower.includes('hero')) {
      score += 10;
    }

    // Avoid detail shots
    if (
      altLower.includes('detail') ||
      altLower.includes('close') ||
      altLower.includes('zoom')
    ) {
      score -= 15;
    }

    return {
      imageUrl: img.url,
      score,
      reasoning: `Heuristic score based on image position (${img.index}), size, and metadata`,
      criteria,
    };
  });

  // Sort by score and select best
  scoredImages.sort((a, b) => b.score - a.score);
  const best = scoredImages[0];

  return {
    sourceUrl: product.sourceUrl,
    productName: product.productName,
    selectedImageUrl: best.imageUrl,
    selectedImageReasoning: `Selected based on heuristic analysis: ${best.reasoning}`,
    allImagesAnalyzed: scoredImages,
    analyzedAt: new Date(),
  };
}

/**
 * Analyze a scraped product and select the best image
 */
export async function selectBestImage(
  product: ScrapedProduct,
  useAI: boolean = true
): Promise<AnalysisResult> {
  if (useAI && process.env.OPENAI_API_KEY) {
    return analyzeImages(product);
  }
  return analyzeImagesHeuristic(product);
}
