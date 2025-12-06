import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Product } from '../dataAdapter'
import { sanitizeText } from '../utils/sanitize'
import { moneyFormatter } from '../formatters'

type SearchDropdownProps = {
  products: Product[]
  query: string
  isOpen: boolean
  onSelect: (product: Product) => void
  onClose: () => void
}

export function SearchDropdown({
  products,
  query,
  isOpen,
  onSelect,
  onClose,
}: SearchDropdownProps) {
  const navigate = useNavigate()
  
  const filtered = useMemo(() => {
    if (!query.trim()) {
      return []
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
      .slice(0, 6)
  }, [products, query])

  if (!isOpen || !query.trim() || filtered.length === 0) {
    return null
  }

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-white/20 bg-surface shadow-lg">
      <div className="p-2">
        {filtered.map((product) => (
          <button
            key={product.id}
            onClick={() => {
              onClose()
              navigate(`/product/${product.id}`)
            }}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{product.name}</p>
              <p className="text-xs text-slate-400">{product.category}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-white">{moneyFormatter.format(product.price)}</p>
              {product.stockCount > 0 ? (
                <p className="text-xs text-slate-400">{product.stockCount} in stock</p>
              ) : (
                <p className="text-xs text-secondary">Out of stock</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

