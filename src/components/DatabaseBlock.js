import React, { useState } from 'react';
import {
  Table, Grid, List, Calendar, BarChart3, Plus, Filter,
  ArrowUpDown, Eye, EyeOff, MoreVertical, Trash2, Edit3
} from 'lucide-react';
import './DatabaseBlock.css';

const DATABASE_VIEWS = [
  { type: 'table', label: 'Table', icon: Table },
  { type: 'board', label: 'Board', icon: Grid },
  { type: 'gallery', label: 'Gallery', icon: Grid },
  { type: 'list', label: 'List', icon: List },
  { type: 'calendar', label: 'Calendar', icon: Calendar },
  { type: 'timeline', label: 'Timeline', icon: BarChart3 },
];

const PROPERTY_TYPES = [
  { type: 'text', label: 'Text' },
  { type: 'number', label: 'Number' },
  { type: 'select', label: 'Select' },
  { type: 'multi-select', label: 'Multi-select' },
  { type: 'date', label: 'Date' },
  { type: 'person', label: 'Person' },
  { type: 'files', label: 'Files & media' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'url', label: 'URL' },
  { type: 'email', label: 'Email' },
  { type: 'phone', label: 'Phone' },
  { type: 'formula', label: 'Formula' },
  { type: 'relation', label: 'Relation' },
  { type: 'rollup', label: 'Rollup' },
];

const DatabaseBlock = ({ data, onChange, readOnly = false }) => {
  const [currentView, setCurrentView] = useState(data.currentView || 'table');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const properties = data.properties || [
    { id: 'name', name: 'Name', type: 'text', visible: true },
    { id: 'status', name: 'Status', type: 'select', visible: true, options: ['Not Started', 'In Progress', 'Done'] },
  ];

  const entries = data.entries || [];
  const filters = data.filters || [];
  const sorts = data.sorts || [];

  const addProperty = (type) => {
    const newProperty = {
      id: Date.now().toString(),
      name: `New ${type}`,
      type,
      visible: true,
      options: type === 'select' || type === 'multi-select' ? ['Option 1', 'Option 2'] : undefined,
    };
    onChange({
      ...data,
      properties: [...properties, newProperty],
    });
    setShowAddProperty(false);
  };

  const addEntry = () => {
    const newEntry = {
      id: Date.now().toString(),
      values: {},
    };
    onChange({
      ...data,
      entries: [...entries, newEntry],
    });
  };

  const updateEntry = (entryId, propertyId, value) => {
    const updatedEntries = entries.map(entry =>
      entry.id === entryId
        ? { ...entry, values: { ...entry.values, [propertyId]: value } }
        : entry
    );
    onChange({
      ...data,
      entries: updatedEntries,
    });
  };

  const deleteEntry = (entryId) => {
    onChange({
      ...data,
      entries: entries.filter(e => e.id !== entryId),
    });
  };

  const togglePropertyVisibility = (propertyId) => {
    const updatedProperties = properties.map(prop =>
      prop.id === propertyId ? { ...prop, visible: !prop.visible } : prop
    );
    onChange({
      ...data,
      properties: updatedProperties,
    });
  };

  const addFilter = () => {
    const newFilter = {
      id: Date.now().toString(),
      property: properties[0]?.id,
      operator: 'equals',
      value: '',
    };
    onChange({
      ...data,
      filters: [...filters, newFilter],
    });
  };

  const addSort = () => {
    const newSort = {
      id: Date.now().toString(),
      property: properties[0]?.id,
      direction: 'asc',
    };
    onChange({
      ...data,
      sorts: [...sorts, newSort],
    });
  };

  const applyFilters = (entries) => {
    if (filters.length === 0) return entries;
    
    return entries.filter(entry => {
      return filters.every(filter => {
        const value = entry.values[filter.property];
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return value?.toString().includes(filter.value);
          case 'is-empty':
            return !value;
          case 'is-not-empty':
            return !!value;
          default:
            return true;
        }
      });
    });
  };

  const applySorts = (entries) => {
    if (sorts.length === 0) return entries;
    
    return [...entries].sort((a, b) => {
      for (const sort of sorts) {
        const aVal = a.values[sort.property];
        const bVal = b.values[sort.property];
        
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const filteredAndSortedEntries = applySorts(applyFilters(entries));
  const visibleProperties = properties.filter(p => p.visible);

  const renderTableView = () => (
    <div className="database-table-view">
      <table className="database-table">
        <thead>
          <tr>
            {visibleProperties.map(prop => (
              <th key={prop.id}>
                <div className="table-header">
                  <span>{prop.name}</span>
                  <button
                    className="header-menu-btn"
                    onClick={() => togglePropertyVisibility(prop.id)}
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
              </th>
            ))}
            <th style={{ width: '50px' }}></th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedEntries.map(entry => (
            <tr key={entry.id}>
              {visibleProperties.map(prop => (
                <td key={prop.id}>
                  {renderCell(entry, prop)}
                </td>
              ))}
              <td>
                <button
                  className="delete-entry-btn"
                  onClick={() => deleteEntry(entry.id)}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <button className="add-entry-btn" onClick={addEntry}>
          <Plus size={16} /> New Entry
        </button>
      )}
    </div>
  );

  const renderBoardView = () => {
    const statusProperty = properties.find(p => p.type === 'select');
    if (!statusProperty) return <div className="board-empty">Add a Select property to use Board view</div>;

    const columns = statusProperty.options || [];
    
    return (
      <div className="database-board-view">
        {columns.map(column => {
          const columnEntries = filteredAndSortedEntries.filter(
            entry => entry.values[statusProperty.id] === column
          );
          
          return (
            <div key={column} className="board-column">
              <div className="board-column-header">
                <span>{column}</span>
                <span className="board-count">{columnEntries.length}</span>
              </div>
              <div className="board-cards">
                {columnEntries.map(entry => (
                  <div key={entry.id} className="board-card">
                    <div className="card-title">
                      {entry.values.name || 'Untitled'}
                    </div>
                    {visibleProperties.slice(1).map(prop => (
                      <div key={prop.id} className="card-property">
                        <span className="card-prop-label">{prop.name}:</span>
                        <span className="card-prop-value">
                          {entry.values[prop.id] || '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderGalleryView = () => (
    <div className="database-gallery-view">
      {filteredAndSortedEntries.map(entry => (
        <div key={entry.id} className="gallery-card">
          <div className="gallery-card-image">
            <Grid size={48} />
          </div>
          <div className="gallery-card-content">
            <div className="gallery-card-title">
              {entry.values.name || 'Untitled'}
            </div>
            {visibleProperties.slice(1).map(prop => (
              <div key={prop.id} className="gallery-card-property">
                <span className="gallery-prop-label">{prop.name}:</span>
                <span>{entry.values[prop.id] || '-'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="database-list-view">
      {filteredAndSortedEntries.map(entry => (
        <div key={entry.id} className="list-item">
          <div className="list-item-title">
            {entry.values.name || 'Untitled'}
          </div>
          <div className="list-item-properties">
            {visibleProperties.slice(1).map(prop => (
              <span key={prop.id} className="list-prop">
                {prop.name}: {entry.values[prop.id] || '-'}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCell = (entry, property) => {
    const value = entry.values[property.id];
    
    if (readOnly) {
      return <span>{value || '-'}</span>;
    }

    switch (property.type) {
      case 'text':
      case 'url':
      case 'email':
      case 'phone':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => updateEntry(entry.id, property.id, e.target.value)}
            className="cell-input"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => updateEntry(entry.id, property.id, e.target.value)}
            className="cell-input"
          />
        );
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => updateEntry(entry.id, property.id, e.target.value)}
            className="cell-select"
          >
            <option value="">Select...</option>
            {property.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => updateEntry(entry.id, property.id, e.target.checked)}
            className="cell-checkbox"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => updateEntry(entry.id, property.id, e.target.value)}
            className="cell-input"
          />
        );
      default:
        return <span>{value || '-'}</span>;
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'table':
        return renderTableView();
      case 'board':
        return renderBoardView();
      case 'gallery':
        return renderGalleryView();
      case 'list':
        return renderListView();
      case 'calendar':
        return <div className="view-placeholder">Calendar view coming soon</div>;
      case 'timeline':
        return <div className="view-placeholder">Timeline view coming soon</div>;
      default:
        return renderTableView();
    }
  };

  return (
    <div className="database-block">
      <div className="database-toolbar">
        <div className="database-views">
          {DATABASE_VIEWS.map(view => {
            const Icon = view.icon;
            return (
              <button
                key={view.type}
                className={`view-btn ${currentView === view.type ? 'active' : ''}`}
                onClick={() => setCurrentView(view.type)}
                title={view.label}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>

        <div className="database-actions">
          <button
            className="toolbar-btn"
            onClick={() => setShowFilters(!showFilters)}
            title="Filter"
          >
            <Filter size={16} />
            {filters.length > 0 && <span className="badge">{filters.length}</span>}
          </button>
          <button
            className="toolbar-btn"
            onClick={() => setShowSort(!showSort)}
            title="Sort"
          >
            <ArrowUpDown size={16} />
            {sorts.length > 0 && <span className="badge">{sorts.length}</span>}
          </button>
          {!readOnly && (
            <button
              className="toolbar-btn"
              onClick={() => setShowAddProperty(!showAddProperty)}
              title="Add Property"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      {showAddProperty && (
        <div className="add-property-menu">
          <div className="menu-header">Add Property</div>
          {PROPERTY_TYPES.map(type => (
            <button
              key={type.type}
              className="property-type-btn"
              onClick={() => addProperty(type.type)}
            >
              {type.label}
            </button>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="filters-panel">
          <div className="panel-header">
            <span>Filters</span>
            <button onClick={addFilter} className="add-filter-btn">
              <Plus size={14} /> Add Filter
            </button>
          </div>
          {filters.map(filter => (
            <div key={filter.id} className="filter-row">
              <select
                value={filter.property}
                onChange={(e) => {
                  const updated = filters.map(f =>
                    f.id === filter.id ? { ...f, property: e.target.value } : f
                  );
                  onChange({ ...data, filters: updated });
                }}
              >
                {properties.map(prop => (
                  <option key={prop.id} value={prop.id}>{prop.name}</option>
                ))}
              </select>
              <select
                value={filter.operator}
                onChange={(e) => {
                  const updated = filters.map(f =>
                    f.id === filter.id ? { ...f, operator: e.target.value } : f
                  );
                  onChange({ ...data, filters: updated });
                }}
              >
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="is-empty">Is empty</option>
                <option value="is-not-empty">Is not empty</option>
              </select>
              <input
                type="text"
                value={filter.value}
                onChange={(e) => {
                  const updated = filters.map(f =>
                    f.id === filter.id ? { ...f, value: e.target.value } : f
                  );
                  onChange({ ...data, filters: updated });
                }}
                placeholder="Value"
              />
              <button
                onClick={() => {
                  onChange({ ...data, filters: filters.filter(f => f.id !== filter.id) });
                }}
                className="remove-btn"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showSort && (
        <div className="sort-panel">
          <div className="panel-header">
            <span>Sort</span>
            <button onClick={addSort} className="add-sort-btn">
              <Plus size={14} /> Add Sort
            </button>
          </div>
          {sorts.map(sort => (
            <div key={sort.id} className="sort-row">
              <select
                value={sort.property}
                onChange={(e) => {
                  const updated = sorts.map(s =>
                    s.id === sort.id ? { ...s, property: e.target.value } : s
                  );
                  onChange({ ...data, sorts: updated });
                }}
              >
                {properties.map(prop => (
                  <option key={prop.id} value={prop.id}>{prop.name}</option>
                ))}
              </select>
              <select
                value={sort.direction}
                onChange={(e) => {
                  const updated = sorts.map(s =>
                    s.id === sort.id ? { ...s, direction: e.target.value } : s
                  );
                  onChange({ ...data, sorts: updated });
                }}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
              <button
                onClick={() => {
                  onChange({ ...data, sorts: sorts.filter(s => s.id !== sort.id) });
                }}
                className="remove-btn"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="database-content">
        {renderView()}
      </div>
    </div>
  );
};

export default DatabaseBlock;
