from typing import Annotated
from pydantic import BeforeValidator # Hoặc from pydantic.functional_validators import BeforeValidator nếu dùng Pydantic v2+

PyObjectId = Annotated[str, BeforeValidator(str)]