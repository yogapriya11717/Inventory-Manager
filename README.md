# 📦 Inventory Manager

A web-based inventory management system that helps users manage products, track stock movements, monitor product usage, and estimate when restocking may be needed.

## ✨ Features

### Product Management
- Add, edit, and delete products
- Search products by name
- Filter products by category
- Track current stock and minimum stock levels

### Stock Management
- Record Stock In and Stock Out operations
- View current inventory
- Maintain stock movement history
- Prevent stock from becoming negative

### Usage Tracking
- Automatically record usage when stock is removed
- View usage history and remaining quantities
- Filter usage records by product
- Calculate basic usage summaries

### Restock Predictions
- Estimate remaining days of stock using recorded usage
- Display basic restock recommendations

> Note: The current prediction feature uses simple rule-based calculations. It is not a machine-learning model.

## 🛠️ Technology Stack

**Frontend**
- HTML
- CSS
- JavaScript

**Backend**
- Python
- FastAPI
- Pydantic

**Database**
- SQLite

## 📁 Project Structure

```text
Inventory-manager/
├── backend/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── .gitignore
└── README.md
```

The frontend files may be in the project root instead of a `frontend/` folder, depending on your local organization.

## 🚀 Run the Project Locally

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Inventory-manager
```

### 2. Create and activate a virtual environment

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. Install backend dependencies

```powershell
python -m pip install -r backend/requirements.txt
```

### 4. Start the backend

```powershell
cd backend
fastapi dev main.py
```

The API runs locally at:

```text
http://127.0.0.1:8000
```

Open the interactive API documentation at:

```text
http://127.0.0.1:8000/docs
```

The SQLite database is created locally when the backend starts.

### 5. Start the frontend

Open the project in VS Code and launch `index.html` using the Live Server extension.

The local frontend is configured to communicate with the backend at:

```text
http://127.0.0.1:8000
```

Keep the backend running while using the frontend.

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Check backend status |
| GET | `/products` | Retrieve all products |
| POST | `/products` | Add a product |
| PUT | `/products/{product_id}` | Update a product |
| DELETE | `/products/{product_id}` | Delete a product |
| POST | `/stock/in` | Add stock |
| POST | `/stock/out` | Remove stock and record usage |
| GET | `/stock/movements` | Retrieve stock movement history |
| GET | `/usage` | Retrieve usage history |

## 🗄️ Database

The application uses SQLite with three main tables:

- `products` — product information and current stock
- `stock_movements` — records of stock additions and removals
- `usage_history` — records of product consumption

The local database file is excluded from Git. A fresh installation creates its own database, so existing inventory data must be added separately or imported.

## 🔮 Future Improvements

- More reliable demand forecasting
- Supplier and restocking lead-time tracking
- Safety stock calculations
- Improved reporting and analytics
- Automated testing
- Production deployment

## 👩‍💻 Development Status

The main frontend and backend functionality has been implemented and tested locally. Additional integration testing, deployment configuration, and production hardening remain part of the release process.

---

Built as a full-stack inventory management project.

