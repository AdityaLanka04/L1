import secrets


def generate_uid(length: int = 16) -> str:
    return secrets.token_urlsafe(length)


def resolve_by_id_or_uid(query, model, identifier: str, uid_field: str = "public_token"):
    identifier = str(identifier).strip()
    if identifier.isdigit():
        return query.filter(model.id == int(identifier))
    return query.filter(getattr(model, uid_field) == identifier)
