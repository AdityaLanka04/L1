# Implementation Plan - Roadmap Export/Import Feature

## Task Overview

This implementation plan breaks down the roadmap export/import feature into discrete, manageable coding tasks. Each task builds incrementally on previous work to create a complete, functional feature.

---

## Backend Implementation

- [ ] 1. Create database schema and models for learning reviews
  - Create migration script for `learning_reviews` table with columns: id, user_id, title, review_type, content, image_url, created_at, updated_at
  - Add `LearningReview` model class in `models.py` with proper relationships
  - Add foreign key constraint to users table
  - Test database migration on development database
  - _Requirements: 1.4, 9.1_

- [ ] 2. Implement image storage utility functions
  - Create `save_roadmap_image()` function to handle base64 image data
  - Implement image compression and format conversion (PNG/WebP)
  - Create unique filename generation with user_id prefix
  - Add image file validation (size, format, dimensions)
  - Store images in appropriate directory with proper permissions
  - Return image URL for database storage
  - _Requirements: 5.1, 5.4, 9.4_

- [ ] 3. Implement roadmap HTML formatting utility
  - Create `format_roadmap_as_note_html()` function
  - Generate HTML with image tag at top with proper styling
  - Format each node as H2 header with bold text
  - Add node explanation as paragraph below each header
  - Insert proper spacing between sections
  - Preserve special formatting in explanations
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4_

- [ ] 4. Create export roadmap to note endpoint
  - Implement `POST /api/export_roadmap_to_note` endpoint
  - Validate user authentication and authorization
  - Extract roadmap data from request payload
  - Call image storage utility to save roadmap image
  - Create LearningReview database record
  - Format roadmap content as HTML
  - Create new Note record with formatted content
  - Return success response with note_id and roadmap_id
  - Handle errors with appropriate HTTP status codes
  - _Requirements: 1.2, 1.3, 1.4, 9.1, 9.5_

- [ ] 5. Create get user roadmaps endpoint
  - Implement `GET /api/get_user_roadmaps` endpoint
  - Validate user authentication
  - Query learning_reviews table filtered by user_id and review_type='roadmap'
  - Order results by created_at descending
  - Calculate node_count from JSON content
  - Return formatted list with id, title, node_count, created_at, image_url
  - _Requirements: 6.1, 6.2, 9.2, 9.5_

- [ ] 6. Create get roadmap content endpoint
  - Implement `GET /api/get_roadmap_content/{roadmap_id}` endpoint
  - Validate user authentication and ownership
  - Query specific roadmap by id
  - Parse JSON content to extract nodes array
  - Return complete roadmap data including image_url
  - Handle not found scenarios with 404 status
  - _Requirements: 3.2, 9.3, 9.5_

---

## Frontend - Knowledge Roadmap Component

- [ ] 7. Add export functionality to KnowledgeRoadmap component
  - Add state variables: `exporting`, `exportSuccess`
  - Install and configure html2canvas library for image capture
  - Implement `captureRoadmapImage()` function using html2canvas
  - Create `extractRoadmapData()` function to gather all node information
  - Implement `handleExportToNotes()` function with API call
  - Add error handling and user feedback
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3_

- [ ] 8. Add export button UI to roadmap interface
  - Add "Export to Notes" button to roadmap toolbar/header
  - Show loading state with spinner during export
  - Display success state with checkmark icon
  - Disable button when no nodes exist
  - Add appropriate styling matching existing design
  - Show confirmation message on successful export
  - _Requirements: 1.1, 1.5, 10.3_

---

## Frontend - Notes Component

- [ ] 9. Add import roadmap state and functions to NotesRedesign
  - Add state variables: `showRoadmapImport`, `availableRoadmaps`, `selectedRoadmap`, `importingRoadmap`, `roadmapSearchTerm`
  - Implement `loadAvailableRoadmaps()` function with API call
  - Create `formatRoadmapForNote()` function to generate HTML
  - Implement `handleImportRoadmap()` function to insert content
  - Add Quill editor integration for content insertion at cursor position
  - Handle case when no cursor position exists (append to end)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 10. Create RoadmapImportModal component
  - Create new component file `src/components/RoadmapImportModal.js`
  - Implement modal overlay with click-outside-to-close
  - Add modal header with title and close button
  - Create search input with filter functionality
  - Build roadmap list with selectable items
  - Show roadmap metadata (title, node count, date)
  - Highlight selected roadmap
  - Add empty state for no roadmaps
  - Include Import and Cancel buttons in footer
  - Disable import button when no selection
  - _Requirements: 3.2, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 11. Style RoadmapImportModal component
  - Create CSS file `src/components/RoadmapImportModal.css`
  - Style modal overlay with backdrop blur
  - Style modal content box with proper sizing
  - Style search input matching existing design
  - Style roadmap list items with hover effects
  - Add selected state styling with accent color
  - Style empty state message
  - Add responsive design for mobile devices
  - Use dynamic color variables from theme
  - _Requirements: 6.1, 6.2, 10.3_

- [ ] 12. Add import button to Notes toolbar
  - Add "Import Roadmap" button to top navigation in NotesRedesign
  - Position button appropriately in toolbar
  - Add Map icon from lucide-react
  - Connect button click to open import modal
  - Trigger loadAvailableRoadmaps on modal open
  - Style button to match existing toolbar buttons
  - _Requirements: 3.1, 8.1_

- [ ] 13. Integrate modal with Notes component
  - Import RoadmapImportModal component in NotesRedesign
  - Pass all required props (isOpen, onClose, roadmaps, etc.)
  - Connect modal callbacks to state functions
  - Handle modal close and cleanup
  - Test modal open/close flow
  - Verify content insertion works correctly
  - _Requirements: 3.3, 3.4, 3.5, 8.2, 8.3_

---

## Content Formatting and Integration

- [ ] 14. Implement proper HTML formatting for roadmap content
  - Ensure image is embedded with proper src attribute
  - Set image max-width to 100% for responsiveness
  - Format headers as `<h2><strong>Title</strong></h2>`
  - Format explanations as `<p>Text</p>` with proper line breaks
  - Add spacing `<p><br></p>` between sections
  - Preserve lists, emphasis, and other formatting in explanations
  - Test rendering in Quill editor
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 15. Ensure imported content is fully editable
  - Verify all imported HTML works with Quill editor
  - Test image resize and delete operations
  - Test header editing and reformatting
  - Test paragraph editing
  - Verify undo/redo works with imported content
  - Test copy/paste of imported sections
  - _Requirements: 8.1, 8.2_

---

## Error Handling and Validation

- [ ] 16. Implement frontend error handling
  - Add try-catch blocks to all API calls
  - Show user-friendly error messages for export failures
  - Implement fallback to text-only export if image fails
  - Show error message if no roadmap selected during import
  - Add retry mechanism for failed operations
  - Log errors to console for debugging
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 17. Implement backend error handling and validation
  - Add input validation for all endpoint parameters
  - Validate image data format and size
  - Check user ownership before operations
  - Handle database errors with rollback
  - Return appropriate HTTP status codes
  - Log all errors with context information
  - _Requirements: 7.1, 7.4, 7.5, 9.4, 9.5_

---

## Testing and Polish

- [ ] 18. Add loading indicators and user feedback
  - Show spinner during export operation
  - Show loading state in import modal
  - Display progress for long operations
  - Show success confirmation messages
  - Add smooth transitions for state changes
  - Ensure all operations feel responsive
  - _Requirements: 1.5, 10.1, 10.2, 10.3, 10.4_

- [ ] 19. Optimize performance
  - Implement image compression before upload
  - Add debouncing to roadmap search
  - Optimize Quill editor insertions
  - Test with roadmaps containing 20+ nodes
  - Ensure export completes within 3 seconds
  - Ensure modal loads within 1 second
  - Profile and optimize slow operations
  - _Requirements: 10.1, 10.2, 10.5_

- [ ] 20. Test integration with existing features
  - Test roadmap content with note folders
  - Test roadmap content with note search
  - Test roadmap content with favorites
  - Test roadmap content with trash/restore
  - Test roadmap content with AI features
  - Verify all note formatting tools work
  - Test on different screen sizes
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

---

## Documentation and Cleanup

- [ ] 21. Add code comments and documentation
  - Document all new functions with JSDoc comments
  - Add inline comments for complex logic
  - Document API endpoints in backend
  - Add README section for roadmap feature
  - Document any configuration requirements

- [ ] 22. Final testing and bug fixes
  - Perform end-to-end testing of export flow
  - Perform end-to-end testing of import flow
  - Test error scenarios and edge cases
  - Fix any discovered bugs
  - Verify all requirements are met
  - Get user acceptance testing feedback
