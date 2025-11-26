import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import './TableBlock.css';

const TableBlock = ({ data, onChange }) => {
  const [rows, setRows] = useState(data?.rows || [
    ['Header 1', 'Header 2', 'Header 3'],
    ['Cell 1', 'Cell 2', 'Cell 3'],
    ['Cell 4', 'Cell 5', 'Cell 6']
  ]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [showColumnMenu, setShowColumnMenu] = useState(null);

  const updateCell = (rowIndex, colIndex, value) => {
    const newRows = [...rows];
    newRows[rowIndex][colIndex] = value;
    setRows(newRows);
    onChange?.({ rows: newRows });
  };

  const addRow = (index) => {
    const newRows = [...rows];
    const newRow = new Array(rows[0].length).fill('');
    newRows.splice(index + 1, 0, newRow);
    setRows(newRows);
    onChange?.({ rows: newRows });
  };

  const deleteRow = (index) => {
    if (rows.length <= 2) return; // Keep at least header + 1 row
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
    onChange?.({ rows: newRows });
  };

  const addColumn = (index) => {
    const newRows = rows.map(row => {
      const newRow = [...row];
      newRow.splice(index + 1, 0, '');
      return newRow;
    });
    setRows(newRows);
    onChange?.({ rows: newRows });
  };

  const deleteColumn = (index) => {
    if (rows[0].length <= 2) return; // Keep at least 2 columns
    const newRows = rows.map(row => row.filter((_, i) => i !== index));
    setRows(newRows);
    onChange?.({ rows: newRows });
  };

  const moveRow = (index, direction) => {
    if (index === 0) return; // Don't move header
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 1 || newIndex >= rows.length) return;
    
    const newRows = [...rows];
    [newRows[index], newRows[newIndex]] = [newRows[newIndex], newRows[index]];
    setRows(newRows);
    onChange?.({ rows: newRows });
  };

  return (
    <div className="table-block">
      <div className="table-wrapper">
        <table className="note-table">
          <thead>
            <tr>
              <th className="table-row-controls"></th>
              {rows[0]?.map((cell, colIndex) => (
                <th key={colIndex} className="table-header-cell">
                  <div className="table-cell-content">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => updateCell(0, colIndex, e.target.value)}
                      placeholder={`Column ${colIndex + 1}`}
                      className="table-cell-input header-input"
                    />
                    <button
                      className="column-menu-btn"
                      onClick={() => setShowColumnMenu(showColumnMenu === colIndex ? null : colIndex)}
                    >
                      <ChevronDown size={14} />
                    </button>
                    {showColumnMenu === colIndex && (
                      <div className="column-menu">
                        <button onClick={() => { addColumn(colIndex); setShowColumnMenu(null); }}>
                          <Plus size={14} /> Insert Right
                        </button>
                        <button 
                          onClick={() => { deleteColumn(colIndex); setShowColumnMenu(null); }}
                          disabled={rows[0].length <= 2}
                        >
                          <Trash2 size={14} /> Delete Column
                        </button>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex + 1}>
                <td className="table-row-controls">
                  <div className="row-controls-group">
                    <button
                      className="row-control-btn"
                      onClick={() => moveRow(rowIndex + 1, 'up')}
                      title="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      className="row-control-btn"
                      onClick={() => moveRow(rowIndex + 1, 'down')}
                      title="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      className="row-control-btn"
                      onClick={() => addRow(rowIndex + 1)}
                      title="Add row below"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      className="row-control-btn delete"
                      onClick={() => deleteRow(rowIndex + 1)}
                      disabled={rows.length <= 2}
                      title="Delete row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
                {row.map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className={selectedCell?.row === rowIndex + 1 && selectedCell?.col === colIndex ? 'selected' : ''}
                  >
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => updateCell(rowIndex + 1, colIndex, e.target.value)}
                      onFocus={() => setSelectedCell({ row: rowIndex + 1, col: colIndex })}
                      onBlur={() => setSelectedCell(null)}
                      placeholder="Enter text"
                      className="table-cell-input"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-actions">
        <button className="table-action-btn" onClick={() => addRow(rows.length - 1)}>
          <Plus size={16} />
          Add Row
        </button>
        <button className="table-action-btn" onClick={() => addColumn(rows[0].length - 1)}>
          <Plus size={16} />
          Add Column
        </button>
      </div>
    </div>
  );
};

export default TableBlock;
