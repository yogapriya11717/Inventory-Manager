
import os
import sqlite3
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ==========================================
# LOAD ENVIRONMENT VARIABLES
# ==========================================

load_dotenv(Path(__file__).with_name(".env"))

DATABASE_URL = os.getenv("DATABASE_URL")


# ==========================================
# FASTAPI APPLICATION
# ==========================================

app = FastAPI(
    title="Inventory Manager API",
    description="Inventory management with persistent PostgreSQL storage",
    version="1.0.0"
)


# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# DATABASE CONNECTION
# ==========================================

def get_db_connection():
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is missing. Check backend/.env."
        )

    return psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row
    )


# ==========================================
# CREATE POSTGRESQL TABLES
# ==========================================

def create_tables():
    connection = get_db_connection()

    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                quantity INTEGER NOT NULL CHECK (quantity >= 0),
                minimum_stock INTEGER NOT NULL
                    CHECK (minimum_stock >= 0)
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS stock_movements (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL
                    REFERENCES products(id) ON DELETE CASCADE,
                type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                balance INTEGER NOT NULL CHECK (balance >= 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS usage_history (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL
                    REFERENCES products(id) ON DELETE CASCADE,
                quantity_used INTEGER NOT NULL
                    CHECK (quantity_used > 0),
                remaining_stock INTEGER NOT NULL
                    CHECK (remaining_stock >= 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# Create tables when the application starts
create_tables()


# ==========================================
# DATA MODELS
# ==========================================

class Product(BaseModel):
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    quantity: int = Field(ge=0)
    minimum_stock: int = Field(ge=0)


class StockChange(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


# ==========================================
# HOME
# ==========================================

@app.get("/")
def home():
    return {
        "message": "Inventory Manager Backend is running!",
        "database": "PostgreSQL"
    }


# ==========================================
# GET ALL PRODUCTS
# ==========================================

@app.get("/products")
def get_products():
    connection = get_db_connection()

    try:
        rows = connection.execute(
            "SELECT * FROM products ORDER BY id"
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


# ==========================================
# ADD PRODUCT
# ==========================================

@app.post("/products", status_code=201)
def add_product(product: Product):
    connection = get_db_connection()

    try:
        row = connection.execute(
            """
            INSERT INTO products
                (name, category, quantity, minimum_stock)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (
                product.name.strip(),
                product.category.strip().lower(),
                product.quantity,
                product.minimum_stock
            )
        ).fetchone()

        connection.commit()

        return {
            "message": "Product added successfully",
            "id": row["id"]
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ==========================================
# UPDATE PRODUCT
# ==========================================

@app.put("/products/{product_id}")
def update_product(product_id: int, product: Product):
    connection = get_db_connection()

    try:
        cursor = connection.execute(
            """
            UPDATE products
            SET name = %s,
                category = %s,
                quantity = %s,
                minimum_stock = %s
            WHERE id = %s
            """,
            (
                product.name.strip(),
                product.category.strip().lower(),
                product.quantity,
                product.minimum_stock,
                product_id
            )
        )

        if cursor.rowcount == 0:
            connection.rollback()
            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        connection.commit()

        return {
            "message": "Product updated successfully",
            "id": product_id
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ==========================================
# DELETE PRODUCT
# ==========================================

@app.delete("/products/{product_id}")
def delete_product(product_id: int):
    connection = get_db_connection()

    try:
        cursor = connection.execute(
            "DELETE FROM products WHERE id = %s",
            (product_id,)
        )

        if cursor.rowcount == 0:
            connection.rollback()
            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        connection.commit()

        return {
            "message": "Product deleted successfully",
            "id": product_id
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ==========================================
# STOCK IN
# ==========================================

@app.post("/stock/in")
def stock_in(stock: StockChange):
    connection = get_db_connection()

    try:
        product = connection.execute(
            "SELECT * FROM products WHERE id = %s FOR UPDATE",
            (stock.product_id,)
        ).fetchone()

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        new_quantity = product["quantity"] + stock.quantity

        connection.execute(
            "UPDATE products SET quantity = %s WHERE id = %s",
            (new_quantity, stock.product_id)
        )

        connection.execute(
            """
            INSERT INTO stock_movements
                (product_id, type, quantity, balance)
            VALUES (%s, 'IN', %s, %s)
            """,
            (
                stock.product_id,
                stock.quantity,
                new_quantity
            )
        )

        connection.commit()

        return {
            "message": "Stock added successfully",
            "product_id": stock.product_id,
            "quantity_added": stock.quantity,
            "current_stock": new_quantity
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ==========================================
# STOCK OUT
# ==========================================

@app.post("/stock/out")
def stock_out(stock: StockChange):
    connection = get_db_connection()

    try:
        product = connection.execute(
            "SELECT * FROM products WHERE id = %s FOR UPDATE",
            (stock.product_id,)
        ).fetchone()

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        current_quantity = product["quantity"]

        if stock.quantity > current_quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Only {current_quantity} units are available"
            )

        new_quantity = current_quantity - stock.quantity

        connection.execute(
            "UPDATE products SET quantity = %s WHERE id = %s",
            (new_quantity, stock.product_id)
        )

        connection.execute(
            """
            INSERT INTO stock_movements
                (product_id, type, quantity, balance)
            VALUES (%s, 'OUT', %s, %s)
            """,
            (
                stock.product_id,
                stock.quantity,
                new_quantity
            )
        )

        connection.execute(
            """
            INSERT INTO usage_history
                (product_id, quantity_used, remaining_stock)
            VALUES (%s, %s, %s)
            """,
            (
                stock.product_id,
                stock.quantity,
                new_quantity
            )
        )

        connection.commit()

        return {
            "message": "Stock removed successfully",
            "product_id": stock.product_id,
            "quantity_removed": stock.quantity,
            "remaining_stock": new_quantity
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ==========================================
# GET STOCK MOVEMENT HISTORY
# ==========================================

@app.get("/stock/movements")
def get_stock_movements():
    connection = get_db_connection()

    try:
        rows = connection.execute(
            """
            SELECT
                sm.id,
                sm.product_id,
                p.name AS product_name,
                sm.type,
                sm.quantity,
                sm.balance,
                sm.created_at
            FROM stock_movements sm
            JOIN products p ON p.id = sm.product_id
            ORDER BY sm.id DESC
            """
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


# ==========================================
# GET USAGE HISTORY
# ==========================================

@app.get("/usage")
def get_usage_history():
    connection = get_db_connection()

    try:
        rows = connection.execute(
            """
            SELECT
                uh.id,
                uh.product_id,
                p.name AS product_name,
                uh.quantity_used,
                uh.remaining_stock,
                uh.created_at
            FROM usage_history uh
            JOIN products p ON p.id = uh.product_id
            ORDER BY uh.id DESC
            """
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()
