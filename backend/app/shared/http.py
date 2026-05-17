from flask import jsonify, request
from marshmallow import ValidationError


def json_error(message, status_code):
    return jsonify({"error": message}), status_code


def load_payload(schema):
    payload = request.get_json(silent=True)

    if payload is None:
        raise ValidationError("Payload JSON invalido ou ausente.")

    return schema.load(payload)
