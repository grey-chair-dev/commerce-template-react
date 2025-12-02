import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Product } from '../dataAdapter'
import { sanitizeText } from '../utils/sanitize'
import { moneyFormatter } from '../formatters'

type SearchOverlayProps = {
  products: Product[]
  isOpen: boolean
  onClose: () => void
  onSelect: (product: Product) => void
}

const SUGGESTED_TERMS = ['Coffee', 'Art', 'Pantry', 'Wellness']

export function SearchOverlay({
  products,
  isOpen,
  onClose,
  onSelect,
}: SearchOverlayProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const filtered = useMemo(() => {
    if (!query) {
      return products.slice(0, 6)
    }
    const normalized = sanitizeText(query).toLowerCase()
    return products
      .filter((product) => {
        return (
          product.name.toLowerCase().includes(normalized) ||
          product.description.toLowerCase().includes(normalized) ||
          product.category.toLowerCase().includes(normalized)
        )
      })
      .slice(0, 10)
  }, [products, query])

  const showEmptyState = query.trim().length > 0 && filtered.length === 0

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 py-8">
      <div className="w-full max-w-3xl rounded-3xl bg-surface/95 p-6 shadow-brand">
        <div className="flex items-center gap-3">
          <input
            autoFocus
            className="h-12 flex-1 rounded-full border border-white/10 bg-white/5 px-5 text-sm text-white placeholder:text-slate-400 focus:border-primary focus:outline-none"
            placeholder="Search products..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/70"
            onClick={onClose}
          >
            Esc
          </button>
        </div>

        {showEmptyState ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-300">
            <p className="font-semibold text-white">No results</p>
            <p className="mt-1">
              Double-check your spelling or explore these categories:
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTED_TERMS.map((term) => (
                <button
                  key={term}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80"
                  onClick={() => setQuery(term)}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {filtered.map((product) => (
              <button
                key={product.id}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-primary/60"
                onClick={() => {
                  onClose()
                  navigate(`/product/${product.id}`)
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{product.name}</p>
                  <p className="text-xs text-slate-400 line-clamp-1 mt-1">
                    {product.description}
                  </p>
                  <p className="text-xs uppercase tracking-[0.3em] text-secondary mt-2">
                    {product.category}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-white">{moneyFormatter.format(product.price)}</p>
                  {product.stockCount > 0 ? (
                    <p className="text-xs text-slate-400 mt-1">{product.stockCount} in stock</p>
                  ) : (
                    <p className="text-xs text-secondary mt-1">Out of stock</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

