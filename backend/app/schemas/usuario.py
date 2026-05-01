from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema


_PERFIS = ["gerente", "funcionario"]


class _UsuarioNormalizationSchema(Schema):
    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return {}

        normalized = dict(data)

        for field_name in ("nome", "email"):
            if isinstance(normalized.get(field_name), str):
                normalized[field_name] = normalized[field_name].strip()

        if isinstance(normalized.get("email"), str):
            normalized["email"] = normalized["email"].lower()

        if isinstance(normalized.get("perfil"), str):
            normalized["perfil"] = normalized["perfil"].strip().lower()

        return normalized


class UsuarioCreateSchema(_UsuarioNormalizationSchema):
    nome = fields.Str(required=True, validate=validate.Length(min=1, max=120))
    email = fields.Email(required=True, validate=validate.Length(max=255))
    senha = fields.Str(required=True, load_only=True, validate=validate.Length(min=6, max=255))
    perfil = fields.Str(required=True, validate=validate.OneOf(_PERFIS))
    ativo = fields.Bool(required=False, load_default=True)


class UsuarioUpdateSchema(_UsuarioNormalizationSchema):
    perfil = fields.Str(validate=validate.OneOf(_PERFIS))
    ativo = fields.Bool()

    @validates_schema
    def validate_not_empty(self, data, **kwargs):
        if not data:
            raise ValidationError("Pelo menos um campo deve ser informado.")
