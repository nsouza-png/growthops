import { useState, useRef, useEffect } from 'react'
import { Search, Filter, X, Calendar, User, TrendingUp, MessageSquare, FileText, ChevronDown } from 'lucide-react'
import { useGlobalSearch, type SearchFilters, type SearchResult } from '../hooks/useGlobalSearch'
import { cn } from '../lib/cn'

interface GlobalSearchProps {
  onResultClick?: (result: SearchResult) => void
  placeholder?: string
  className?: string
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos', icon: Search },
  { value: 'call', label: 'Calls', icon: FileText },
  { value: 'snippet', label: 'Snippets', icon: MessageSquare },
  { value: 'feedback', label: 'Feedback', icon: TrendingUp },
] as const

const TIME_OPTIONS = [
  { value: null, label: 'Qualquer período' },
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
]

export default function GlobalSearch({ 
  onResultClick, 
  placeholder = "Buscar calls, snippets, feedback...",
  className 
}: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  
  const { results, loading, error, totalFound, search, clearResults } = useGlobalSearch()
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        search(query, filters)
      } else {
        clearResults()
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, filters, search, clearResults])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setActiveIndex(prev => (prev + 1) % results.length)
          break
        case 'ArrowUp':
          event.preventDefault()
          setActiveIndex(prev => prev <= 0 ? results.length - 1 : prev - 1)
          break
        case 'Enter':
          event.preventDefault()
          if (activeIndex >= 0 && activeIndex < results.length) {
            handleResultClick(results[activeIndex])
          }
          break
        case 'Escape':
          setIsOpen(false)
          inputRef.current?.blur()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, activeIndex])

  const handleResultClick = (result: SearchResult) => {
    onResultClick?.(result)
    setIsOpen(false)
    setQuery('')
    clearResults()
  }

  const getTypeIcon = (type: SearchResult['type']) => {
    const option = TYPE_OPTIONS.find(opt => opt.value === type)
    return option ? <option.icon size={16} /> : <FileText size={16} />
  }

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'call': return 'text-signal-blue bg-signal-blue/10 border-signal-blue/20'
      case 'snippet': return 'text-signal-amber bg-signal-amber/10 border-signal-amber/20'
      case 'feedback': return 'text-signal-green bg-signal-green/10 border-signal-green/20'
      default: return 'text-text-secondary bg-bg-elevated border-border'
    }
  }

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">{part}</mark> : part
    )
  }

  return (
    <div ref={searchRef} className={cn("relative", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-bg-card border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-mid"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              clearResults()
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-bg-card border border-border rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden">
          {/* Filters Header */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-secondary">
                {totalFound} resultado{totalFound !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <Filter size={12} />
                Filtros
                <ChevronDown size={10} className={cn("transition-transform", showFilters && "rotate-180")} />
              </button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-2 gap-2">
                {/* Type Filter */}
                <select
                  value={filters.type || 'all'}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                  className="bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs text-text-primary"
                >
                  {TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                {/* Time Filter */}
                <select
                  value={filters.daysAgo || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    daysAgo: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  className="bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs text-text-primary"
                >
                  {TIME_OPTIONS.map(option => (
                    <option key={option.value || 'all'} value={option.value || ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Results List */}
          <div className="overflow-y-auto max-h-80">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-signal-blue"></div>
                <span className="ml-2 text-xs text-text-tertiary">Buscando...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-center">
                <p className="text-sm text-signal-red">{error}</p>
              </div>
            ) : results.length === 0 && query.trim() ? (
              <div className="p-4 text-center">
                <Search size={24} className="text-text-tertiary mx-auto mb-2" />
                <p className="text-sm text-text-secondary">Nenhum resultado encontrado</p>
                <p className="text-xs text-text-tertiary mt-1">Tente outros termos ou ajuste os filtros</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center">
                <Search size={24} className="text-text-tertiary mx-auto mb-2" />
                <p className="text-sm text-text-secondary">Digite para buscar</p>
                <p className="text-xs text-text-tertiary mt-1">Busque em calls, snippets e feedback</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      "w-full p-3 text-left hover:bg-bg-elevated transition-colors",
                      activeIndex === index && "bg-bg-elevated"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type Icon */}
                      <div className={cn(
                        "p-1.5 rounded-lg border",
                        getTypeColor(result.type)
                      )}>
                        {getTypeIcon(result.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-text-primary truncate">
                            {highlightText(result.title, query)}
                          </h4>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full border",
                            getTypeColor(result.type)
                          )}>
                            {result.type}
                          </span>
                        </div>
                        
                        <p className="text-xs text-text-secondary line-clamp-2 mb-2">
                          {highlightText(result.content, query)}
                        </p>

                        {/* Metadata */}
                        <div className="flex items-center gap-3 text-xs text-text-tertiary">
                          {result.metadata.vendedor && (
                            <span className="flex items-center gap-1">
                              <User size={10} />
                              {result.metadata.vendedor}
                            </span>
                          )}
                          {result.metadata.data && (
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {result.metadata.data}
                            </span>
                          )}
                          {result.metadata.score && (
                            <span className="flex items-center gap-1">
                              <TrendingUp size={10} />
                              {result.metadata.score}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
