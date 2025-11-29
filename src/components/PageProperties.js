import React, { useState } from 'react';
import {
  Settings, Plus, X, Calendar, User, Tag, Link2,
  Hash, CheckSquare, FileText
} from 'lucide-react';
import './PageProperties.css';

const PROPERTY_ICONS = {
  text: FileText,
  date: Calendar,
  person: User,
  tags: Tag,
  url: Link2,
  number: Hash,
  checkbox: CheckSquare,
};

const PageProperties = ({ properties, onChange, readOnly = false, darkMode = false }) => {
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState('text');

  const addProperty = () => {
    if (!newPropertyName.trim()) return;

    const newProp = {
      id: Date.now().toString(),
      name: newPropertyName,
      type: newPropertyType,
      value: newPropertyType === 'checkbox' ? false : '',
    };

    onChange([...properties, newProp]);
    setNewPropertyName('');
    setNewPropertyType('text');
    setShowAddProperty(false);
  };

  const updateProperty = (id, updates) => {
    onChange(properties.map(prop =>
      prop.id === id ? { ...prop, ...updates } : prop
    ));
  };

  const deleteProperty = (id) => {
    onChange(properties.filter(prop => prop.id !== id));
  };

  const renderPropertyValue = (property) => {
    if (readOnly) {
      return (
        <div className="property-value-display">
          {property.type === 'checkbox' ? (
            <input type="checkbox" checked={property.value} disabled />
          ) : property.type === 'date' ? (
            property.value ? new Date(property.value).toLocaleDateString() : '-'
          ) : (
            property.value || '-'
          )}
        </div>
      );
    }

    switch (property.type) {
      case 'text':
      case 'url':
        return (
          <input
            type="text"
            value={property.value || ''}
            onChange={(e) => updateProperty(property.id, { value: e.target.value })}
            className="property-input"
            placeholder={`Enter ${property.name.toLowerCase()}...`}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={property.value || ''}
            onChange={(e) => updateProperty(property.id, { value: e.target.value })}
            className="property-input"
            placeholder="0"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={property.value || ''}
            onChange={(e) => updateProperty(property.id, { value: e.target.value })}
            className="property-input"
          />
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={property.value || false}
            onChange={(e) => updateProperty(property.id, { value: e.target.checked })}
            className="property-checkbox"
          />
        );
      case 'tags':
        return (
          <input
            type="text"
            value={property.value || ''}
            onChange={(e) => updateProperty(property.id, { value: e.target.value })}
            className="property-input"
            placeholder="tag1, tag2, tag3"
          />
        );
      case 'person':
        return (
          <input
            type="text"
            value={property.value || ''}
            onChange={(e) => updateProperty(property.id, { value: e.target.value })}
            className="property-input"
            placeholder="Enter name..."
          />
        );
      default:
        return (
          <input
            type="text"
            value={property.value || ''}
            onChange={(e) => updateProperty(property.id, { value: e.target.value })}
            className="property-input"
          />
        );
    }
  };

  return (
    <div className="page-properties">
      <div className="properties-header">
        <Settings size={16} />
        <span>Page Properties</span>
      </div>

      <div className="properties-list">
        {properties.map((property) => {
          const Icon = PROPERTY_ICONS[property.type] || FileText;
          return (
            <div key={property.id} className="property-row">
              <div className="property-label">
                <Icon size={14} />
                <span>{property.name}</span>
              </div>
              <div className="property-value">
                {renderPropertyValue(property)}
                {!readOnly && (
                  <button
                    className="delete-property-btn"
                    onClick={() => deleteProperty(property.id)}
                    title="Delete property"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <>
          {showAddProperty ? (
            <div className="add-property-form">
              <input
                type="text"
                value={newPropertyName}
                onChange={(e) => setNewPropertyName(e.target.value)}
                placeholder="Property name"
                className="property-name-input"
                autoFocus
              />
              <select
                value={newPropertyType}
                onChange={(e) => setNewPropertyType(e.target.value)}
                className="property-type-select"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="checkbox">Checkbox</option>
                <option value="tags">Tags</option>
                <option value="person">Person</option>
                <option value="url">URL</option>
              </select>
              <div className="form-actions">
                <button onClick={addProperty} className="add-btn">
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddProperty(false);
                    setNewPropertyName('');
                  }}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="add-property-btn"
              onClick={() => setShowAddProperty(true)}
            >
              <Plus size={14} />
              Add Property
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default PageProperties;
