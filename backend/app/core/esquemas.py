"""Classes base para os schemas de entrada (dados que chegam na API)."""

from typing import ClassVar

from pydantic import BaseModel, ConfigDict, model_validator


class Entrada(BaseModel):
    """Base de todo schema de entrada: remove espaços extras no início e fim dos textos."""

    model_config = ConfigDict(str_strip_whitespace=True)


class EntradaParcial(Entrada):
    """Base para atualizações parciais (PATCH): só os campos enviados são alterados.

    Campos listados em CAMPOS_OBRIGATORIOS podem ser omitidos, mas não podem ser enviados como null.
    """

    CAMPOS_OBRIGATORIOS: ClassVar[tuple[str, ...]] = ()

    @model_validator(mode="after")
    def _sem_nulos_em_obrigatorios(self):
        for campo in self.CAMPOS_OBRIGATORIOS:
            if campo in self.model_fields_set and getattr(self, campo) is None:
                raise ValueError(f"O campo '{campo}' não pode ser nulo.")
        return self
