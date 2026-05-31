from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class ImportExportHistory(Base):
    __tablename__ = "import_export_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    operation_type = Column(String(20), nullable=False)
    source_type = Column(String(50), nullable=False)
    destination_type = Column(String(50), nullable=False)

    source_ids = Column(JSON, nullable=True)
    destination_ids = Column(JSON, nullable=True)

    item_count = Column(Integer, default=0)
    status = Column(String(20), default="completed")
    error_message = Column(Text, nullable=True)

    operation_metadata = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])


class ExportedFile(Base):
    __tablename__ = "exported_files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    history_id = Column(Integer, ForeignKey("import_export_history.id"), nullable=True)

    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)
    file_type = Column(String(20), nullable=False)
    file_size = Column(Integer, nullable=True)

    content_type = Column(String(50), nullable=False)
    download_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    history = relationship("ImportExportHistory", foreign_keys=[history_id])


class BatchOperation(Base):
    __tablename__ = "batch_operations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    operation_name = Column(String(100), nullable=False)
    source_type = Column(String(50), nullable=False)
    source_ids = Column(JSON, nullable=False)

    result_id = Column(Integer, nullable=True)
    result_type = Column(String(50), nullable=True)

    status = Column(String(20), default="pending")
    progress = Column(Integer, default=0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])


class ExternalImport(Base):
    __tablename__ = "external_imports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    source_platform = Column(String(50), nullable=False)
    source_url = Column(String(500), nullable=True)
    source_file_name = Column(String(255), nullable=True)

    import_type = Column(String(50), nullable=False)
    items_imported = Column(Integer, default=0)

    status = Column(String(20), default="pending")
    error_message = Column(Text, nullable=True)

    import_metadata = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
