from decimal import Decimal

from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema


_CATEGORIAS = ["fruta", "legume", "verdura"]
_UNIDADES = ["kg", "un", "cx"]


class _ProdutoNormalizationSchema(Schema):
    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return {}

        normalized = dict(data)

        if isinstance(normalized.get("nome"), str):
            normalized["nome"] = normalized["nome"].strip()

        for field_name in ("categoria", "unidade_medida"):
            if isinstance(normalized.get(field_name), str):
                normalized[field_name] = normalized[field_name].strip().lower()

        return normalized


class ProdutoCreateSchema(_ProdutoNormalizationSchema):
    nome = fields.Str(required=True, validate=validate.Length(min=1, max=120))
    categoria = fields.Str(required=True, validate=validate.OneOf(_CATEGORIAS))
    unidade_medida = fields.Str(required=True, validate=validate.OneOf(_UNIDADES))
    estoque_minimo = fields.Decimal(
        required=False,
        load_default=Decimal("0"),
        validate=validate.Range(min=0),
    )
    preco_venda_padrao = fields.Decimal(
        required=False,
        load_default=Decimal("0"),
        validate=validate.Range(min=0),
    )
    validade_dias_padrao = fields.Int(
        required=False,
        load_default=1,
        validate=validate.Range(min=1),
    )
    ativo = fields.Bool(required=False, load_default=True)


class ProdutoUpdateSchema(_ProdutoNormalizationSchema):
    nome = fields.Str(validate=validate.Length(min=1, max=120))
    categoria = fields.Str(validate=validate.OneOf(_CATEGORIAS))
    unidade_medida = fields.Str(validate=validate.OneOf(_UNIDADES))
    estoque_minimo = fields.Decimal(validate=validate.Range(min=0))
    preco_venda_padrao = fields.Decimal(validate=validate.Range(min=0))
    validade_dias_padrao = fields.Int(validate=validate.Range(min=1))
    ativo = fields.Bool()

    @validates_schema
    def validate_not_empty(self, data, **kwargs):
        if not data:
            raise ValidationError("Pelo menos um campo deve ser informado.")
