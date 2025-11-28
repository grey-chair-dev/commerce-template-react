import { useState } from 'react'
import type { Product } from '../dataAdapter'
import { moneyFormatter } from '../formatters'

type ProductDetailViewProps = {
  product: Product
  onClose: () => void
  onAddToCart: (quantity?: number) => void
  onSave?: () => void
  isSaved?: boolean
}

const galleryFallbacks = [
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=800&q=80',
]

export function ProductDetailView({
  product,
  onClose,
  onAddToCart,
  onSave,
  isSaved,
}: ProductDetailViewProps) {
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const gallery = buildGallery(product)
  const isOnSale = product.stockCount <= 10

  const handleAddToCart = () => {
    onAddToCart(quantity)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 transition"
            onClick={onClose}
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            {isOnSale && (
              <span className="rounded-full bg-secondary px-4 py-1 text-xs font-semibold text-white">
                Sale
              </span>
            )}
            <span className="text-xs uppercase tracking-[0.3em] text-secondary">
              {product.category}
            </span>
          </div>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1.5fr,1fr]">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 aspect-square">
              <img
                src={gallery[selectedImage]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
              {isOnSale && (
                <div className="absolute left-4 top-4 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-white">
                  Limited Stock
                </div>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {gallery.map((image, index) => (
                <button
                  key={image + index}
                  onClick={() => setSelectedImage(index)}
                  className={`flex-shrink-0 overflow-hidden rounded-2xl border-2 transition ${
                    selectedImage === index
                      ? 'border-primary scale-105'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <img
                    src={image}
                    alt={`${product.name} view ${index + 1}`}
                    className="h-20 w-20 object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-white leading-tight">{product.name}</h1>
              <div className="mt-3 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <StarRating rating={product.rating} />
                  <span className="text-slate-300">
                    {product.rating.toFixed(1)} ({product.reviewCount} reviews)
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-bold text-white">
                    {moneyFormatter.format(product.price)}
                  </span>
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Secure checkout
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">Description</h2>
                <p className="text-base text-slate-200 leading-relaxed">{product.description}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Availability</span>
                    <span
                      className={`text-sm font-semibold ${
                        product.stockCount > 0
                          ? product.stockCount <= 5
                            ? 'text-secondary'
                            : 'text-accent'
                          : 'text-slate-400'
                      }`}
                    >
                      {product.stockCount > 0
                        ? `${product.stockCount} ${product.stockCount === 1 ? 'unit' : 'units'} in stock`
                        : 'Out of stock'}
                    </span>
                  </div>
                  {product.stockCount > 0 && (
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          product.stockCount <= 5 ? 'bg-secondary' : 'bg-accent'
                        }`}
                        style={{
                          width: `${Math.min(100, (product.stockCount / 50) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-slate-400">
                    {product.stockCount > 0
                      ? 'Ships in 1-2 business days'
                      : 'Check back soon for restock'}
                  </p>
                </div>
              </div>

              {/* Quantity Selector */}
              {product.stockCount > 0 && (
                <div className="flex items-center gap-4">
                  <label className="text-sm font-semibold text-white">Quantity:</label>
                  <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-4 py-2 text-white/80 hover:text-white transition"
                      disabled={quantity <= 1}
                    >
                      −
                    </button>
                    <span className="px-4 py-2 text-white font-semibold min-w-[3rem] text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(product.stockCount, q + 1))}
                      className="px-4 py-2 text-white/80 hover:text-white transition"
                      disabled={quantity >= product.stockCount}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="sticky top-4 space-y-3 pt-4">
                {product.stockCount > 0 ? (
                  <>
                    <button
                      className="w-full rounded-full bg-primary px-6 py-4 text-base font-semibold text-white shadow-brand hover:bg-primary/80 transition"
                      onClick={handleAddToCart}
                    >
                      Add {quantity > 1 ? `${quantity} to` : 'to'} cart
                    </button>
                    {onSave && (
                      <button
                        className={`w-full rounded-full border-2 px-6 py-4 text-base font-semibold transition ${
                          isSaved
                            ? 'border-secondary bg-secondary/20 text-secondary'
                            : 'border-white/20 text-white/80 hover:border-white/40 hover:text-white'
                        }`}
                        onClick={onSave}
                      >
                        {isSaved ? '✓ Saved to wishlist' : 'Save to wishlist'}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    className="w-full rounded-full border border-white/20 px-6 py-4 text-base font-semibold text-white/50 cursor-not-allowed"
                    disabled
                  >
                    Out of stock
                  </button>
                )}

                {/* Trust Badges */}
                <div className="flex flex-wrap items-center gap-3 pt-4 text-xs">
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/80">
                    ✓ Free returns
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/80">
                    ✓ Secure checkout
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/80">
                    ✓ Fast shipping
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      {product.stockCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-surface/95 p-4 shadow-brand backdrop-blur border-t border-white/10 md:hidden">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-lg font-bold text-white">
                {moneyFormatter.format(product.price)}
              </span>
              {isOnSale && (
                <p className="text-xs text-secondary">Limited stock</p>
              )}
            </div>
            <div className="flex gap-2">
              {onSave && (
                <button
                  className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                    isSaved
                      ? 'border-secondary text-secondary'
                      : 'border-white/20 text-white/80'
                  }`}
                  onClick={onSave}
                >
                  {isSaved ? '✓' : '♡'}
                </button>
              )}
              <button
                className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white shadow-brand"
                onClick={handleAddToCart}
              >
                Add to cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = rating >= index + 1
        const half = !filled && rating > index && rating < index + 1
        return (
          <span key={index} className="text-lg">
            {filled ? '★' : half ? '☆' : '☆'}
          </span>
        )
      })}
    </div>
  )
}

function buildGallery(product: Product): string[] {
  const base = sanitizeGallerySource(product.imageUrl)
  const extras = galleryFallbacks.map((url) => sanitizeGallerySource(url))
  return [base, ...extras]
}

function sanitizeGallerySource(url: string): string {
  if (!url) {
    return galleryFallbacks[0]
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return galleryFallbacks[0]
}

