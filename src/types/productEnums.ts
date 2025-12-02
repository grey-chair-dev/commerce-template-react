/**
 * Product Enums
 * 
 * Type-safe enums for product-related values used throughout the application
 */

/**
 * Record Format - Physical format of the record
 */
export enum RecordFormat {
  LP = 'LP',                    // 12" Long Play
  TWELVE_INCH = '12"',          // 12" Single/EP
  SEVEN_INCH = '7"',            // 7" Single
  TEN_INCH = '10"',             // 10" EP
  CD = 'CD',                    // Compact Disc
  CASSETTE = 'Cassette',        // Cassette Tape
  DIGITAL = 'Digital',          // Digital Download
  BOX_SET = 'Box Set',          // Multi-disc box set
  VINYL = 'Vinyl',              // Generic vinyl (if format unknown)
}

/**
 * Record Condition - Condition grading system
 * Based on Goldmine Standard (common in record collecting)
 */
export enum RecordCondition {
  // Near Mint (best condition)
  NEAR_MINT = 'NM',             // Near Mint - Like new
  NEAR_MINT_MINUS = 'NM-',      // Near Mint Minus - Tiny flaws
  
  // Very Good Plus (excellent)
  VERY_GOOD_PLUS = 'VG+',       // Very Good Plus - Minor wear
  VERY_GOOD = 'VG',             // Very Good - Noticeable wear but plays well
  VERY_GOOD_MINUS = 'VG-',      // Very Good Minus - More wear
  
  // Good (playable)
  GOOD_PLUS = 'G+',             // Good Plus - Significant wear
  GOOD = 'G',                   // Good - Heavy wear, may have issues
  GOOD_MINUS = 'G-',            // Good Minus - Poor condition
  
  // Poor (may not play)
  POOR = 'P',                   // Poor - May not play
  FAIR = 'F',                   // Fair - Very poor condition
}

/**
 * Product categories for Spiral Groove Records
 * Based on Square catalog categories
 */
export enum ProductCategory {
  // Main Categories
  UNCATEGORIZED = 'Uncategorized',
  NEW_33 = '33New',
  USED_33 = '33Used',
  FORTY_FIVE = '45',
  
  // Media Formats
  CASSETTES = 'Cassettes',
  CDS = "CD's",
  DVDS = "DVD's",
  VHS = 'VHS',
  NEW_VINYL = 'New Vinyl',
  USED_VINYL = 'Used Vinyl',
  
  // Music Genres
  BLUEGRASS = 'Bluegrass',
  BLUES = 'Blues',
  COMPILATIONS = 'Compilations',
  COUNTRY = 'Country',
  ELECTRONIC = 'Electronic',
  FOLK = 'Folk',
  FUNK_SOUL = 'Funk/Soul',
  INDIE = 'Indie',
  INDUSTRIAL = 'Industrial',
  JAZZ = 'Jazz',
  METAL = 'Metal',
  POP = 'Pop',
  PUNK_SKA = 'Punk/Ska',
  RAP_HIP_HOP = 'Rap/Hip-Hop',
  REGGAE = 'Reggae',
  ROCK = 'Rock',
  SINGER_SONGWRITER = 'Singer Songwriter',
  SOUNDTRACKS = 'Soundtracks',
  OTHER = 'Other',
  
  // Collectibles & Toys
  ACTION_FIGURES = 'Action Figures',
  FUNKO_POP = 'Funko Pop',
  ANIMALS_MINIS = 'Animals (Minis)',
  
  // Accessories & Merchandise
  ADAPTERS = 'Adapters',
  BUTTONS = 'Buttons',
  CANDLES = 'Candles',
  CLEANER = 'Cleaner',
  COASTERS = 'Coasters',
  COFFEE_MUG = 'Coffee Mug',
  CRATES = 'Crates',
  EQUIPMENT = 'Equipment',
  GUITAR_PICKS = 'Guitar picks',
  HATS = 'Hats',
  JEWELRY = 'Jewelry',
  PATCHES = 'Patches',
  PIN = 'Pin',
  POSTER = 'Poster',
  SLEEVES = 'Sleeves',
  SLIP_MAT = 'Slip Mat',
  SPIN_CLEAN = 'Spin Clean',
  STICKER = 'Sticker',
  T_SHIRTS = 'T-Shirts',
  TOTE_BAG = 'Tote Bag',
  WALLETS = 'Wallets',
  WRISTBAND = 'Wristband',
  
  // Other Items
  BOOK = 'Book',
  BOOMBOX = 'Boombox',
  BOWL = 'Bowl',
  BOX_SET = 'Box Set',
  DRINKS = 'Drinks',
  FOOD = 'Food',
  INCENSE = 'Incense',
  CHARMS = 'Charms',
  SPROUTS = 'Sprouts',
  LAVA_LAMPS = 'Lava Lamps',
  ESSENTIAL_OILS = 'Essential Oils',
  PUZZLE = 'Puzzle',
  RECORD_STORE_DAY = 'Record Store Day',
  VIDEOGAMES = 'Videogames',
  MISCELLANEOUS = 'Miscellaneous',
}

/**
 * Category groups for filtering/organization
 */
export const CategoryGroups: Record<string, ProductCategory[]> = {
  VINYL: [
    ProductCategory.NEW_VINYL,
    ProductCategory.USED_VINYL,
    ProductCategory.NEW_33,
    ProductCategory.USED_33,
    ProductCategory.FORTY_FIVE,
  ],
  
  MEDIA: [
    ProductCategory.CASSETTES,
    ProductCategory.CDS,
    ProductCategory.DVDS,
    ProductCategory.VHS,
  ],
  
  GENRES: [
    ProductCategory.BLUEGRASS,
    ProductCategory.BLUES,
    ProductCategory.COMPILATIONS,
    ProductCategory.COUNTRY,
    ProductCategory.ELECTRONIC,
    ProductCategory.FOLK,
    ProductCategory.FUNK_SOUL,
    ProductCategory.INDIE,
    ProductCategory.INDUSTRIAL,
    ProductCategory.JAZZ,
    ProductCategory.METAL,
    ProductCategory.POP,
    ProductCategory.PUNK_SKA,
    ProductCategory.RAP_HIP_HOP,
    ProductCategory.REGGAE,
    ProductCategory.ROCK,
    ProductCategory.SINGER_SONGWRITER,
    ProductCategory.SOUNDTRACKS,
    ProductCategory.OTHER,
  ],
  
  COLLECTIBLES: [
    ProductCategory.ACTION_FIGURES,
    ProductCategory.FUNKO_POP,
    ProductCategory.ANIMALS_MINIS,
    ProductCategory.CHARMS,
    ProductCategory.PIN,
    ProductCategory.PATCHES,
    ProductCategory.BUTTONS,
    ProductCategory.WRISTBAND,
    ProductCategory.JEWELRY,
  ],
  
  ACCESSORIES: [
    ProductCategory.GUITAR_PICKS,
    ProductCategory.SLEEVES,
    ProductCategory.SLIP_MAT,
    ProductCategory.SPIN_CLEAN,
    ProductCategory.CLEANER,
    ProductCategory.CRATES,
    ProductCategory.WALLETS,
    ProductCategory.TOTE_BAG,
    ProductCategory.T_SHIRTS,
    ProductCategory.HATS,
    ProductCategory.STICKER,
    ProductCategory.POSTER,
    ProductCategory.COFFEE_MUG,
    ProductCategory.COASTERS,
  ],
  
  ELECTRONICS: [
    ProductCategory.EQUIPMENT,
    ProductCategory.ADAPTERS,
    ProductCategory.BOOMBOX,
  ],
  
  HOME_LIFESTYLE: [
    ProductCategory.CANDLES,
    ProductCategory.INCENSE,
    ProductCategory.ESSENTIAL_OILS,
    ProductCategory.LAVA_LAMPS,
    ProductCategory.BOWL,
  ],
  
  FOOD_DRINK: [
    ProductCategory.FOOD,
    ProductCategory.DRINKS,
  ],
  
  BOOKS_MEDIA: [
    ProductCategory.BOOK,
    ProductCategory.BOX_SET,
    ProductCategory.PUZZLE,
    ProductCategory.VIDEOGAMES,
  ],
  
  EVENTS: [
    ProductCategory.RECORD_STORE_DAY,
  ],
  
  UNCATEGORIZED: [
    ProductCategory.SPROUTS,
    ProductCategory.MISCELLANEOUS,
    ProductCategory.UNCATEGORIZED,
  ],
}

/**
 * Get all category values as an array
 */
export function getAllCategories(): string[] {
  return Object.values(ProductCategory)
}

/**
 * Check if a string is a valid category
 */
export function isValidCategory(category: string): boolean {
  return Object.values(ProductCategory).includes(category as ProductCategory)
}

/**
 * Get category group for a given category
 */
export function getCategoryGroup(category: string): string | null {
  for (const [groupName, categories] of Object.entries(CategoryGroups)) {
    if (categories.includes(category as ProductCategory)) {
      return groupName
    }
  }
  return null
}

/**
 * Product Status - Stock/inventory status
 */
export enum ProductStatus {
  IN_STOCK = 'in_stock',        // Available (stock > 0)
  LOW_STOCK = 'low_stock',      // Low stock (stock <= threshold)
  OUT_OF_STOCK = 'out_of_stock', // Out of stock (stock = 0)
  DISCONTINUED = 'discontinued', // No longer available
  PRE_ORDER = 'pre_order',      // Available for pre-order
  COMING_SOON = 'coming_soon',  // Coming soon
}

/**
 * Order Status - Order processing status
 */
export enum OrderStatus {
  PENDING = 'pending',          // Order placed, awaiting processing
  PROCESSING = 'processing',    // Order being processed
  CONFIRMED = 'confirmed',      // Order confirmed
  SHIPPED = 'shipped',          // Order shipped
  DELIVERED = 'delivered',      // Order delivered
  CANCELLED = 'cancelled',      // Order cancelled
  REFUNDED = 'refunded',        // Order refunded
}

/**
 * Staff Pick Status
 */
export enum StaffPickStatus {
  NONE = 'none',                // Not a staff pick
  FEATURED = 'featured',        // Featured staff pick
  NEW_ARRIVAL = 'new_arrival',  // New arrival pick
  CLEARANCE = 'clearance',      // Clearance pick
}

/**
 * Product Sort Options
 */
export enum ProductSortOption {
  FEATURED = 'featured',        // Featured first
  PRICE_ASC = 'priceAsc',       // Price: Low to High
  PRICE_DESC = 'priceDesc',     // Price: High to Low
  NAME_ASC = 'nameAsc',         // Name: A to Z
  NAME_DESC = 'nameDesc',       // Name: Z to A
  NEWEST = 'newest',            // Newest first
  OLDEST = 'oldest',            // Oldest first
  STOCK_ASC = 'stockAsc',       // Stock: Low to High
  STOCK_DESC = 'stockDesc',     // Stock: High to Low
}

/**
 * Helper functions to work with enums
 */

/**
 * Get condition display name
 */
export function getConditionDisplayName(condition: RecordCondition | string): string {
  const conditionMap: Record<string, string> = {
    [RecordCondition.NEAR_MINT]: 'Near Mint',
    [RecordCondition.NEAR_MINT_MINUS]: 'Near Mint-',
    [RecordCondition.VERY_GOOD_PLUS]: 'Very Good+',
    [RecordCondition.VERY_GOOD]: 'Very Good',
    [RecordCondition.VERY_GOOD_MINUS]: 'Very Good-',
    [RecordCondition.GOOD_PLUS]: 'Good+',
    [RecordCondition.GOOD]: 'Good',
    [RecordCondition.GOOD_MINUS]: 'Good-',
    [RecordCondition.POOR]: 'Poor',
    [RecordCondition.FAIR]: 'Fair',
  }
  return conditionMap[condition] || condition
}

/**
 * Get format display name
 */
export function getFormatDisplayName(format: RecordFormat | string): string {
  const formatMap: Record<string, string> = {
    [RecordFormat.LP]: 'LP (12")',
    [RecordFormat.TWELVE_INCH]: '12"',
    [RecordFormat.SEVEN_INCH]: '7"',
    [RecordFormat.TEN_INCH]: '10"',
    [RecordFormat.CD]: 'CD',
    [RecordFormat.CASSETTE]: 'Cassette',
    [RecordFormat.DIGITAL]: 'Digital',
    [RecordFormat.BOX_SET]: 'Box Set',
    [RecordFormat.VINYL]: 'Vinyl',
  }
  return formatMap[format] || format
}

/**
 * Get product status display name
 */
export function getProductStatusDisplayName(status: ProductStatus | string): string {
  const statusMap: Record<string, string> = {
    [ProductStatus.IN_STOCK]: 'In Stock',
    [ProductStatus.LOW_STOCK]: 'Low Stock',
    [ProductStatus.OUT_OF_STOCK]: 'Out of Stock',
    [ProductStatus.DISCONTINUED]: 'Discontinued',
    [ProductStatus.PRE_ORDER]: 'Pre-Order',
    [ProductStatus.COMING_SOON]: 'Coming Soon',
  }
  return statusMap[status] || status
}

/**
 * Get order status display name
 */
export function getOrderStatusDisplayName(status: OrderStatus | string): string {
  const statusMap: Record<string, string> = {
    [OrderStatus.PENDING]: 'Pending',
    [OrderStatus.PROCESSING]: 'Processing',
    [OrderStatus.CONFIRMED]: 'Confirmed',
    [OrderStatus.SHIPPED]: 'Shipped',
    [OrderStatus.DELIVERED]: 'Delivered',
    [OrderStatus.CANCELLED]: 'Cancelled',
    [OrderStatus.REFUNDED]: 'Refunded',
  }
  return statusMap[status] || status
}

/**
 * Calculate product status from stock count
 */
export function getProductStatusFromStock(
  stockCount: number,
  lowStockThreshold: number = 10
): ProductStatus {
  if (stockCount === 0) {
    return ProductStatus.OUT_OF_STOCK
  }
  if (stockCount <= lowStockThreshold) {
    return ProductStatus.LOW_STOCK
  }
  return ProductStatus.IN_STOCK
}

/**
 * Check if condition is playable
 */
export function isConditionPlayable(condition: RecordCondition | string): boolean {
  const playableConditions = [
    RecordCondition.NEAR_MINT,
    RecordCondition.NEAR_MINT_MINUS,
    RecordCondition.VERY_GOOD_PLUS,
    RecordCondition.VERY_GOOD,
    RecordCondition.VERY_GOOD_MINUS,
    RecordCondition.GOOD_PLUS,
    RecordCondition.GOOD,
  ]
  return playableConditions.includes(condition as RecordCondition)
}

/**
 * Get all format options as array
 */
export function getAllFormats(): string[] {
  return Object.values(RecordFormat)
}

/**
 * Get all condition options as array
 */
export function getAllConditions(): string[] {
  return Object.values(RecordCondition)
}

