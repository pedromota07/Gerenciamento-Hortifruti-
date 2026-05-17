from decimal import Decimal, ROUND_HALF_UP


MONEY_QUANTUM = Decimal("0.01")


def quantize_money(value):
    return value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
