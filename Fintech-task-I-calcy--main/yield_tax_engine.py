"""Backend engine for comparing quarterly-compounded bank yields and TDS."""

import math
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, TypedDict


class BankProduct(TypedDict):
    """Sample data and current simulated rate for one bank product."""

    bank_name: str
    product_name: str
    base_rate: float


class YieldAndTaxEngine:
    """Compare bank products with simulated market rates and estimate yearly TDS."""

    def __init__(self) -> None:
        self.products = self._load_products()
        self.senior_citizen_premium = 0.50
        self.senior_tds_threshold = 100_000.00
        self.standard_tds_threshold = 50_000.00
        self.pan_tds_rate = 0.10
        self.no_pan_tds_rate = 0.20

    @staticmethod
    def _load_products() -> dict[str, BankProduct]:
        """Load product identities; replace this method for another data source."""
        return {
            "Bank A - 1 Year FD": {
                "bank_name": "Bank A",
                "product_name": "Bank A - 1 Year FD",
                "base_rate": 6.5,
            },
            "Bank B - 1 Year FD": {
                "bank_name": "Bank B",
                "product_name": "Bank B - 1 Year FD",
                "base_rate": 7.0,
            },
            "Bank C - 1 Year FD": {
                "bank_name": "Bank C",
                "product_name": "Bank C - 1 Year FD",
                "base_rate": 7.1,
            },
            "Bank D - 1 Year FD": {
                "bank_name": "Bank D",
                "product_name": "Bank D - 1 Year FD",
                "base_rate": 7.2,
            },
        }

    def list_products(self) -> list[dict[str, str | float]]:
        """Return product names and base rates for a frontend selector."""
        return [
            {
                "Product Name": product["product_name"],
                "Bank Name": product["bank_name"],
                "Base Rate": product["base_rate"],
            }
            for product in self.products.values()
        ]

    @staticmethod
    def _positive_number(value: Any, name: str) -> float:
        """Convert a positive finite numeric input to float or raise clearly."""
        if isinstance(value, bool):
            raise TypeError(f"{name} must be a number, not a boolean.")

        try:
            number = float(value)
        except (TypeError, ValueError) as exc:
            raise TypeError(f"{name} must be a numeric value.") from exc

        if not math.isfinite(number) or number <= 0:
            raise ValueError(f"{name} must be a positive finite number.")
        return number

    @staticmethod
    def _money(value: float) -> float:
        """Round a financial result to cents using conventional half-up rounding."""
        return float(
            Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        )

    def calculate_quarterly_compound_interest(
        self, principal: float, effective_rate: float, years: float
    ) -> tuple[float, float]:
        """Return (maturity value, total interest) using quarterly compounding.

        ``effective_rate`` is expressed as a percentage, for example 10.14.
        """
        principal_amount = self._positive_number(principal, "principal")
        annual_rate = self._positive_number(effective_rate, "effective_rate")
        tenure = self._positive_number(years, "years")

        quarterly_rate = annual_rate / 100 / 4
        quarters = 4 * tenure
        maturity_value = principal_amount * (1 + quarterly_rate) ** quarters
        total_interest = maturity_value - principal_amount
        return self._money(maturity_value), self._money(total_interest)

    def process_investment(
        self,
        principal: float,
        years: float,
        is_senior_citizen: bool,
        selected_product: str | None = None,
    ) -> list[dict[str, float | str]]:
        """Calculate outcomes for all products, or only the selected product."""
        principal_amount = self._positive_number(principal, "principal")
        tenure = self._positive_number(years, "years")
        if principal_amount > 1_000_000_000_000:
            raise ValueError("principal must not exceed ₹1,000,000,000,000.")
        if tenure > 100:
            raise ValueError("years must not exceed 100.")
        if not isinstance(is_senior_citizen, bool):
            raise TypeError("is_senior_citizen must be True or False.")

        if selected_product is not None and selected_product not in self.products:
            available = ", ".join(self.products)
            raise ValueError(
                f"Unknown product {selected_product!r}. Available products: "
                f"{available}."
            )

        if selected_product is None:
            products = self.products.items()
        else:
            products = [(selected_product, self.products[selected_product])]

        premium = self.senior_citizen_premium if is_senior_citizen else 0.0
        outcomes: list[dict[str, float | str]] = []
        for _, product in products:
            bank_name = product["bank_name"]
            base_rate = product["base_rate"]
            applied_rate = base_rate + premium
            final_balance, total_interest = (
                self.calculate_quarterly_compound_interest(
                    principal_amount, applied_rate, tenure
                )
            )
            outcomes.append(
                {
                    "Bank Name": bank_name,
                    "Product Name": product["product_name"],
                    "Applied Rate": self._money(applied_rate),
                    "Total Interest": total_interest,
                    "Final Balance": final_balance,
                }
            )
        return outcomes

    def generate_recommendation(
        self,
        bank_data: list[dict[str, float | str]],
        years: float,
        is_senior_citizen: bool = False,
        pan_provided: bool = True,
    ) -> dict[str, str | float]:
        """Summarize the best bank, yield spread, and estimated TDS."""
        tenure = self._positive_number(years, "years")
        if not isinstance(is_senior_citizen, bool):
            raise TypeError("is_senior_citizen must be True or False.")
        if not isinstance(pan_provided, bool):
            raise TypeError("pan_provided must be True or False.")
        if not bank_data:
            raise ValueError("bank_data must contain at least one bank outcome.")

        try:
            best_bank = max(bank_data, key=lambda row: float(row["Final Balance"]))
            lowest_bank = min(bank_data, key=lambda row: float(row["Final Balance"]))
            best_balance = float(best_bank["Final Balance"])
            lowest_balance = float(lowest_bank["Final Balance"])
            best_interest = float(best_bank["Total Interest"])
            bank_name = str(best_bank["Bank Name"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(
                "Each bank outcome must include Bank Name, Total Interest, "
                "and Final Balance."
            ) from exc

        estimated_yearly_interest = self._money(best_interest / tenure)
        tds_threshold = (
            self.senior_tds_threshold
            if is_senior_citizen
            else self.standard_tds_threshold
        )
        tds_rate = self.pan_tds_rate if pan_provided else self.no_pan_tds_rate
        tds_deduction = (
            self._money(estimated_yearly_interest * tds_rate)
            if estimated_yearly_interest > tds_threshold
            else 0.0
        )
        return {
            "Best-performing bank": bank_name,
            "Best-performing final balance": self._money(best_balance),
            "Yield spread": self._money(best_balance - lowest_balance),
            "Estimated yearly interest": estimated_yearly_interest,
            "TDS threshold": tds_threshold,
            "TDS rate": tds_rate * 100,
            "TDS deduction": tds_deduction,
            "Net yearly interest after TDS": self._money(
                estimated_yearly_interest - tds_deduction
            ),
        }


def _format_money(amount: float) -> str:
    return f"₹{amount:,.2f}"


if __name__ == "__main__":
    engine = YieldAndTaxEngine()
    investment_principal = 500_000
    investment_years = 5
    senior_citizen = True

    outcomes = engine.process_investment(
        investment_principal, investment_years, senior_citizen
    )
    report = engine.generate_recommendation(
        outcomes,
        investment_years,
        is_senior_citizen=senior_citizen,
        pan_provided=True,
    )

    print("Projected bank outcomes")
    for outcome in outcomes:
        print(
            f"{outcome['Product Name']}: "
            f"{outcome['Applied Rate']:.2f}% | "
            f"Interest {_format_money(float(outcome['Total Interest']))} | "
            f"Final balance {_format_money(float(outcome['Final Balance']))}"
        )

    print("\nRecommendation & tax analysis")
    print(f"Best-performing bank: {report['Best-performing bank']}")
    print(
        "Best-performing final balance: "
        f"{_format_money(float(report['Best-performing final balance']))}"
    )
    print(f"Yield spread: {_format_money(float(report['Yield spread']))}")
    print(
        "Estimated yearly interest: "
        f"{_format_money(float(report['Estimated yearly interest']))}"
    )
    print(f"TDS threshold: {_format_money(float(report['TDS threshold']))}")
    print(f"TDS rate: {report['TDS rate']:.0f}%")
    print(f"TDS deduction: {_format_money(float(report['TDS deduction']))}")
    print(
        "Net yearly interest after TDS: "
        f"{_format_money(float(report['Net yearly interest after TDS']))}"
    )
