# 📚 Knowledge Roadmap Export Feature

## Quick Start

### For Users

1. **Navigate to Knowledge Roadmap**
   - Go to Learning Review → Knowledge Roadmap

2. **Create or Open a Roadmap**
   - Click "Create Roadmap" or select an existing one

3. **Explore Nodes**
   - Click the "Explore" button on any node
   - AI will generate detailed content for that node
   - Explored nodes are marked with a ✨ badge

4. **Export to Notes**
   - Click "Export to Notes" button (top-right)
   - All explored nodes will be exported
   - Choose to view the exported note

### What Gets Exported?

✅ **Only explored nodes** (nodes you've clicked "Explore" on)
✅ **Hierarchical structure** (parent-child relationships)
✅ **Bold node titles** (easy to identify)
✅ **Complete content** (overview, concepts, examples, tips)
✅ **Professional formatting** (styled sections, proper spacing)

### Export Format

Each exported node includes:
- **Bold heading** (size based on depth)
- Description
- 📖 Overview (AI explanation)
- 🔑 Key Concepts (bulleted list)
- ⭐ Why This Matters
- 🌍 Real-World Examples
- 💡 Learning Tips

## For Developers

### Setup

1. **Run Database Migration**
   ```bash
   python backend/migrations/add_roadmap_export_fields.py
   ```

2. **Restart Backend Server**
   ```bash
   # Backend will automatically use new schema
   ```

3. **No Frontend Changes Needed**
   - Feature is ready to use immediately

### Architecture

```
User clicks Export
    ↓
Fetch roadmap data (GET /api/get_knowledge_roadmap/{id})
    ↓
Filter explored nodes only
    ↓
Build hierarchical structure
    ↓
Generate formatted HTML
    ↓
Create note (POST /api/create_note)
    ↓
Show success & navigate option
```

### Key Files

**Frontend:**
- `src/pages/KnowledgeRoadmap.js` - Export logic
- `src/pages/KnowledgeRoadmap.css` - Button styling

**Backend:**
- `backend/models.py` - Database schema
- `backend/main.py` - API endpoints
- `backend/migrations/add_roadmap_export_fields.py` - Migration

### API Endpoints Used

1. **GET** `/api/get_knowledge_roadmap/{roadmap_id}`
   - Fetches complete roadmap with all nodes
   - Returns explored node data

2. **POST** `/api/create_note`
   - Creates new note with formatted content
   - Returns note ID

### Database Schema

New columns in `knowledge_nodes`:
```sql
why_important TEXT NULL
real_world_examples TEXT NULL  -- JSON array
learning_tips TEXT NULL
```

## Examples

### Before Export
```
Roadmap: Machine Learning
├── Machine Learning (explored ✨)
│   ├── Supervised Learning (explored ✨)
│   │   └── Linear Regression (explored ✨)
│   └── Unsupervised Learning (not explored)
└── Deep Learning (not explored)
```

### After Export
```
Note: "Machine Learning - Roadmap Export"

# Machine Learning
[Complete content with all sections]

## Supervised Learning
[Complete content with indentation]

### Linear Regression
[Complete content with more indentation]

[Unsupervised Learning and Deep Learning NOT included]
```

## Troubleshooting

### "No explored nodes to export"
**Solution:** Click "Explore" button on nodes first to generate content

### Export button disabled
**Solution:** Wait for current export to complete

### Missing content in exported note
**Solution:** Ensure nodes were explored (have ✨ badge) before exporting

### Database error
**Solution:** Run migration script:
```bash
python backend/migrations/add_roadmap_export_fields.py
```

## Features

✅ Smart filtering (only explored nodes)
✅ Hierarchical structure preserved
✅ Bold formatting for node titles
✅ Rich content sections
✅ Theme-aware styling
✅ Loading states
✅ Error handling
✅ Success feedback
✅ Navigation option

## Future Enhancements

- [ ] Export to PDF
- [ ] Export to Markdown
- [ ] Selective export (choose nodes)
- [ ] Export templates
- [ ] Batch export
- [ ] Custom styling options

## Support

For issues or questions:
1. Check this README
2. Review ROADMAP_EXPORT_FEATURE.md
3. Check IMPLEMENTATION_SUMMARY.md
4. View EXPORT_EXAMPLE.html for visual reference

## License

Part of the Cerbyl Learning Platform
