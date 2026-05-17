from datetime import date

from marshmallow import ValidationError


def parse_optional_positive_int_arg(args, arg_name):
    raw_value = args.get(arg_name)

    if raw_value in (None, ""):
        return None

    try:
        value = int(raw_value)
    except ValueError:
        raise ValidationError({arg_name: ["Deve ser um inteiro positivo."]})

    if value < 1:
        raise ValidationError({arg_name: ["Deve ser um inteiro positivo."]})

    return value


def parse_optional_date_arg(args, arg_name):
    raw_value = args.get(arg_name)

    if raw_value in (None, ""):
        return None

    try:
        return date.fromisoformat(raw_value)
    except ValueError:
        raise ValidationError({arg_name: ["Deve estar no formato YYYY-MM-DD."]})


def parse_optional_enum_arg(args, arg_name, enum_class):
    raw_value = args.get(arg_name)

    if raw_value in (None, ""):
        return None

    try:
        return enum_class(raw_value)
    except ValueError:
        raise ValidationError({arg_name: ["Valor invalido."]})
