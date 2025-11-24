import React, { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import './EnhancedTable.css';

const EnhancedTable = ({ initialData, onChange, readOnly = false }) => {
  const [data, setData] = useState(initialData || {
    headers: ['Column 1', 'Column 2', 'Column 3'],
    rows: [
      ['', '', ''],
      ['', '', '']
    ]
  });

  const updateData = (newData) => {
    setData(newData);
    if (onChange) onChange(newData);
  };

  const addRow = () => {
    const newRows = [...data.rows, new Array(data.headers.length).fill('')];
    updateData({ ...data, rows: newRows });
  };

  const addColumn = () => {
    const newHeaders = [...data.headers, `Column ${data.headers.length + 1}`];
    const newRows = data.rows.map(row => [...row, '']);
    updateData({ headers: newHeaders, rows: newRows });
  };

  const deleteRow = (index) => {
    if (data.rows.length <= 1) return;
    const newRows = data.rows.filter((_, i) => i !== index);
    updateData({ ...data, rows: newRows });
  };

  const deleteColumn = (index) => {
    if (data.headers.length <= 1) return;
    const newHeaders = data.headers.filter((_, i) => i !== index);
    const newRows = data.rows.map(row => row.filter((_, i) => i !== index));
    updateData({ headers: newHeaders, rows: newRows });
  };

  const updateHeader = (index, value) => {
    const newHeaders = [...data.headers];
    newHeaders[index] = value;
    updateData({ ...data, headers: newHeaders });
  };

  const updateCell = (rowIndex, colIndex, value) => {
    const newRows = [...data.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][colIndex] = value;
    updateData({ ...data, rows: newRows });
  };

  return (
    <div className="enhanced-table-wrapper">
      <table className="enhanced-table">
        <thead>
          <tr>
            {!readOnly && <th className="table-grip-cell"></th>}
            {data.headers.map((header, index) => (
              <th key={index}>
                <input
                  type="text"
                  value={header}
                  onChange={(e) => updateHeader(index, e.target.value)}
                  className="table-header-input"
                  readOnly={readOnly}
                />
                {!readOnly && data.headers.length > 1 && (
                  <button
                    onClick={() => deleteColumn(index)}
                    className="table-delete-col"
                    title="Delete column"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </th>
            ))}
            {!readOnly && (
              <th className="table-add-cell">
                <button onClick={addColumn} className="table-add-btn" title="Add column">
                  <Plus size={14} />
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {!readOnly && (
                <td className="table-grip-cell">
                  <GripVertical size={14} className="table-grip-icon" />
                  {data.rows.length > 1 && (
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      className="table-delete-row"
                      title="Delete row"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              )}
              {row.map((cell, colIndex) => (
                <td key={colIndex}>
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                    className="table-cell-input"
                    readOnly={readOnly}
                  />
                </td>
              ))}
              {!readOnly && <td className="table-add-cell"></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <button onClick={addRow} className="table-add-row-btn">
          <Plus size={14} />
          Add row
        </button>
      )}
    </div>
  );
};

export default EnhancedTable;
