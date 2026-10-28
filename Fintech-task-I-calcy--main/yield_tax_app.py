"""Desktop interface for the bank yield and tax calculator."""

import tkinter as tk
from tkinter import messagebox, ttk

from yield_tax_engine import YieldAndTaxEngine


BACKGROUND = "#071317"
PANEL = "#102126"
PANEL_ALT = "#142a30"
CYAN = "#38e0d0"
TEXT = "#f3f7f8"
MUTED = "#9bb0b5"
ENTRY = "#0b1b20"


class YieldTaxApp:
    """Render the yield engine in a dark, teal-accented desktop window."""

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.engine = YieldAndTaxEngine()
        self.root.title("Yield & Tax Scanner")
        self.root.configure(bg=BACKGROUND)
        self.root.geometry("1280x800")
        self.root.minsize(1000, 680)

        self._configure_styles()
        self._build_layout()
        self.calculate()

    def _configure_styles(self) -> None:
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure(
            "TCombobox",
            fieldbackground=ENTRY,
            background=ENTRY,
            foreground=TEXT,
            arrowcolor=CYAN,
            bordercolor="#28464d",
            lightcolor="#28464d",
            darkcolor="#28464d",
            padding=8,
        )
        style.map(
            "TCombobox",
            fieldbackground=[("readonly", ENTRY)],
            foreground=[("readonly", TEXT)],
            selectbackground=[("readonly", ENTRY)],
            selectforeground=[("readonly", TEXT)],
        )
        style.configure(
            "Yield.Treeview",
            background=ENTRY,
            fieldbackground=ENTRY,
            foreground=TEXT,
            rowheight=36,
            borderwidth=0,
            font=("Consolas", 10),
        )
        style.configure(
            "Yield.Treeview.Heading",
            background=PANEL_ALT,
            foreground=CYAN,
            relief="flat",
            padding=10,
            font=("Segoe UI", 9, "bold"),
        )
        style.map(
            "Yield.Treeview",
            background=[("selected", "#164b50")],
            foreground=[("selected", TEXT)],
        )

    def _build_layout(self) -> None:
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(2, weight=1)

        header = tk.Frame(self.root, bg=BACKGROUND)
        header.grid(row=0, column=0, sticky="ew", padx=32, pady=(24, 18))
        tk.Label(
            header,
            text="YIELD & TAX SCANNER",
            bg=BACKGROUND,
            fg=CYAN,
            font=("Segoe UI", 10, "bold"),
        ).pack(anchor="w")
        tk.Label(
            header,
            text="Compare fixed-deposit outcomes",
            bg=BACKGROUND,
            fg=TEXT,
            font=("Segoe UI", 24, "bold"),
        ).pack(anchor="w", pady=(5, 3))
        tk.Label(
            header,
            text="Illustrative sample rates • Quarterly compounding • Estimates only",
            bg=BACKGROUND,
            fg=MUTED,
            font=("Segoe UI", 10),
        ).pack(anchor="w")

        inputs = tk.Frame(self.root, bg=PANEL, padx=20, pady=17)
        inputs.grid(row=1, column=0, sticky="ew", padx=32, pady=(0, 18))
        for column in range(5):
            inputs.columnconfigure(column, weight=1)

        self.principal_var = tk.StringVar(value="500000")
        self.years_var = tk.StringVar(value="5")
        self.senior_var = tk.StringVar(value="No")
        self.pan_var = tk.BooleanVar(value=True)
        self.product_var = tk.StringVar(value="Compare all banks")

        self._add_entry(inputs, "PRINCIPAL AMOUNT (₹)", self.principal_var, 0)
        self._add_entry(inputs, "TIME PERIOD (YEARS)", self.years_var, 1)
        self._add_selector(
            inputs,
            "SENIOR CITIZEN",
            self.senior_var,
            ["No", "Yes"],
            2,
        )
        product_names = [
            product["Product Name"] for product in self.engine.list_products()
        ]
        self._add_selector(
            inputs,
            "BANK PRODUCT",
            self.product_var,
            ["Compare all banks", *product_names],
            3,
        )
        self._add_checkbox(
            inputs,
            "PAN CARD PROVIDED",
            self.pan_var,
            4,
        )

        calculate_button = tk.Button(
            inputs,
            text="CALCULATE YIELDS",
            command=self.calculate,
            bg="#0d363b",
            fg=CYAN,
            activebackground="#16484c",
            activeforeground=TEXT,
            relief="solid",
            bd=1,
            highlightthickness=1,
            highlightbackground=CYAN,
            highlightcolor=CYAN,
            padx=20,
            pady=11,
            cursor="hand2",
            font=("Segoe UI", 10, "bold"),
        )
        calculate_button.grid(
            row=0, column=5, sticky="ew", padx=(4, 0), pady=(18, 0)
        )
        inputs.columnconfigure(5, weight=0)

        content = tk.Frame(self.root, bg=BACKGROUND)
        content.grid(row=2, column=0, sticky="nsew", padx=32, pady=(0, 28))
        content.columnconfigure(0, weight=1)
        content.rowconfigure(1, weight=1)

        section_heading = tk.Frame(content, bg=BACKGROUND)
        section_heading.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        tk.Label(
            section_heading,
            text="PROJECTED OUTCOMES",
            bg=BACKGROUND,
            fg=TEXT,
            font=("Segoe UI", 11, "bold"),
        ).pack(side="left")
        self.status_label = tk.Label(
            section_heading,
            text="",
            bg=BACKGROUND,
            fg=MUTED,
            font=("Segoe UI", 9),
        )
        self.status_label.pack(side="right")

        table_frame = tk.Frame(content, bg=PANEL, padx=1, pady=1)
        table_frame.grid(row=1, column=0, sticky="nsew")
        table_frame.columnconfigure(0, weight=1)
        table_frame.rowconfigure(0, weight=1)
        columns = ("product", "rate", "interest", "balance")
        self.results = ttk.Treeview(
            table_frame,
            columns=columns,
            show="headings",
            style="Yield.Treeview",
        )
        headings = {
            "product": "BANK PRODUCT",
            "rate": "ANNUAL RATE",
            "interest": "TOTAL INTEREST",
            "balance": "FINAL BALANCE",
        }
        widths = {"product": 300, "rate": 150, "interest": 220, "balance": 220}
        for column in columns:
            self.results.heading(column, text=headings[column])
            self.results.column(
                column,
                width=widths[column],
                anchor="w" if column == "product" else "e",
                stretch=column in ("product", "interest", "balance"),
            )
        self.results.tag_configure("best", foreground=CYAN)
        self.results.grid(row=0, column=0, sticky="nsew")
        scrollbar = ttk.Scrollbar(
            table_frame, orient="vertical", command=self.results.yview
        )
        self.results.configure(yscrollcommand=scrollbar.set)
        scrollbar.grid(row=0, column=1, sticky="ns")

        recommendation = tk.Frame(content, bg=PANEL, padx=18, pady=15)
        recommendation.grid(row=2, column=0, sticky="ew", pady=(16, 0))
        recommendation.columnconfigure(0, weight=1)
        tk.Label(
            recommendation,
            text="RECOMMENDATION & TAX ANALYSIS",
            bg=PANEL,
            fg=CYAN,
            font=("Segoe UI", 10, "bold"),
        ).grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 12))
        self.recommendation_labels: dict[str, tk.Label] = {}
        metrics = [
            ("Best performer", "Best-performing bank"),
            ("Best maturity", "Best-performing final balance"),
            ("Yield spread", "Yield spread"),
            ("Estimated yearly interest", "Estimated yearly interest"),
            ("TDS threshold", "TDS threshold"),
            ("Tax rate", "TDS rate"),
            ("Estimated TDS", "TDS deduction"),
            ("Net yearly interest (after TDS)", "Net yearly interest after TDS"),
        ]
        for index, (label, key) in enumerate(metrics):
            row, column = divmod(index, 4)
            cell = tk.Frame(recommendation, bg=PANEL)
            cell.grid(row=row + 1, column=column, sticky="ew", padx=(0, 16), pady=5)
            tk.Label(
                cell,
                text=label.upper(),
                bg=PANEL,
                fg=MUTED,
                font=("Segoe UI", 8, "bold"),
            ).pack(anchor="w")
            value_label = tk.Label(
                cell,
                text="—",
                bg=PANEL,
                fg=TEXT,
                font=("Consolas", 11, "bold"),
            )
            value_label.pack(anchor="w", pady=(4, 0))
            self.recommendation_labels[key] = value_label

    @staticmethod
    def _add_entry(
        parent: tk.Frame, label: str, variable: tk.StringVar, column: int
    ) -> None:
        cell = tk.Frame(parent, bg=PANEL)
        cell.grid(row=0, column=column, sticky="ew", padx=(0, 12))
        tk.Label(
            cell,
            text=label,
            bg=PANEL,
            fg=MUTED,
            font=("Segoe UI", 8, "bold"),
        ).pack(anchor="w", pady=(0, 7))
        tk.Entry(
            cell,
            textvariable=variable,
            bg=ENTRY,
            fg=TEXT,
            insertbackground=CYAN,
            relief="flat",
            highlightthickness=1,
            highlightbackground="#28464d",
            highlightcolor=CYAN,
            font=("Consolas", 11),
        ).pack(fill="x", ipady=8)

    @staticmethod
    def _add_selector(
        parent: tk.Frame,
        label: str,
        variable: tk.StringVar,
        options: list[str],
        column: int,
    ) -> None:
        cell = tk.Frame(parent, bg=PANEL)
        cell.grid(row=0, column=column, sticky="ew", padx=(0, 12))
        tk.Label(
            cell,
            text=label,
            bg=PANEL,
            fg=MUTED,
            font=("Segoe UI", 8, "bold"),
        ).pack(anchor="w", pady=(0, 7))
        ttk.Combobox(
            cell,
            textvariable=variable,
            values=options,
            state="readonly",
            font=("Segoe UI", 10),
        ).pack(fill="x", ipady=4)

    @staticmethod
    def _add_checkbox(
        parent: tk.Frame, label: str, variable: tk.BooleanVar, column: int
    ) -> None:
        cell = tk.Frame(parent, bg=PANEL)
        cell.grid(row=0, column=column, sticky="ew", padx=(0, 12))
        tk.Label(
            cell,
            text=label,
            bg=PANEL,
            fg=MUTED,
            font=("Segoe UI", 8, "bold"),
        ).pack(anchor="w", pady=(0, 7))
        tk.Checkbutton(
            cell,
            text="Yes",
            variable=variable,
            onvalue=True,
            offvalue=False,
            bg=PANEL,
            fg=TEXT,
            activebackground=PANEL,
            activeforeground=CYAN,
            selectcolor=ENTRY,
            font=("Segoe UI", 10),
        ).pack(anchor="w", ipady=5)

    def calculate(self) -> None:
        """Validate current inputs and update the results and analytics."""
        try:
            principal = float(
                self.principal_var.get()
                .replace(",", "")
                .replace("₹", "")
                .strip()
            )
            years = float(self.years_var.get().strip())
            if self.senior_var.get() not in ("Yes", "No"):
                raise ValueError("Choose Yes or No for senior citizen status.")

            is_senior_citizen = self.senior_var.get() == "Yes"
            selected_product = self.product_var.get()
            if selected_product == "Compare all banks":
                selected_product = None
            outcomes = self.engine.process_investment(
                principal,
                years,
                is_senior_citizen,
                selected_product,
            )
            report = self.engine.generate_recommendation(
                outcomes,
                years,
                is_senior_citizen=is_senior_citizen,
                pan_provided=self.pan_var.get(),
            )
        except (TypeError, ValueError) as error:
            messagebox.showerror("Check your inputs", str(error), parent=self.root)
            return

        for item in self.results.get_children():
            self.results.delete(item)
        best_product = str(report["Best-performing bank"])
        for outcome in outcomes:
            self.results.insert(
                "",
                "end",
                values=(
                    outcome["Product Name"],
                    f"{float(outcome['Applied Rate']):.2f}%",
                    self._format_money(float(outcome["Total Interest"])),
                    self._format_money(float(outcome["Final Balance"])),
                ),
                tags=("best",) if outcome["Bank Name"] == best_product else (),
            )

        money_keys = {
            "Best-performing final balance",
            "Yield spread",
            "Estimated yearly interest",
            "TDS threshold",
            "TDS deduction",
            "Net yearly interest after TDS",
        }
        for key, label in self.recommendation_labels.items():
            value = report[key]
            label.configure(
                text=(
                    self._format_money(float(value))
                    if key in money_keys
                    else f"{float(value):.0f}%"
                    if key == "TDS rate"
                    else str(value)
                )
            )
        self.status_label.configure(
            text=f"{len(outcomes)} product{'s' if len(outcomes) != 1 else ''} • "
            f"{'Senior citizen rate applied' if self.senior_var.get() == 'Yes' else 'Standard rate'}"
        )

    @staticmethod
    def _format_money(amount: float) -> str:
        return f"₹{amount:,.2f}"


def main() -> None:
    root = tk.Tk()
    YieldTaxApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
