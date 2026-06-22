from datetime import date
from decimal import Decimal

from marshmallow import Schema, fields, validate

from ..models.movimentacao import SubtipoMovimentacao


def _enum_values(enum_class):
    return [member.value for member in enum_class]


class MovimentacaoCreateSchema(Schema):
    produto_id = fields.Int(required=True, validate=validate.Range(min=1))
    usuario_id = fields.Int(
        required=False,
        allow_none=True,
        load_default=None,
        validate=validate.Range(min=1),
    )
    quantidade = fields.Decimal(
        required=True,
        validate=validate.Range(min=Decimal("0.001")),
    )
    custo_unitario = fields.Decimal(
        required=False,
        allow_none=True,
        load_default=None,
        validate=validate.Range(min=Decimal("0")),
    )
    preco_unitario_venda = fields.Decimal(
        required=False,
        allow_none=True,
        load_default=None,
        validate=validate.Range(min=Decimal("0")),
    )
    data = fields.Date(required=False, load_default=date.today)
    subtipo = fields.Str(
        required=False,
        allow_none=True,
        load_default=None,
        validate=validate.OneOf(_enum_values(SubtipoMovimentacao)),
    )
    observacao = fields.Str(required=False, allow_none=True, validate=validate.Length(max=500))


class VendaLoteItemSchema(Schema):
    produto_id = fields.Int(required=True, validate=validate.Range(min=1))
    quantidade = fields.Decimal(
        required=True,
        validate=validate.Range(min=Decimal("0.001")),
    )
    preco_unitario_venda = fields.Decimal(
        required=False,
        allow_none=True,
        load_default=None,
        validate=validate.Range(min=Decimal("0")),
    )


class VendaLoteSchema(Schema):
    usuario_id = fields.Int(
        required=False,
        allow_none=True,
        load_default=None,
        validate=validate.Range(min=1),
    )
    data = fields.Date(required=False, load_default=date.today)
    observacao = fields.Str(required=False, allow_none=True, validate=validate.Length(max=500))
    itens = fields.List(
        fields.Nested(VendaLoteItemSchema),
        required=True,
        validate=validate.Length(min=1),
    )
