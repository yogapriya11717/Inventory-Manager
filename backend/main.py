from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sqlite3


# ==========================================
# CREATE FASTAPI APPLICATION
# ==========================================

app = FastAPI(
    title="Inventory Manager API",
    description="Backend for the Inventory Manager project",
    version="1.0.0"
)


# ==========================================
# CORS CONFIGURATION
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# DATABASE CONNECTION
# ==========================================

def get_db_connection():

    connection = sqlite3.connect("inventory.db")

    connection.row_factory = sqlite3.Row

    # Enable foreign key constraints
    connection.execute("PRAGMA foreign_keys = ON")

    return connection


# ==========================================
# CREATE DATABASE TABLES
# ==========================================

def create_tables():

    connection = get_db_connection()

    try:

        # Products
        connection.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                quantity INTEGER NOT NULL CHECK(quantity >= 0),
                minimum_stock INTEGER NOT NULL CHECK(minimum_stock >= 0)
            )
        """)

        # Stock movement history
        connection.execute("""
            CREATE TABLE IF NOT EXISTS stock_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('IN', 'OUT')),
                quantity INTEGER NOT NULL CHECK(quantity > 0),
                balance INTEGER NOT NULL CHECK(balance >= 0),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id)
                    REFERENCES products(id)
                    ON DELETE CASCADE
            )
        """)

        # Usage history
        connection.execute("""
            CREATE TABLE IF NOT EXISTS usage_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                quantity_used INTEGER NOT NULL CHECK(quantity_used > 0),
                remaining_stock INTEGER NOT NULL CHECK(remaining_stock >= 0),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id)
                    REFERENCES products(id)
                    ON DELETE CASCADE
            )
        """)

        connection.commit()

    finally:
        connection.close()


# Create the tables when the application starts
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
        "message": "Inventory Manager Backend is running!"
    }


# ==========================================
# GET ALL PRODUCTS
# ==========================================

@app.get("/products")
def get_products():

    connection = get_db_connection()

    try:

        products = connection.execute(
            "SELECT * FROM products ORDER BY id"
        ).fetchall()

        return [dict(product) for product in products]

    finally:
        connection.close()


# ==========================================
# ADD PRODUCT
# ==========================================

@app.post("/products", status_code=201)
def add_product(product: Product):

    connection = get_db_connection()

    try:

        cursor = connection.execute(
            """
            INSERT INTO products
                (name, category, quantity, minimum_stock)
            VALUES (?, ?, ?, ?)
            """,
            (
                product.name.strip(),
                product.category.strip().lower(),
                product.quantity,
                product.minimum_stock
            )
        )

        connection.commit()

        product_id = cursor.lastrowid

        return {
            "message": "Product added successfully",
            "id": product_id
        }

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
            SET name = ?,
                category = ?,
                quantity = ?,
                minimum_stock = ?
            WHERE id = ?
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
            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        connection.commit()

        return {
            "message": "Product updated successfully",
            "id": product_id
        }

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
            "DELETE FROM products WHERE id = ?",
            (product_id,)
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        connection.commit()

        return {
            "message": "Product deleted successfully",
            "id": product_id
        }

    finally:
        connection.close()


# ==========================================
# STOCK IN
# ==========================================

@app.post("/stock/in")
def stock_in(stock: StockChange):

    connection = get_db_connection()

    try:

        # Find the product
        product = connection.execute(
            "SELECT * FROM products WHERE id = ?",
            (stock.product_id,)
        ).fetchone()

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        # Calculate the updated quantity
        new_quantity = product["quantity"] + stock.quantity

        # Update product stock
        connection.execute(
            """
            UPDATE products
            SET quantity = ?
            WHERE id = ?
            """,
            (new_quantity, stock.product_id)
        )

        # Record the stock movement
        connection.execute(
            """
            INSERT INTO stock_movements
                (product_id, type, quantity, balance)
            VALUES (?, 'IN', ?, ?)
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

    finally:
        connection.close()


# ==========================================
# STOCK OUT
# ==========================================

@app.post("/stock/out")
def stock_out(stock: StockChange):

    connection = get_db_connection()

    try:

        # Find the product
        product = connection.execute(
            "SELECT * FROM products WHERE id = ?",
            (stock.product_id,)
        ).fetchone()

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        current_quantity = product["quantity"]

        # Prevent stock from becoming negative
        if stock.quantity > current_quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Only {current_quantity} units are available"
            )

        # Calculate the remaining quantity
        new_quantity = current_quantity - stock.quantity

        # Update product stock
        connection.execute(
            """
            UPDATE products
            SET quantity = ?
            WHERE id = ?
            """,
            (new_quantity, stock.product_id)
        )

        # Record the stock movement
        connection.execute(
            """
            INSERT INTO stock_movements
                (product_id, type, quantity, balance)
            VALUES (?, 'OUT', ?, ?)
            """,
            (
                stock.product_id,
                stock.quantity,
                new_quantity
            )
        )

        # Record product usage
        connection.execute(
            """
            INSERT INTO usage_history
                (product_id, quantity_used, remaining_stock)
            VALUES (?, ?, ?)
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

    finally:
        connection.close()


# ==========================================
# GET STOCK MOVEMENT HISTORY
# ==========================================

@app.get("/stock/movements")
def get_stock_movements():

    connection = get_db_connection()

    try:

        movements = connection.execute(
            """
            SELECT
                stock_movements.id,
                stock_movements.product_id,
                products.name AS product_name,
                stock_movements.type,
                stock_movements.quantity,
                stock_movements.balance,
                stock_movements.created_at
            FROM stock_movements
            JOIN products
                ON products.id = stock_movements.product_id
            ORDER BY stock_movements.id DESC
            """
        ).fetchall()

        return [dict(movement) for movement in movements]

    finally:
        connection.close()


# ==========================================
# GET USAGE HISTORY
# ==========================================

@app.get("/usage")
def get_usage_history():

    connection = get_db_connection()

    try:

        usage_records = connection.execute(
            """
            SELECT
                usage_history.id,
                usage_history.product_id,
                products.name AS product_name,
                usage_history.quantity_used,
                usage_history.remaining_stock,
                usage_history.created_at
            FROM usage_history
            JOIN products
                ON products.id = usage_history.product_id
            ORDER BY usage_history.id DESC
            """
        ).fetchall()

        return [dict(record) for record in usage_records]

    finally:
        connection.close()