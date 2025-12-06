/**
 * Product Categorization Utilities
 * 
 * Infers product category, format, and other details from product names
 * and descriptions using the defined enums.
 */

import {
  ProductCategory,
  RecordFormat,
  RecordCondition,
  ProductStatus,
  getProductStatusFromStock,
} from '../types/productEnums.js'

/**
 * Infer record format from product name
 */
export function inferFormat(name: string, description: string = ''): RecordFormat | string {
  const text = `${name} ${description}`.toLowerCase()
  
  // Check for explicit format mentions
  if (text.includes('7"') || text.includes('7 inch') || text.includes('7-inch')) {
    return RecordFormat.SEVEN_INCH
  }
  if (text.includes('10"') || text.includes('10 inch') || text.includes('10-inch')) {
    return RecordFormat.TEN_INCH
  }
  if (text.includes('12"') || text.includes('12 inch') || text.includes('12-inch')) {
    return RecordFormat.TWELVE_INCH
  }
  if (text.includes('lp') && !text.includes('cd')) {
    return RecordFormat.LP
  }
  if (text.includes('cd') || text.includes('compact disc')) {
    return RecordFormat.CD
  }
  if (text.includes('cassette') || text.includes('tape')) {
    return RecordFormat.CASSETTE
  }
  if (text.includes('box set') || text.includes('boxset')) {
    return RecordFormat.BOX_SET
  }
  if (text.includes('digital') || text.includes('download')) {
    return RecordFormat.DIGITAL
  }
  
  // Check for common patterns in names
  if (name.includes(' - 33') || name.includes(' - 45')) {
    return RecordFormat.LP // 33 RPM is typically LP, 45 RPM is typically 7"
  }
  if (name.includes(' - CD')) {
    return RecordFormat.CD
  }
  if (name.includes(' - Cassettes')) {
    return RecordFormat.CASSETTE
  }
  
  // Default to vinyl if it's a music release (has artist - album format)
  if (name.includes(' - ') && !text.includes('t-shirt') && !text.includes('poster') && !text.includes('book')) {
    return RecordFormat.LP // Assume LP for music releases
  }
  
  return RecordFormat.VINYL // Default fallback
}

/**
 * Infer product category from product name and description
 * Uses Spiral Groove's actual Square catalog categories
 */
export function inferCategory(name: string, description: string = ''): ProductCategory | string {
  const text = `${name} ${description}`.toLowerCase()
  
  // Check for format indicators first (these are more specific)
  if (text.includes('7"') || text.includes('7 inch') || text.includes('45')) {
    return ProductCategory.FORTY_FIVE
  }
  if (text.includes('33new') || (text.includes('33') && text.includes('new'))) {
    return ProductCategory.NEW_33
  }
  if (text.includes('33used') || (text.includes('33') && text.includes('used'))) {
    return ProductCategory.USED_33
  }
  if (text.includes('new vinyl') || (text.includes('vinyl') && text.includes('new'))) {
    return ProductCategory.NEW_VINYL
  }
  if (text.includes('used vinyl') || (text.includes('vinyl') && text.includes('used'))) {
    return ProductCategory.USED_VINYL
  }
  if (text.includes('cassette')) {
    return ProductCategory.CASSETTES
  }
  if (text.includes('cd') && !text.includes('dvd')) {
    return ProductCategory.CDS
  }
  if (text.includes('dvd')) {
    return ProductCategory.DVDS
  }
  if (text.includes('vhs')) {
    return ProductCategory.VHS
  }
  
  // Check for specific merchandise/accessories
  if (text.includes('t-shirt') || text.includes('shirt')) {
    return ProductCategory.T_SHIRTS
  }
  if (text.includes('poster')) {
    return ProductCategory.POSTER
  }
  if (text.includes('book')) {
    return ProductCategory.BOOK
  }
  if (text.includes('puzzle')) {
    return ProductCategory.PUZZLE
  }
  if (text.includes('crates')) {
    return ProductCategory.CRATES
  }
  if (text.includes('sleeves')) {
    return ProductCategory.SLEEVES
  }
  if (text.includes('cleaner') || text.includes('spin clean')) {
    return ProductCategory.CLEANER
  }
  if (text.includes('slip mat')) {
    return ProductCategory.SLIP_MAT
  }
  if (text.includes('equipment') || text.includes('turntable') || text.includes('receiver') || text.includes('speakers')) {
    return ProductCategory.EQUIPMENT
  }
  if (text.includes('boombox')) {
    return ProductCategory.BOOMBOX
  }
  if (text.includes('box set')) {
    return ProductCategory.BOX_SET
  }
  if (text.includes('record store day') || text.includes('rsd')) {
    return ProductCategory.RECORD_STORE_DAY
  }
  
  // Genre inference (only if it looks like music)
  if (name.includes(' - ') && !text.includes('t-shirt') && !text.includes('poster') && !text.includes('book')) {
    // It's likely a music release, try to infer genre
    if (text.includes('punk') || text.includes('ska')) {
      return ProductCategory.PUNK_SKA
    }
    if (text.includes('metal')) {
      return ProductCategory.METAL
    }
    if (text.includes('indie')) {
      return ProductCategory.INDIE
    }
    if (text.includes('jazz')) {
      return ProductCategory.JAZZ
    }
    if (text.includes('blues')) {
      return ProductCategory.BLUES
    }
    if (text.includes('hip-hop') || text.includes('hip hop') || text.includes('rap')) {
      return ProductCategory.RAP_HIP_HOP
    }
    if (text.includes('electronic')) {
      return ProductCategory.ELECTRONIC
    }
    if (text.includes('country')) {
      return ProductCategory.COUNTRY
    }
    if (text.includes('folk')) {
      return ProductCategory.FOLK
    }
    if (text.includes('funk') || text.includes('soul')) {
      return ProductCategory.FUNK_SOUL
    }
    if (text.includes('reggae')) {
      return ProductCategory.REGGAE
    }
    if (text.includes('soundtrack')) {
      return ProductCategory.SOUNDTRACKS
    }
    if (text.includes('compilation')) {
      return ProductCategory.COMPILATIONS
    }
    if (text.includes('singer') || text.includes('songwriter')) {
      return ProductCategory.SINGER_SONGWRITER
    }
    if (text.includes('bluegrass')) {
      return ProductCategory.BLUEGRASS
    }
    if (text.includes('industrial')) {
      return ProductCategory.INDUSTRIAL
    }
    if (text.includes('pop')) {
      return ProductCategory.POP
    }
    // Default music category
    return ProductCategory.ROCK
  }
  
  return ProductCategory.UNCATEGORIZED
}

/**
 * Infer condition from product name or description
 * (Square items typically don't have condition, but we can check for keywords)
 */
export function inferCondition(name: string, description: string = ''): RecordCondition | string | undefined {
  const text = `${name} ${description}`.toLowerCase()
  
  // Check for condition keywords
  if (text.includes('near mint') || text.includes('nm')) {
    return RecordCondition.NEAR_MINT
  }
  if (text.includes('very good+') || text.includes('vg+')) {
    return RecordCondition.VERY_GOOD_PLUS
  }
  if (text.includes('very good') || text.includes('vg')) {
    return RecordCondition.VERY_GOOD
  }
  if (text.includes('good+') || text.includes('g+')) {
    return RecordCondition.GOOD_PLUS
  }
  if (text.includes('good') || text.includes('g-')) {
    return RecordCondition.GOOD
  }
  if (text.includes('new') || text.includes('sealed')) {
    return RecordCondition.NEAR_MINT
  }
  
  // Default: assume good condition for items without explicit condition
  return undefined
}

/**
 * Determine if product should be filtered out
 */
export function shouldIncludeProduct(
  product: { price: number; stockCount: number; name: string; category: string }
): boolean {
  // Include all products by default
  // You can add filtering logic here if needed
  // For example, exclude items with price 0 and stock 0:
  // if (product.price === 0 && product.stockCount === 0) return false
  
  // Exclude placeholder/test items
  if (product.name.toLowerCase().includes('test') || product.name.toLowerCase().includes('placeholder')) {
    return false
  }
  
  return true
}

/**
 * Enhance product with inferred details
 */
export function enhanceProductWithInferences(product: {
  name: string
  description?: string
  category?: string
  price: number
  stockCount: number
  format?: string
  conditionSleeve?: string
  conditionMedia?: string
  status?: string
}): {
  category: ProductCategory | string
  format?: RecordFormat | string
  conditionSleeve?: RecordCondition | string
  conditionMedia?: RecordCondition | string
  status: ProductStatus
} {
  const name = product.name || ''
  const description = product.description || ''
  
  // Infer category if not set or is "Uncategorized"
  const category = product.category && product.category !== 'Uncategorized'
    ? product.category
    : inferCategory(name, description)
  
  // Infer format if not set
  const format = product.format || inferFormat(name, description)
  
  // Infer condition if not set
  const conditionSleeve = product.conditionSleeve || inferCondition(name, description)
  const conditionMedia = product.conditionMedia || inferCondition(name, description)
  
  // Calculate status from stock
  const status = product.status as ProductStatus || getProductStatusFromStock(product.stockCount)
  
  return {
    category,
    format,
    conditionSleeve,
    conditionMedia,
    status,
  }
}

