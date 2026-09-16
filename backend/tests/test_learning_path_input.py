from services.learning_path_input import learning_path_title


def test_multiline_topic_is_not_used_as_an_oversized_title():
    topic = '\n'.join(f'{i}. Prerequisites, applications and security issues in data science' for i in range(1, 7))
    original = topic
    title = learning_path_title(topic)
    assert len(title) <= 255
    assert '\n' not in title
    assert title.endswith('…')
    assert topic == original


def test_short_titles_and_blank_fallback():
    assert learning_path_title('Data\nscience') == 'Data science'
    assert learning_path_title(None, 'Data Science') == 'Data Science'
    assert learning_path_title('  ') == 'Learning Path'


def test_unicode_and_long_model_titles_fit_database_limit():
    assert len(learning_path_title('量子' * 200)) <= 255
    assert len(learning_path_title(None, 'x' * 800)) <= 255
