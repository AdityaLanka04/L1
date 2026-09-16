import asyncio
from unittest.mock import patch
import os
import pytest

TOPIC = '\n'.join(f'{i}. Prerequisites, applications and security issues in data science' for i in range(1, 7))

@pytest.mark.skipif(os.getenv("LEARNING_PATH_DATABASE_TEST") != "1", reason="Requires PostgreSQL test database with a user; all changes are rolled back")
def test_multiline_creation_and_atomic_failure():
    from sqlalchemy.orm import Session
    from database import engine
    import models
    from routes import learningpath as route
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode='create_savepoint')
    try:
        user = db.query(models.User).first()
        assert user is not None
        outline = route._default_outline(route._normalize_topic_prompt(TOPIC), 'advanced', 'long', ['Explain concepts', 'Apply skills'])
        outline['nodes'][0]['title'] = 'Detailed data science chapter ' * 30
        request = route.GeneratePathRequest(topicPrompt=TOPIC, difficulty='advanced', length='long', goals=['Explain concepts', 'Apply skills'])
        with patch.object(route, '_generate_outline', return_value=outline), patch.object(route, '_load_test_fallback_enabled', return_value=False), patch.object(route, '_env_int', return_value=0), patch.object(route, '_write_chroma_path'):
            result = asyncio.run(route.generate_learning_path(request, user, db))
        assert result['success']
        saved = db.get(models.LearningPath, result['path_id'])
        assert saved.topic_prompt == route._normalize_topic_prompt(TOPIC)
        assert len(saved.title) <= 255
        nodes = db.query(models.LearningPathNode).filter_by(path_id=saved.id).all()
        assert len(nodes) == len(outline['nodes'])
        assert all(len(n.title) <= 255 for n in nodes)
        assert db.query(models.LearningPathProgress).filter_by(path_id=saved.id).count() == 1
        before = db.query(models.LearningPath).count()
        outline['nodes'][0]['bloom_level'] = 'x' * 500
        with patch.object(route, '_generate_outline', return_value=outline), patch.object(route, '_load_test_fallback_enabled', return_value=False), patch.object(route, '_env_int', return_value=0), patch.object(route, '_write_chroma_path'):
            try:
                asyncio.run(route.generate_learning_path(request, user, db))
                raise AssertionError('Invalid node unexpectedly saved')
            except route.HTTPException as exc:
                assert exc.status_code == 500
        assert db.query(models.LearningPath).count() == before
        print('Multiline creation and atomic rollback verified against PostgreSQL')
    finally:
        db.close()
        transaction.rollback()
        connection.close()
