import type { Product } from '../dataAdapter'
import { moneyFormatter } from '../formatters'

type ProductDetailViewProps = {
  product: Product
  onClose: () => void
  onAddToCart: () => void
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
  const gallery = buildGallery(product)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80"
            onClick={onClose}
          >
            Back to catalog
          </button>
          <span className="text-xs uppercase tracking-[0.3em] text-secondary">
            {product.category}
          </span>
        </div>

        <div className="grid gap-10 lg:grid-cols-[3fr,2fr]">
          <div>
            <div className="overflow-hidden rounded-3xl border border-white/10">
              <img
                src={gallery[0]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="mt-4 flex gap-4 overflow-x-auto">
              {gallery.slice(1).map((image, index) => (
                <img
                  key={image + index}
                  src={image}
                  alt={`${product.name} alt ${index}`}
                  className="h-20 w-28 rounded-2xl border border-white/10 object-cover"
                />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold text-white">{product.name}</h1>
              <div className="mt-2 flex items-center gap-3 text-sm text-slate-300">
                <StarRating rating={product.rating} />
                <span>{product.rating.toFixed(1)} · {product.reviewCount} reviews</span>
              </div>
            </div>

            <p className="text-lg text-slate-200">{product.description}</p>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">Availability</p>
              <p>
                {product.stockCount > 0
                  ? `${product.stockCount} units in stock · ships in 1-2 days`
                  : 'Currently out of stock'}
              </p>
            </div>

            <div className="sticky top-4 rounded-3xl border border-white/10 bg-surface/80 p-4 shadow-brand backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-white">
                  {moneyFormatter.format(product.price)}
                </span>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Secure checkout
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-brand"
                  onClick={onAddToCart}
                >
                  Add to cart
                </button>
                {onSave ? (
                  <button
                    className={`rounded-full border px-6 py-3 text-sm font-semibold ${
                      isSaved ? 'border-secondary text-secondary' : 'border-white/20 text-white/80'
                    }`}
                    onClick={onSave}
                  >
                    {isSaved ? 'Saved' : 'Save to wishlist'}
                  </button>
                ) : null}
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">
                  Visa
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">
                  Mastercard
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">
                  SSL Secure
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 bg-surface/90 p-4 shadow-brand backdrop-blur md:hidden">
        <div className="flex items-center justify-between text-white">
          <span className="text-lg font-semibold">
            {moneyFormatter.format(product.price)}
          </span>
          <div className="flex gap-2">
            {onSave ? (
              <button
                className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80"
                onClick={onSave}
              >
                Save
              </button>
            ) : null}
            <button
              className="rounded-full bg-primary px-6 py-2 text-xs font-semibold text-white shadow-brand"
              onClick={onAddToCart}
            >
              Add to cart
            </button>
          </div>
        </div>
      </div>
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

