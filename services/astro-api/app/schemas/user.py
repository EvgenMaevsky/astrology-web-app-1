from pydantic import BaseModel


class DeleteAccountRequest(BaseModel):
    """Confirmation for deleting an account.

    Which field is required depends on the account: one created with a
    password confirms with that password, one created through Google has no
    password and confirms by typing its own email address instead. Without
    the second path a Google user could never delete their account at all,
    which is not merely inconvenient — it denies them the right to erasure.
    """

    password: str | None = None
    email: str | None = None
