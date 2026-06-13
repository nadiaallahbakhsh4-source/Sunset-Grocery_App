import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function detectProductFromImage(base64Image: string, categories: string[], units: string[]) {
  let mimeType = "image/jpeg";
  let base64Data = base64Image;
  
  if (base64Image.startsWith("data:")) {
    const parts = base64Image.split(";base64,");
    mimeType = parts[0].substring(5);
    base64Data = parts[1];
  }

  const prompt = `You are a computer-vision based retail store inventory manager.
  Analyze the photo of this product taken at a grocery/kirana store.
  
  Do your absolute best to detect:
  1. The exact or generic Product Name (e.g. 'Shan Chicken Masala 50g' or 'Tapal Danedar Tea 250g' or 'Coca Cola 1.5L Bottle'). Must be highly professional and accurate.
  2. The logical Category from this specific list only:
     ${categories.join(", ")}
  3. The estimated typical cost/buying price of this product. Let's provide a logical trade price / buy price (e.g., in PKR or local currency based on item scale). If unknown, give a reasonable estimate like 100.
  4. The most applicable unit from this list:
     ${units.join(", ")}
  
  Return the output as a clean, strict JSON response matching this schema:
  {
    "name": "Exact detected name",
    "category": "One exact category from the list",
    "costPrice": number,
    "unit": "One exact unit from the list",
    "description": "Short description of the product brand/size detected"
  }
  
  Do NOT include any code block markdown like \`\`\`json or regular text. Only return the final JSON string.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        },
        {
          text: prompt
        }
      ],
      config: {
        systemInstruction: "You are a professional retail vision model. You parse grocery photographs and output precise inventory specifications in exact JSON format.",
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini Vision API");
    
    const data = JSON.parse(text.trim());
    
    // Fallback/validation checks
    if (!categories.includes(data.category)) {
      const matchedCat = categories.find(c => c.toLowerCase() === data.category?.toLowerCase() || c.toLowerCase().includes(data.category?.toLowerCase()));
      data.category = matchedCat || categories[0];
    }
    
    if (!units.includes(data.unit)) {
      data.unit = units[0];
    }
    
    data.costPrice = Number(data.costPrice) || 0;
    
    return data;
  } catch (error) {
    console.error("Gemini Vision Product Detection Error:", error);
    throw error;
  }
}

export async function generateBlessing(offering?: string) {
  const prompt = offering 
    ? `Generate a soul-soothing spiritual blessing or prayer for a grocery store named "Sunset Grocery". The store owner has offered "${offering}" today. The blessing should start with some Arabic (with phonetic transliteration) followed by a poetic English translation. Keep it short, shop-focused, and full of light.`
    : `Generate a soul-soothing spiritual blessing or prayer for a grocery store named "Sunset Grocery". The blessing should start with some Arabic (with phonetic transliteration) followed by a poetic English translation. Keep it short, shop-focused, and full of light.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a spiritual guide for a community grocery store. You provide beautiful, inclusive, and uplifting blessings in Arabic (with phonetic script) and English. Your tone is warm, respectful, and focused on abundance and peace.",
        temperature: 0.8,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}

export async function generateInventoryInsight(items: any[], sales: any[]) {
  const lowStock = items.filter(i => i.stock <= 5).map(i => `${i.name} (${i.stock} ${i.unit})`).join(', ');
  const totalValue = items.reduce((acc, i) => acc + (i.stock * i.costPrice), 0);
  const topSales = [...items].sort((a, b) => b.soldCount - a.soldCount).slice(0, 3).map(i => i.name).join(', ');
  const recentSalesCount = sales.length;
  
  const prompt = `You are a visionary business strategist for "Sunset Grocery". 
  Data for analysis:
  - Low stock items: ${lowStock || 'All items have healthy stock levels'}
  - Top 3 selling items: ${topSales || 'No sales recorded yet'}
  - Inventory financial value: ${totalValue}
  - Total sales transactions recorded: ${recentSalesCount}
  
  Provide a deep, poetic, yet practical business insight. Focus on what the owner should do next—reorder, promote a specific item, or celebrate a milestone. 
  
  IMPORTANT: Return the response in this exact format:
  [English message]
  ---
  [Urdu translation]
  
  Blend retail logic with a touch of spiritual encouragement. Keep each section under 40 words.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a mentor for small business owners. You see the soul in every sale and the blessing in every stocked shelf. You provide actionable advice in both English and Urdu, separated by '---'.",
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}

const KIRANA_LOCAL_MAP: Record<string, string> = {
  // Staples & Grains
  'atta': 'Atta, Dal & Rice',
  'flour': 'Atta, Dal & Rice',
  'rice': 'Atta, Dal & Rice',
  'chawal': 'Atta, Dal & Rice',
  'dal': 'Atta, Dal & Rice',
  'daal': 'Atta, Dal & Rice',
  'wheat': 'Atta, Dal & Rice',
  'besan': 'Atta, Dal & Rice',
  'maida': 'Atta, Dal & Rice',
  'suji': 'Atta, Dal & Rice',
  'sooji': 'Atta, Dal & Rice',
  'pulses': 'Atta, Dal & Rice',
  // Cooking Essentials
  'oil': 'Cooking Oil & Ghee',
  'ghee': 'Cooking Oil & Ghee',
  'cooking oil': 'Cooking Oil & Ghee',
  'mustard oil': 'Cooking Oil & Ghee',
  'dalda': 'Cooking Oil & Ghee',
  'canola': 'Cooking Oil & Ghee',
  // Spices & Masala
  'mirch': 'Spices & Masala',
  'chilli': 'Spices & Masala',
  'masala': 'Spices & Masala',
  'haldi': 'Spices & Masala',
  'turmeric': 'Spices & Masala',
  'dhaniya': 'Spices & Masala',
  'coriander': 'Spices & Masala',
  'pepper': 'Spices & Masala',
  'clove': 'Spices & Masala',
  'elaichi': 'Spices & Masala',
  'cardamom': 'Spices & Masala',
  // Sugar & Beverages
  'salt': 'Sugar, Salt & Tea',
  'namak': 'Sugar, Salt & Tea',
  'sugar': 'Sugar, Salt & Tea',
  'cheeni': 'Sugar, Salt & Tea',
  'gur': 'Sugar, Salt & Tea',
  'jaggery': 'Sugar, Salt & Tea',
  'tea': 'Sugar, Salt & Tea',
  'chai': 'Sugar, Salt & Tea',
  'patti': 'Sugar, Salt & Tea',
  'coffee': 'Sugar, Salt & Tea',
  'nescafe': 'Sugar, Salt & Tea',
  // Snacks & Biscuits
  'biscuit': 'Snacks & Biscuits',
  'cookies': 'Snacks & Biscuits',
  'chips': 'Snacks & Biscuits',
  'lays': 'Snacks & Biscuits',
  'kurkure': 'Snacks & Biscuits',
  'nimko': 'Snacks & Biscuits',
  'cake': 'Snacks & Biscuits',
  'rusk': 'Snacks & Biscuits',
  'papa': 'Snacks & Biscuits',
  // Beverages
  'coke': 'Beverages & Drinks',
  'pepsi': 'Beverages & Drinks',
  'sprite': 'Beverages & Drinks',
  'fanta': 'Beverages & Drinks',
  'juice': 'Beverages & Drinks',
  'water': 'Beverages & Drinks',
  'nestle': 'Beverages & Drinks',
  'tang': 'Beverages & Drinks',
  'rooh': 'Beverages & Drinks',
  'sting': 'Beverages & Drinks',
  'club': 'Beverages & Drinks',
  'soda': 'Beverages & Drinks',
  // Dairy & Bakery
  'milk': 'Dairy & Bread',
  'doodh': 'Dairy & Bread',
  'bread': 'Dairy & Bread',
  'egg': 'Dairy & Bread',
  'anda': 'Dairy & Bread',
  'butter': 'Dairy & Bread',
  'makhan': 'Dairy & Bread',
  'cheese': 'Dairy & Bread',
  'yogurt': 'Dairy & Bread',
  'dahi': 'Dairy & Bread',
  'paneer': 'Dairy & Bread',
  'bun': 'Dairy & Bread',
  // Personal Care
  'soap': 'Soaps & Shampoos',
  'sabun': 'Soaps & Shampoos',
  'shampoo': 'Soaps & Shampoos',
  'toothpaste': 'Soaps & Shampoos',
  'paste': 'Soaps & Shampoos',
  'colgate': 'Soaps & Shampoos',
  'lux': 'Soaps & Shampoos',
  'detol': 'Soaps & Shampoos',
  'dettol': 'Soaps & Shampoos',
  'lifebuoy': 'Soaps & Shampoos',
  'pantene': 'Soaps & Shampoos',
  'sunsilk': 'Soaps & Shampoos',
  'brush': 'Soaps & Shampoos',
  // Household
  'surf': 'Detergents & Cleaners',
  'ariel': 'Detergents & Cleaners',
  'cleaner': 'Detergents & Cleaners',
  'phenyl': 'Detergents & Cleaners',
  'vim': 'Detergents & Cleaners',
  'dishwash': 'Detergents & Cleaners',
  'detergent': 'Detergents & Cleaners',
  'harpic': 'Detergents & Cleaners',
  'mop': 'Detergents & Cleaners',
  'tide': 'Detergents & Cleaners',
  'brite': 'Detergents & Cleaners',
  'bonus': 'Detergents & Cleaners',
  'express': 'Detergents & Cleaners',
  'wheel': 'Detergents & Cleaners',
  // Instant Food
  'maggi': 'Instant Noodles & Pasta',
  'knorr': 'Instant Noodles & Pasta',
  'noodles': 'Instant Noodles & Pasta',
  'pasta': 'Instant Noodles & Pasta',
  'ketchup': 'Instant Noodles & Pasta',
  'jam': 'Dairy & Bread',
  'maiyonese': 'Instant Noodles & Pasta',
  'mayo': 'Instant Noodles & Pasta',
  'shangrila': 'Instant Noodles & Pasta',
  'national': 'Spices & Masala',
  'shan': 'Spices & Masala',
  // Confectionery
  'chocolate': 'Chocolates & Candies',
  'candy': 'Chocolates & Candies',
  'toffee': 'Chocolates & Candies',
  'dairy milk': 'Chocolates & Candies',
  'kitkat': 'Chocolates & Candies',
  'perk': 'Chocolates & Candies',
  'eclair': 'Chocolates & Candies',
  // Tea brands
  'lipton': 'Sugar, Salt & Tea',
  'tapal': 'Sugar, Salt & Tea',
  'danedar': 'Sugar, Salt & Tea',
  'vital': 'Sugar, Salt & Tea',
  // Dry Fruits
  'almond': 'Dry Fruits & Nuts',
  'badam': 'Dry Fruits & Nuts',
  'walnut': 'Dry Fruits & Nuts',
  'akhrot': 'Dry Fruits & Nuts',
  'kaju': 'Dry Fruits & Nuts',
  'cashew': 'Dry Fruits & Nuts',
  'pista': 'Dry Fruits & Nuts',
  'pistachio': 'Dry Fruits & Nuts',
  'kishmish': 'Dry Fruits & Nuts',
  'raisin': 'Dry Fruits & Nuts',
};

export async function predictCategory(productName: string, categories: string[]) {
  if (!productName || productName.length < 2) return null;

  const lowerName = productName.toLowerCase();
  
  // 1. Instant Local Check for Speed
  for (const [keyword, category] of Object.entries(KIRANA_LOCAL_MAP)) {
    if (lowerName.includes(keyword)) {
      if (categories.includes(category)) return category;
    }
  }

  // 2. AI Prediction with better prompt
  const prompt = `You are a categorization assistant for a South Asian Kirana (Grocery) Store.
  Product Name: "${productName}"
  
  Select the most logical category from this specific list:
  ${categories.join(', ')}
  
  Rules:
  - Return ONLY the category name exactly as it appears above.
  - If it's a food item not matching others, use "Others".
  - If it's a household item, use "Detergents & Cleaners" or "Soaps & Shampoos".
  - Be culturally aware of terms like 'Atta', 'Ghee', 'Dal', 'Chai'.
  
  Response:`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a Kirana store inventory expert. You provide single-word categorization from a provided list.",
        temperature: 0.1,
      },
    });

    // FIX: Safely check if response.text exists
    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini Category Prediction API");

    const result = text.trim().split('\n')[0].replace(/[".]/g, '');
    
    // Validate result is in our category list
    if (categories.includes(result)) return result;
    
    // Fuzzy match if not exact
    const fuzzyMatch = categories.find(c => result.includes(c) || c.includes(result));
    return fuzzyMatch || "Others";
  } catch (error) {
    console.error("Gemini Category Prediction Error:", error);
    return "Others";
  }
}