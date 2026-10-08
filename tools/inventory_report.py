"""Generate simple inventory reports from an InvenTrack database.

Usage:
    python tools/inventory_report.py --db C:/Backups/inventrack.db
    python tools/inventory_report.py --db C:/Backups/inventrack.db --csv reports/inventory.csv --summary reports/summary.md
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
from dataclasses import dataclass
from contextlib import closing
from pathlib import Path


def load_products(database: Path, organization: str | None) -> list[dict]:
    with closing(sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        organizations = connection.execute("SELECT id FROM organizations").fetchall()
        if organization is None:
            if len(organizations) != 1:
                raise ValueError("Choose an organization explicitly with --organization for this database.")
            organization = organizations[0]["id"]
        if not any(row["id"] == organization for row in organizations):
            raise ValueError("The chosen organization does not exist.")
        return [dict(row) for row in connection.execute(
            "SELECT p.name,p.sku,p.category,p.quantity,p.reorder_level AS reorder,p.cost,p.price,"
            "COALESCE(s.name,'') AS supplierName FROM products p LEFT JOIN suppliers s "
            "ON s.id=p.supplier_id AND s.organization_id=p.organization_id WHERE p.organization_id=? ORDER BY p.name",
            (organization,),
        )]


@dataclass(frozen=True)
class Summary:
    products: int
    units: int
    inventory_value: float
    potential_margin: float
    low_stock: int
    out_of_stock: int


def rupees(amount: int) -> str:
    return f"Rs. {amount:,.0f}"


def product_status(product: dict) -> str:
    if product["quantity"] == 0:
        return "Out of stock"
    if product["quantity"] <= product["reorder"]:
        return "Low stock"
    return "In stock"


def suggested_reorder_qty(product: dict) -> int:
    if product["quantity"] > product["reorder"]:
        return 0
    return max(product["reorder"] * 2 - product["quantity"], product["reorder"] - product["quantity"])


def build_summary(products: list[dict]) -> Summary:
    return Summary(
        products=len(products),
        units=sum(product["quantity"] for product in products),
        inventory_value=sum(product["quantity"] * product["cost"] for product in products),
        potential_margin=sum(product["quantity"] * (product["price"] - product["cost"]) for product in products),
        low_stock=sum(1 for product in products if product["quantity"] <= product["reorder"]),
        out_of_stock=sum(1 for product in products if product["quantity"] == 0),
    )


def write_csv(path: Path, products: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["Name", "SKU", "Category", "Quantity", "Reorder Level", "Suggested Reorder", "Cost", "Price", "Value", "Margin", "Supplier", "Status"])
        for product in products:
            writer.writerow([
                product["name"],
                product["sku"],
                product["category"],
                product["quantity"],
                product["reorder"],
                suggested_reorder_qty(product),
                product["cost"],
                product["price"],
                product["quantity"] * product["cost"],
                product["quantity"] * (product["price"] - product["cost"]),
                product["supplierName"],
                product_status(product),
            ])


def write_summary(path: Path, products: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    summary = build_summary(products)
    low_stock = [product for product in products if product["quantity"] <= product["reorder"]]
    reorder_units = sum(suggested_reorder_qty(product) for product in low_stock)
    reorder_cost = sum(suggested_reorder_qty(product) * product["cost"] for product in low_stock)
    lines = [
        "# InvenTrack Inventory Summary",
        "",
        f"- Total products: {summary.products}",
        f"- Units in stock: {summary.units}",
        f"- Inventory value: {rupees(summary.inventory_value)}",
        f"- Potential gross margin: {rupees(summary.potential_margin)}",
        f"- Low-stock products: {summary.low_stock}",
        f"- Out-of-stock products: {summary.out_of_stock}",
        f"- Suggested reorder units: {reorder_units}",
        f"- Estimated reorder budget: {rupees(reorder_cost)}",
        "",
        "## Reorder Attention",
        "",
    ]
    if low_stock:
        lines.extend(f"- {product['name']} ({product['sku']}): order {suggested_reorder_qty(product)} units from {product['supplierName'] or 'Unassigned supplier'}" for product in low_stock)
    else:
        lines.append("- No products need reordering.")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate CSV and Markdown reports for InvenTrack inventory.")
    parser.add_argument("--db", required=True, help="Existing SQLite database path (opened read-only).")
    parser.add_argument("--organization", help="Organization ID; required when the database has multiple organizations.")
    parser.add_argument("--csv", default="reports/inventory.csv", help="CSV output path.")
    parser.add_argument("--summary", default="reports/summary.md", help="Markdown summary output path.")
    args = parser.parse_args()

    try:
        products = load_products(Path(args.db), args.organization)
    except (sqlite3.Error, ValueError) as error:
        parser.error(str(error))
    write_csv(Path(args.csv), products)
    write_summary(Path(args.summary), products)
    summary = build_summary(products)
    print(f"Generated reports for {summary.products} products.")
    print(f"Inventory value: {rupees(summary.inventory_value)}")
    print(f"Potential gross margin: {rupees(summary.potential_margin)}")


if __name__ == "__main__":
    main()
