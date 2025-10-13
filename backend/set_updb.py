#!/usr/bin/env python3
import models
from database import engine

if __name__ == "__main__":
    print("Creating all database tables...")
    models.Base.metadata.create_all(bind=engine)
    print("✅ Database created successfully!")