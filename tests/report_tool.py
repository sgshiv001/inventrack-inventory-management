import csv
from pathlib import Path
import sqlite3
import tempfile
import unittest
from contextlib import closing
from tools.inventory_report import load_products, build_summary, write_csv, write_summary


class InventoryReportTests(unittest.TestCase):
    def test_reports_use_database_rows_and_not_sample_inventory(self):
        with tempfile.TemporaryDirectory(prefix="inventrack-report-") as directory:
            folder = Path(directory)
            database = folder / "inventory.db"
            with closing(sqlite3.connect(database)) as connection, connection:
                connection.executescript("""
                    CREATE TABLE organizations(id TEXT);
                    CREATE TABLE suppliers(id TEXT, organization_id TEXT, name TEXT);
                    CREATE TABLE products(name TEXT,sku TEXT,category TEXT,quantity INTEGER,reorder_level INTEGER,cost REAL,price REAL,supplier_id TEXT,organization_id TEXT);
                    INSERT INTO organizations VALUES('org_live');
                    INSERT INTO suppliers VALUES('supplier_live','org_live','Verified supplier');
                    INSERT INTO products VALUES('Actual database row','LIVE-001','Equipment',3,5,2.5,4,'supplier_live','org_live');
                """)
            products = load_products(database, None)
            self.assertEqual(len(products), 1)
            self.assertEqual(build_summary(products).inventory_value, 7.5)
            write_csv(folder / "inventory.csv", products)
            write_summary(folder / "summary.md", products)
            with (folder / "inventory.csv").open(newline="", encoding="utf-8") as file:
                rows = list(csv.reader(file))
            self.assertEqual(rows[1][0], "Actual database row")
            self.assertIn("Verified supplier", (folder / "summary.md").read_text(encoding="utf-8"))
            with closing(sqlite3.connect(database)) as connection, connection:
                connection.execute("INSERT INTO organizations VALUES('org_other')")
            with self.assertRaises(ValueError):
                load_products(database, None)
            self.assertEqual(load_products(database, "org_other"), [])

    def test_missing_database_is_not_created(self):
        with tempfile.TemporaryDirectory(prefix="inventrack-report-") as directory:
            missing = Path(directory) / "missing.db"
            with self.assertRaises(sqlite3.OperationalError):
                load_products(missing, None)
            self.assertFalse(missing.exists())


if __name__ == "__main__":
    unittest.main()
