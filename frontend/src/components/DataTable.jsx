import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { LoadingState, EmptyState } from './StateBoxes';

export default function DataTable({
  columns = [],
  data = [],
  searchable = true,
  searchPlaceholder = 'Search records...',
  searchKey = 'name',
  emptyMessage = 'No records found',
  isLoading = false,
  initialPageSize = 15,
  showPagination = true,
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // 1. Filtered data
  const filteredData = useMemo(() => {
    if (!query.trim()) return data;
    const lower = query.toLowerCase();
    return data.filter((item) => {
      // Check primary searchKey
      const val = item[searchKey];
      if (val && String(val).toLowerCase().includes(lower)) return true;
      // Also search any other property
      return Object.values(item).some(
        (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(lower)
      );
    });
  }, [data, query, searchKey]);

  // 2. Sorted data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(String(bVal));
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
  }, [filteredData, sortKey, sortOrder]);

  // Reset to page 1 if query or sort changes
  useMemo(() => {
    setCurrentPage(1);
  }, [query, sortKey, sortOrder]);

  // 3. Paginated data
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    if (!showPagination || pageSize === -1) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, showPagination]);

  const handleHeaderClick = (col) => {
    if (!col.accessor || col.sortable === false) return;
    if (sortKey === col.accessor) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(col.accessor);
      setSortOrder('asc');
    }
  };

  return (
    <div className="table-container">
      {searchable && (
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="table-search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} className="table-search-icon" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingRight: query ? '2rem' : '0.75rem' }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>
              Showing <strong>{filteredData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> -{' '}
              <strong>{Math.min(currentPage * pageSize, filteredData.length)}</strong> of <strong>{data.length}</strong> records
            </span>

            {showPagination && data.length > 10 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem' }}>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '2px 6px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                    background: '#fff',
                    color: 'var(--navy-900)'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingState message="Loading data from SQLite backend..." />
      ) : sortedData.length === 0 ? (
        <EmptyState title="No Records Found" description={emptyMessage} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col, idx) => {
                  const isSorted = sortKey === col.accessor;
                  const canSort = col.accessor && col.sortable !== false;
                  return (
                    <th
                      key={idx}
                      style={{
                        width: col.width || 'auto',
                        textAlign: col.align || 'left',
                        cursor: canSort ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                      onClick={() => handleHeaderClick(col)}
                      title={canSort ? 'Click to sort' : undefined}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                          width: '100%',
                        }}
                      >
                        <span>{col.header}</span>
                        {canSort && (
                          <span style={{ color: isSorted ? 'var(--solar-green-600)' : 'var(--text-muted)', fontSize: '0.7rem' }}>
                            {isSorted ? (
                              sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, rIdx) => (
                <tr key={row.id || rIdx}>
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} style={{ textAlign: col.align || 'left' }}>
                      {col.render ? col.render(row) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {showPagination && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            background: '#fafafa',
          }}
        >
          <div style={{ color: 'var(--text-muted)' }}>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '3px 8px' }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Sliding window around currentPage
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minWidth: '28px', padding: '2px 6px' }}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              className="btn btn-secondary btn-sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '3px 8px' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
