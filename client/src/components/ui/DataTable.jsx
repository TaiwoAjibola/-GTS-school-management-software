import { useMemo, useState, useCallback } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X, Filter, ChevronsUpDown } from 'lucide-react'

const getByPath = (row, path) => {
  if (!path) return undefined
  if (typeof path === 'function') return path(row)
  if (!path.includes('.')) return row?.[path]
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), row)
}

const toSearchable = (value) => {
  if (value == null || value === '') return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if (value.props?.children != null) return toSearchable(value.props.children)
    return ''
  }
  return String(value)
}

const compareValues = (a, b, type = 'text') => {
  const emptyA = a == null || a === ''
  const emptyB = b == null || b === ''
  if (emptyA && emptyB) return 0
  if (emptyA) return 1
  if (emptyB) return -1

  if (type === 'number') {
    const na = Number(a)
    const nb = Number(b)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
  }
  if (type === 'date') {
    const da = new Date(a).getTime()
    const db = new Date(b).getTime()
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * DataTable — sortable, filterable data grid.
 *
 * columns: [{
 *   id, header, accessor (key|fn),
 *   sortable?: bool, filterable?: bool,
 *   filterType?: 'text'|'select',
 *   filterOptions?: string[] | {value,label}[],
 *   sortType?: 'text'|'number'|'date',
 *   sortAccessor?: key|fn,
 *   filterAccessor?: key|fn,
 *   align?: 'left'|'center'|'right',
 *   width?: string,
 *   cell?: (row, ctx) => ReactNode,
 *   className?: string,
 *   headerClassName?: string,
 * }]
 */
export default function DataTable({
  columns = [],
  data = [],
  rowKey = 'id',
  emptyMessage = 'No records found.',
  emptyIcon = null,
  toolbar = null,
  globalSearch = true,
  globalSearchPlaceholder = 'Search all columns…',
  defaultSort = null, // { id, dir: 'asc'|'desc' }
  density = 'comfortable', // comfortable | compact
  stickyHeader = true,
  maxHeight = 'min(100vh - 340px, 820px)', // fill viewport (minus chrome) so the TABLE body scrolls, not the page
  rowClassName,
  onRowClick,
  className = '',
  initialPageSize = 0, // 0 = show all
  fillHeight = false, // when true, table flexes to fill parent and body scrolls
}) {
  const [sort, setSort] = useState(defaultSort)
  const [colFilters, setColFilters] = useState({})
  const [globalQuery, setGlobalQuery] = useState('')
  const [showColFilters, setShowColFilters] = useState(true)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const getRowKey = useCallback((row, index) => {
    if (typeof rowKey === 'function') return rowKey(row, index)
    return row?.[rowKey] ?? index
  }, [rowKey])

  const toggleSort = (col) => {
    if (col.sortable === false) return
    setSort((prev) => {
      if (!prev || prev.id !== col.id) return { id: col.id, dir: 'asc' }
      if (prev.dir === 'asc') return { id: col.id, dir: 'desc' }
      return null
    })
  }

  const setFilter = (colId, value) => {
    setColFilters((prev) => {
      const next = { ...prev }
      if (value == null || value === '') delete next[colId]
      else next[colId] = value
      return next
    })
    setPage(0)
  }

  const clearFilters = () => {
    setColFilters({})
    setGlobalQuery('')
    setPage(0)
  }

  const activeFilterCount = Object.keys(colFilters).length + (globalQuery.trim() ? 1 : 0)

  const processed = useMemo(() => {
    let rows = Array.isArray(data) ? [...data] : []

    // Column filters
    const filterEntries = Object.entries(colFilters)
    if (filterEntries.length) {
      rows = rows.filter((row) =>
        filterEntries.every(([colId, raw]) => {
          const col = columns.find((c) => c.id === colId)
          if (!col) return true
          const accessor = col.filterAccessor || col.accessor || col.id
          const cellVal = toSearchable(getByPath(row, accessor)).toLowerCase()
          const q = String(raw).toLowerCase()
          if (col.filterType === 'select') return cellVal === q || String(getByPath(row, accessor)) === String(raw)
          return cellVal.includes(q)
        })
      )
    }

    // Global search across filterable/sortable text accessors
    const gq = globalQuery.trim().toLowerCase()
    if (gq) {
      const searchCols = columns.filter((c) => c.filterable !== false || c.accessor)
      rows = rows.filter((row) =>
        searchCols.some((col) => {
          const accessor = col.filterAccessor || col.accessor || col.id
          const val = toSearchable(getByPath(row, accessor)).toLowerCase()
          if (val.includes(gq)) return true
          // also try rendered cell text when possible
          if (typeof col.cell === 'function') {
            try {
              const rendered = col.cell(row, { rowIndex: 0 })
              return toSearchable(rendered).toLowerCase().includes(gq)
            } catch {
              return false
            }
          }
          return false
        })
      )
    }

    // Sort
    if (sort?.id) {
      const col = columns.find((c) => c.id === sort.id)
      if (col) {
        const accessor = col.sortAccessor || col.accessor || col.id
        const dir = sort.dir === 'desc' ? -1 : 1
        rows.sort((ra, rb) => dir * compareValues(getByPath(ra, accessor), getByPath(rb, accessor), col.sortType || 'text'))
      }
    }

    return rows
  }, [data, columns, colFilters, globalQuery, sort])

  const total = processed.length
  const effectivePageSize = pageSize > 0 ? pageSize : total || 1
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = pageSize > 0
    ? processed.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : processed

  const padY = density === 'compact' ? 'py-2' : 'py-3'
  const padX = 'px-3.5'

  const SortIcon = ({ colId }) => {
    if (sort?.id !== colId) return <ArrowUpDown size={13} className="opacity-40" />
    return sort.dir === 'asc' ? <ArrowUp size={13} className="text-gold-700" /> : <ArrowDown size={13} className="text-gold-700" />
  }

  const bodyStyle = fillHeight
    ? undefined
    : maxHeight
      ? { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }
      : { maxHeight: 'min(100vh - 340px, 820px)' }

  return (
    <div
      className={`dt-root bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col ${
        fillHeight ? 'h-full min-h-0' : ''
      } ${className}`}
    >
      {/* Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-slate-200/80 bg-gradient-to-r from-[#fffdf9] to-[#fbf6ea]/40">
        {globalSearch ? (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={globalQuery}
              onChange={(e) => { setGlobalQuery(e.target.value); setPage(0) }}
              placeholder={globalSearchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-sm placeholder:text-slate-400 focus:border-gold-500 outline-none"
            />
            {globalQuery ? (
              <button
                type="button"
                onClick={() => setGlobalQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        ) : <div className="flex-1" />}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {toolbar}
          <button
            type="button"
            onClick={() => setShowColFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
              showColFilters
                ? 'border-gold-300 bg-gold-50 text-gold-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={14} />
            Column filters
            {activeFilterCount > 0 ? (
              <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-600 px-1.5 text-[10px] text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 cursor-pointer"
            >
              <X size={14} /> Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Meta bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/60 text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-800">{pageRows.length}</strong>
          {total !== data.length ? (
            <> of <strong className="text-slate-800">{total}</strong> filtered</>
          ) : null}
          {' '}from <strong className="text-slate-800">{data.length}</strong> total
          {sort?.id ? (
            <> · sorted by <strong className="text-slate-700">{columns.find((c) => c.id === sort.id)?.header || sort.id}</strong> ({sort.dir})</>
          ) : null}
        </span>
        {initialPageSize > 0 || pageSize > 0 ? (
          <label className="inline-flex items-center gap-1.5">
            Rows
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
              value={pageSize || 0}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </select>
          </label>
        ) : null}
      </div>

      <div
        className={`overflow-auto min-h-0 ${fillHeight ? 'flex-1' : ''}`}
        style={bodyStyle}
      >
        <table className="dt-table w-full text-sm">
          <thead className={stickyHeader ? 'sticky top-0 z-20' : ''}>
            <tr>
              {columns.map((col) => {
                const sortable = col.sortable !== false && (col.accessor || col.sortAccessor)
                const align = col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                return (
                  <th
                    key={col.id}
                    style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                    className={`${padX} ${padY} ${align} ${col.headerClassName || ''}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className={`group/sort inline-flex items-center gap-1.5 max-w-full font-semibold uppercase tracking-wider text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer ${
                          col.align === 'right' ? 'ml-auto' : col.align === 'center' ? 'mx-auto' : ''
                        }`}
                      >
                        <span className="truncate">{col.header}</span>
                        <SortIcon colId={col.id} />
                      </button>
                    ) : (
                      <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-600">
                        {col.header}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
            {showColFilters ? (
              <tr className="dt-filter-row">
                {columns.map((col) => {
                  const filterable = col.filterable !== false && col.filterable !== 'off' && (col.accessor || col.filterAccessor || col.filterType === 'select')
                  if (!filterable || col.filterable === false) {
                    return <th key={`${col.id}-f`} className={`${padX} py-2 bg-[#f7f1e4] border-b border-slate-200`} />
                  }
                  if (col.filterType === 'select') {
                    const opts = col.filterOptions || []
                    return (
                      <th key={`${col.id}-f`} className={`${padX} py-2 bg-[#f7f1e4] border-b border-slate-200`}>
                        <div className="relative">
                          <select
                            value={colFilters[col.id] ?? ''}
                            onChange={(e) => setFilter(col.id, e.target.value)}
                            className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-2.5 pr-7 py-1.5 text-xs text-slate-700 outline-none focus:border-gold-500"
                          >
                            <option value="">All</option>
                            {opts.map((opt) => {
                              const value = typeof opt === 'object' ? opt.value : opt
                              const label = typeof opt === 'object' ? opt.label : opt
                              return <option key={String(value)} value={value}>{label}</option>
                            })}
                          </select>
                          <ChevronsUpDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                      </th>
                    )
                  }
                  return (
                    <th key={`${col.id}-f`} className={`${padX} py-2 bg-[#f7f1e4] border-b border-slate-200`}>
                      <div className="relative">
                        <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={colFilters[col.id] ?? ''}
                          onChange={(e) => setFilter(col.id, e.target.value)}
                          placeholder="Filter…"
                          className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 py-1.5 text-xs placeholder:text-slate-400 outline-none focus:border-gold-500"
                        />
                      </div>
                    </th>
                  )
                })}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => {
              const key = getRowKey(row, rowIndex)
              const extra = typeof rowClassName === 'function' ? rowClassName(row, rowIndex) : rowClassName || ''
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`dt-row group border-b border-slate-100/90 last:border-0 ${onRowClick ? 'cursor-pointer' : ''} ${extra}`}
                >
                  {columns.map((col) => {
                    const align = col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    const content = typeof col.cell === 'function'
                      ? col.cell(row, { rowIndex })
                      : getByPath(row, col.accessor || col.id)
                    return (
                      <td
                        key={col.id}
                        className={`${padX} ${padY} ${align} text-slate-700 ${col.className || ''}`}
                      >
                        {content == null || content === '' ? <span className="text-slate-300">—</span> : content}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {!pageRows.length ? (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="py-14 text-center">
                  {emptyIcon ? <div className="mb-2 flex justify-center text-slate-200">{emptyIcon}</div> : null}
                  <p className="text-sm text-slate-400">{emptyMessage}</p>
                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-3 text-xs font-semibold text-gold-700 hover:underline cursor-pointer"
                    >
                      Clear filters
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize > 0 && total > 0 ? (
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <p className="text-xs text-slate-500">
            Page {safePage + 1} of {pageCount}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
