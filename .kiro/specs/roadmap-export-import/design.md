# Design Document - Roadmap Export/Import Feature

## Overview

This design document outlines the technical implementation for exporting knowledge roadmaps from Learning Reviews to Notes and importing them with a structured format. The feature will capture the roadmap visualization as an image and format the content with headers and explanations for each node.

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Learning Reviews                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Knowledge Roadmap Component                         │  │
│  │  - Generate roadmap visualization                    │  │
│  │  - Display nodes and connections                     │  │
│  │  - [Export to Notes] button                          │  │
│  └──────────────────┬───────────────────────────────────┘  │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────────┐
         │  Export Process            │
         │  1. Capture roadmap image  │
         │  2. Extract node data      │
         │  3. Format content         │
         │  4. Create note            │
         └────────────┬───────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                        Notes System                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Notes Editor                                        │  │
│  │  - [Import Roadmap] button in toolbar               │  │
│  │  - Display formatted roadmap content                 │  │
│  │  - Edit and organize imported content               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Import Modal                                        │  │
│  │  - List available roadmaps                           │  │
│  │  - Search/filter functionality                       │  │
│  │  - Select and import                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### 1. KnowledgeRoadmap Component Enhancement

**Location**: `src/pages/KnowledgeRoadmap.js`

**New State Variables**:
```javascript
const [exporting, setExporting] = useState(false);
const [exportSuccess, setExportSuccess] = useState(false);
```

**New Functions**:
```javascript
// Capture roadmap as image using html2canvas or similar
const captureRoadmapImage = async () => {
  const canvas = roadmapRef.current;
  const dataUrl = await html2canvas(canvas).toDataURL('image/png');
  return dataUrl;
};

// Extract all node data in order
const extractRoadmapData = () => {
  return {
    title: roadmapTitle,
    nodes: nodes.map(node => ({
      id: node.id,
      title: node.title,
      explanation: node.explanation,
      order: node.order
    })),
    imageData: null // Will be populated by captureRoadmapImage
  };
};

// Export roadmap to notes
const handleExportToNotes = async () => {
  setExporting(true);
  try {
    const imageData = await captureRoadmapImage();
    const roadmapData = extractRoadmapData();
    roadmapData.imageData = imageData;
    
    const response = await fetch(`${API_URL}/export_roadmap_to_note`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userName,
        roadmap_data: roadmapData
      })
    });
    
    if (response.ok) {
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    }
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    setExporting(false);
  }
};
```

**UI Addition**:
```jsx
<button 
  className="export-roadmap-btn"
  onClick={handleExportToNotes}
  disabled={exporting || !nodes.length}
>
  {exporting ? (
    <>
      <Loader size={16} />
      Exporting...
    </>
  ) : exportSuccess ? (
    <>
      <Check size={16} />
      Exported!
    </>
  ) : (
    <>
      <FileText size={16} />
      Export to Notes
    </>
  )}
</button>
```

#### 2. NotesRedesign Component Enhancement

**Location**: `src/pages/NotesRedesign.js`

**New State Variables**:
```javascript
const [showRoadmapImport, setShowRoadmapImport] = useState(false);
const [availableRoadmaps, setAvailableRoadmaps] = useState([]);
const [selectedRoadmap, setSelectedRoadmap] = useState(null);
const [importingRoadmap, setImportingRoadmap] = useState(false);
const [roadmapSearchTerm, setRoadmapSearchTerm] = useState('');
```

**New Functions**:
```javascript
// Load available roadmaps
const loadAvailableRoadmaps = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/get_user_roadmaps?user_id=${userName}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      setAvailableRoadmaps(data.roadmaps || []);
    }
  } catch (error) {
    console.error('Failed to load roadmaps:', error);
  }
};

// Import selected roadmap
const handleImportRoadmap = async () => {
  if (!selectedRoadmap) return;
  
  setImportingRoadmap(true);
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/get_roadmap_content/${selectedRoadmap.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      const formattedContent = formatRoadmapForNote(data);
      
      // Insert into current note
      const quill = quillRef.current?.getEditor();
      if (quill) {
        const cursorPosition = quill.getSelection()?.index || quill.getLength();
        quill.clipboard.dangerouslyPasteHTML(cursorPosition, formattedContent);
      }
      
      setShowRoadmapImport(false);
      setSelectedRoadmap(null);
    }
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    setImportingRoadmap(false);
  }
};

// Format roadmap data for note insertion
const formatRoadmapForNote = (roadmapData) => {
  let html = '';
  
  // Add roadmap image
  if (roadmapData.image_url) {
    html += `<p><img src="${roadmapData.image_url}" alt="Knowledge Roadmap" style="max-width: 100%; height: auto;" /></p>`;
  }
  
  // Add each node as a section
  roadmapData.nodes.forEach(node => {
    html += `<h2><strong>${node.title}</strong></h2>`;
    html += `<p>${node.explanation}</p>`;
    html += `<p><br></p>`; // Spacing between sections
  });
  
  return html;
};
```

**UI Addition - Import Button in Toolbar**:
```jsx
<button 
  className="nav-btn"
  onClick={() => {
    setShowRoadmapImport(true);
    loadAvailableRoadmaps();
  }}
  title="Import Roadmap"
>
  <Map size={16} />
  Import Roadmap
</button>
```

#### 3. Roadmap Import Modal Component

**New Component**: `src/components/RoadmapImportModal.js`

```jsx
const RoadmapImportModal = ({ 
  isOpen, 
  onClose, 
  roadmaps, 
  selectedRoadmap,
  onSelectRoadmap,
  onImport,
  importing,
  searchTerm,
  onSearchChange
}) => {
  if (!isOpen) return null;
  
  const filteredRoadmaps = roadmaps.filter(roadmap =>
    roadmap.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content roadmap-import-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Import Knowledge Roadmap</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <input
            type="text"
            className="roadmap-search"
            placeholder="Search roadmaps..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
          />
          
          <div className="roadmap-list">
            {filteredRoadmaps.length === 0 ? (
              <div className="no-roadmaps">
                <p>No roadmaps found</p>
                <span>Create a roadmap in Learning Reviews first</span>
              </div>
            ) : (
              filteredRoadmaps.map(roadmap => (
                <div
                  key={roadmap.id}
                  className={`roadmap-item ${selectedRoadmap?.id === roadmap.id ? 'selected' : ''}`}
                  onClick={() => onSelectRoadmap(roadmap)}
                >
                  <div className="roadmap-item-icon">
                    <Map size={20} />
                  </div>
                  <div className="roadmap-item-content">
                    <div className="roadmap-item-title">{roadmap.title}</div>
                    <div className="roadmap-item-meta">
                      {roadmap.node_count} nodes • Created {new Date(roadmap.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {selectedRoadmap?.id === roadmap.id && (
                    <Check size={20} className="roadmap-item-check" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={onImport}
            disabled={!selectedRoadmap || importing}
          >
            {importing ? 'Importing...' : 'Import Roadmap'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

### Backend API Endpoints

#### 1. Export Roadmap to Note

**Endpoint**: `POST /api/export_roadmap_to_note`

**Request Body**:
```json
{
  "user_id": "string",
  "roadmap_data": {
    "title": "string",
    "nodes": [
      {
        "id": "string",
        "title": "string",
        "explanation": "string",
        "order": "number"
      }
    ],
    "imageData": "base64_string"
  }
}
```

**Implementation**:
```python
@app.post("/api/export_roadmap_to_note")
async def export_roadmap_to_note(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        roadmap_data = payload.get("roadmap_data")
        
        # Save roadmap image
        image_url = None
        if roadmap_data.get("imageData"):
            image_url = save_roadmap_image(roadmap_data["imageData"], user.id)
        
        # Create roadmap record
        roadmap = models.LearningReview(
            user_id=user.id,
            title=roadmap_data["title"],
            review_type="roadmap",
            content=json.dumps(roadmap_data["nodes"]),
            image_url=image_url
        )
        db.add(roadmap)
        db.commit()
        db.refresh(roadmap)
        
        # Format content for note
        note_content = format_roadmap_as_note_html(roadmap_data, image_url)
        
        # Create note
        note = models.Note(
            user_id=user.id,
            title=f"Roadmap: {roadmap_data['title']}",
            content=note_content
        )
        db.add(note)
        db.commit()
        
        return {
            "status": "success",
            "note_id": note.id,
            "roadmap_id": roadmap.id
        }
        
    except Exception as e:
        logger.error(f"Export roadmap error: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
```

#### 2. Get User Roadmaps

**Endpoint**: `GET /api/get_user_roadmaps`

**Query Parameters**: `user_id`

**Response**:
```json
{
  "roadmaps": [
    {
      "id": "number",
      "title": "string",
      "node_count": "number",
      "created_at": "datetime",
      "image_url": "string"
    }
  ]
}
```

**Implementation**:
```python
@app.get("/api/get_user_roadmaps")
async def get_user_roadmaps(
    user_id: str = Query(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        roadmaps = db.query(models.LearningReview).filter(
            models.LearningReview.user_id == user.id,
            models.LearningReview.review_type == "roadmap"
        ).order_by(models.LearningReview.created_at.desc()).all()
        
        return {
            "roadmaps": [{
                "id": r.id,
                "title": r.title,
                "node_count": len(json.loads(r.content)) if r.content else 0,
                "created_at": r.created_at.isoformat(),
                "image_url": r.image_url
            } for r in roadmaps]
        }
        
    except Exception as e:
        logger.error(f"Get roadmaps error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### 3. Get Roadmap Content

**Endpoint**: `GET /api/get_roadmap_content/{roadmap_id}`

**Response**:
```json
{
  "id": "number",
  "title": "string",
  "image_url": "string",
  "nodes": [
    {
      "id": "string",
      "title": "string",
      "explanation": "string",
      "order": "number"
    }
  ]
}
```

**Implementation**:
```python
@app.get("/api/get_roadmap_content/{roadmap_id}")
async def get_roadmap_content(
    roadmap_id: int,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        roadmap = db.query(models.LearningReview).filter(
            models.LearningReview.id == roadmap_id,
            models.LearningReview.user_id == user.id
        ).first()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        nodes = json.loads(roadmap.content) if roadmap.content else []
        
        return {
            "id": roadmap.id,
            "title": roadmap.title,
            "image_url": roadmap.image_url,
            "nodes": nodes
        }
        
    except Exception as e:
        logger.error(f"Get roadmap content error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

## Data Models

### Database Schema Updates

**New Table**: `learning_reviews` (if not exists)

```sql
CREATE TABLE IF NOT EXISTS learning_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    review_type VARCHAR(50) NOT NULL,  -- 'roadmap', 'flashcard', etc.
    content TEXT,  -- JSON string of nodes
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Model Definition**:
```python
class LearningReview(Base):
    __tablename__ = "learning_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    review_type = Column(String(50), nullable=False)
    content = Column(Text)
    image_url = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

## Error Handling

### Frontend Error Scenarios

1. **Image Capture Failure**:
   - Fallback to text-only export
   - Show warning message to user
   - Log error for debugging

2. **Network Failure**:
   - Show retry button
   - Preserve roadmap data locally
   - Display clear error message

3. **No Roadmaps Available**:
   - Show empty state with guidance
   - Link to Learning Reviews section

### Backend Error Scenarios

1. **Image Save Failure**:
   - Continue with text export
   - Log error details
   - Return partial success status

2. **Database Error**:
   - Rollback transaction
   - Return 500 with error details
   - Preserve user data

## Testing Strategy

### Unit Tests

1. **Frontend**:
   - Test image capture function
   - Test data extraction
   - Test HTML formatting
   - Test modal interactions

2. **Backend**:
   - Test roadmap save
   - Test note creation
   - Test image storage
   - Test data retrieval

### Integration Tests

1. End-to-end export flow
2. End-to-end import flow
3. Image upload and retrieval
4. Note editor integration

### Manual Testing Checklist

- [ ] Export roadmap with 5 nodes
- [ ] Export roadmap with 20 nodes
- [ ] Import roadmap into new note
- [ ] Import roadmap into existing note
- [ ] Search for roadmaps
- [ ] Edit imported content
- [ ] Verify image quality
- [ ] Test on mobile devices
- [ ] Test with slow network
- [ ] Test error scenarios

## Performance Considerations

1. **Image Optimization**:
   - Compress images before upload
   - Use WebP format when supported
   - Lazy load images in modal

2. **Data Loading**:
   - Paginate roadmap list if > 50 items
   - Cache roadmap data client-side
   - Use debounced search

3. **Rendering**:
   - Use virtual scrolling for large lists
   - Optimize Quill editor insertions
   - Minimize re-renders

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only access their own roadmaps
3. **Input Validation**: Sanitize all user inputs
4. **Image Upload**: Validate file types and sizes
5. **XSS Prevention**: Sanitize HTML content before insertion
