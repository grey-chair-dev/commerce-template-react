type PaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ currentPage, totalPages, onPageChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push('...')
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('...')
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`rounded-full border px-4 py-2 text-sm font-semibold transition min-h-[44px] ${
          currentPage === 1
            ? 'border-white/10 text-slate-500 cursor-not-allowed'
            : 'border-white/20 text-white/80 hover:border-white/40 hover:text-white'
        }`}
        aria-label="Previous page"
      >
        Previous
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
                ...
              </span>
            )
          }

          const pageNum = page as number
          const isActive = pageNum === currentPage

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition min-h-[44px] min-w-[44px] ${
                isActive
                  ? 'border-primary bg-primary/20 text-white'
                  : 'border-white/20 text-white/80 hover:border-white/40 hover:text-white'
              }`}
              aria-label={`Page ${pageNum}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {pageNum}
            </button>
          )
        })}
      </div>

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`rounded-full border px-4 py-2 text-sm font-semibold transition min-h-[44px] ${
          currentPage === totalPages
            ? 'border-white/10 text-slate-500 cursor-not-allowed'
            : 'border-white/20 text-white/80 hover:border-white/40 hover:text-white'
        }`}
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  )
}

