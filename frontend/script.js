// ==========================================
// API CONFIGURATION
// ==========================================

const API_BASE_URL = "http://127.0.0.1:8000";


// ==========================================
// HTML ELEMENTS
// ==========================================

const menuBtn = document.getElementById("menuBtn");
const sidebarMenuBtn = document.getElementById("sidebarMenuBtn");
const sidebar = document.querySelector(".sidebar");

const productTableBody = document.getElementById("productTableBody");
const productSearch = document.getElementById("productSearch");
const categoryFilter = document.getElementById("categoryFilter");

const addProductBtn = document.getElementById("addProductBtn");
const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const modalTitle = document.getElementById("modalTitle");
const submitProductBtn = document.getElementById("submitProductBtn");

const deleteModal = document.getElementById("deleteModal");
const deleteMessage = document.getElementById("deleteMessage");
const closeDeleteModalBtn = document.getElementById("closeDeleteModalBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

const stockInBtn = document.getElementById("stockInBtn");
const stockInModal = document.getElementById("stockInModal");
const stockInForm = document.getElementById("stockInForm");
const closeStockInBtn = document.getElementById("closeStockInBtn");
const cancelStockInBtn = document.getElementById("cancelStockInBtn");

const stockOutBtn = document.getElementById("stockOutBtn");
const stockOutModal = document.getElementById("stockOutModal");
const stockOutForm = document.getElementById("stockOutForm");
const closeStockOutBtn = document.getElementById("closeStockOutBtn");
const cancelStockOutBtn = document.getElementById("cancelStockOutBtn");

const usageProductFilter = document.getElementById("usageProductFilter");


// ==========================================
// APPLICATION DATA
// ==========================================

let products = [];
let stockMovements = [];
let usageRecords = [];

let editingProductId = null;
let deletingProductId = null;


// ==========================================
// API HELPER
// ==========================================

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);

    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        let message = data?.detail || data?.message;

        if (Array.isArray(message)) {
            message = message.map(item => item.msg).join(", ");
        }

        throw new Error(
            message || `Request failed with status ${response.status}`
        );
    }

    return data;
}


// ==========================================
// COMMON HELPERS
// ==========================================

function getStockStatus(quantity, minimumStock) {
    if (quantity === 0) {
        return {
            text: "Critical",
            className: "critical"
        };
    }

    if (quantity <= minimumStock) {
        return {
            text: "Low Stock",
            className: "low-stock"
        };
    }

    return {
        text: "In Stock",
        className: "in-stock"
    };
}


function formatCategory(category) {
    return String(category)
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}


function formatDate(timestamp) {
    if (!timestamp) {
        return "-";
    }

    // SQLite timestamps are stored as YYYY-MM-DD HH:MM:SS.
    const normalized = timestamp.includes("T")
        ? timestamp
        : timestamp.replace(" ", "T") + "Z";

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
    });
}


function getDateKey(timestamp) {
    if (!timestamp) {
        return "";
    }

    return String(timestamp).replace("T", " ").slice(0, 10);
}


function isToday(timestamp) {
    if (!timestamp) {
        return false;
    }

    const normalized = timestamp.includes("T")
        ? timestamp
        : timestamp.replace(" ", "T") + "Z";

    const date = new Date(normalized);

    return !Number.isNaN(date.getTime()) &&
        date.toDateString() === new Date().toDateString();
}


function appendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "";
    row.appendChild(cell);
    return cell;
}


function createStatusBadge(quantity, minimumStock) {
    const status = getStockStatus(quantity, minimumStock);

    const badge = document.createElement("span");
    badge.className = `status ${status.className}`;
    badge.textContent = status.text;

    return badge;
}


function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


// ==========================================
// HAMBURGER MENU
// ==========================================

function toggleSidebar() {
    if (sidebar) {
        sidebar.classList.toggle("open");
    }
}

if (menuBtn) {
    menuBtn.addEventListener("click", toggleSidebar);
}

if (sidebarMenuBtn) {
    sidebarMenuBtn.addEventListener("click", toggleSidebar);
}


// ==========================================
// PRODUCT TABLE RENDERING
// ==========================================

function renderProducts() {
    productTableBody.innerHTML = "";

    products.forEach(product => {
        const row = document.createElement("tr");

        // Keep the real database ID with the row.
        row.dataset.productId = product.id;
        row.dataset.minimumStock = product.minimum_stock;
        row.dataset.category = product.category;

        appendCell(row, product.name);
        appendCell(row, formatCategory(product.category));
        appendCell(row, product.quantity);

        const statusCell = document.createElement("td");

        statusCell.appendChild(
            createStatusBadge(
                product.quantity,
                product.minimum_stock
            )
        );

        row.appendChild(statusCell);

        const actionCell = document.createElement("td");
        const actionButtons = document.createElement("div");

        actionButtons.className = "action-buttons";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "edit-btn";
        editButton.textContent = "Edit";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-btn";
        deleteButton.textContent = "Delete";

        actionButtons.append(editButton, deleteButton);
        actionCell.appendChild(actionButtons);
        row.appendChild(actionCell);

        productTableBody.appendChild(row);
    });

    filterProducts();
}


// ==========================================
// UPDATE DASHBOARD
// ==========================================

function updateDashboard() {
    const totalProducts = products.length;

    const totalStock = products.reduce(
        (total, product) => total + product.quantity,
        0
    );

    const lowStock = products.filter(
        product => product.quantity <= product.minimum_stock
    ).length;

    setText("totalProducts", totalProducts);
    setText("totalStock", totalStock);
    setText("lowStockCount", lowStock);
    setText("restockCount", lowStock);

    setText("stockTotal", totalStock);
    setText("stockLowCount", lowStock);
}


// ==========================================
// CURRENT INVENTORY TABLE
// ==========================================

function updateCurrentInventory() {
    const inventoryBody =
        document.getElementById("currentInventoryBody");

    if (!inventoryBody) {
        return;
    }

    inventoryBody.innerHTML = "";

    products.forEach(product => {
        const row = document.createElement("tr");

        appendCell(row, product.name);
        appendCell(row, formatCategory(product.category));
        appendCell(row, product.quantity);

        const statusCell = document.createElement("td");

        statusCell.appendChild(
            createStatusBadge(
                product.quantity,
                product.minimum_stock
            )
        );

        row.appendChild(statusCell);
        inventoryBody.appendChild(row);
    });
}


// ==========================================
// STOCK IN / STOCK OUT DROPDOWNS
// ==========================================

function updateProductDropdowns() {
    const stockInProduct =
        document.getElementById("stockInProduct");

    const stockOutProduct =
        document.getElementById("stockOutProduct");

    [
        stockInProduct,
        stockOutProduct
    ].forEach(select => {
        if (!select) {
            return;
        }

        select.innerHTML =
            '<option value="">Select product</option>';

        products.forEach(product => {
            const option = document.createElement("option");

            // The API needs the database ID, not the product name.
            option.value = product.id;
            option.textContent = product.name;

            select.appendChild(option);
        });
    });
}


// ==========================================
// USAGE PRODUCT FILTER
// ==========================================

function updateUsageProductFilter() {
    if (!usageProductFilter) {
        return;
    }

    const previousValue = usageProductFilter.value;

    usageProductFilter.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Products";

    usageProductFilter.appendChild(allOption);

    products.forEach(product => {
        const option = document.createElement("option");

        option.value = product.id;
        option.textContent = product.name;

        usageProductFilter.appendChild(option);
    });

    const exists = Array.from(usageProductFilter.options)
        .some(option => option.value === previousValue);

    usageProductFilter.value = exists ? previousValue : "all";

    filterUsageHistory();
}


// ==========================================
// SEARCH AND CATEGORY FILTER
// ==========================================

function filterProducts() {
    if (!productTableBody || !productSearch || !categoryFilter) {
        return;
    }

    const searchText = productSearch.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value.toLowerCase();

    productTableBody.querySelectorAll("tr").forEach(row => {
        const productName = row.cells[0].textContent.toLowerCase();
        const productCategory = row.dataset.category ||
            row.cells[1].textContent.toLowerCase();

        const matchesSearch = productName.includes(searchText);

        const matchesCategory =
            selectedCategory === "all" ||
            productCategory === selectedCategory;

        row.style.display =
            matchesSearch && matchesCategory ? "" : "none";
    });
}

productSearch.addEventListener("input", filterProducts);
categoryFilter.addEventListener("change", filterProducts);


// ==========================================
// LOAD PRODUCTS FROM FASTAPI
// ==========================================

async function loadProductsFromBackend() {
    products = await apiRequest("/products");

    renderProducts();
    updateDashboard();
    updateCurrentInventory();
    updateProductDropdowns();
    updateUsageProductFilter();
}


// ==========================================
// ADD / EDIT PRODUCT MODAL
// ==========================================

function openProductModal() {
    editingProductId = null;

    productForm.reset();

    modalTitle.textContent = "Add New Product";
    submitProductBtn.textContent = "Add Product";

    productModal.classList.add("show");
}


function closeProductModal() {
    productModal.classList.remove("show");

    productForm.reset();

    editingProductId = null;

    modalTitle.textContent = "Add New Product";
    submitProductBtn.textContent = "Add Product";
}


addProductBtn.addEventListener("click", openProductModal);
closeModalBtn.addEventListener("click", closeProductModal);
cancelBtn.addEventListener("click", closeProductModal);


// ==========================================
// ADD / EDIT PRODUCT USING FASTAPI
// ==========================================

productForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name =
        document.getElementById("productName").value.trim();

    const category =
        document.getElementById("productCategory").value;

    const quantity =
        Number(document.getElementById("productQuantity").value);

    const minimumStock =
        Number(document.getElementById("minimumStock").value);

    if (!name || !category) {
        alert("Please enter the product name and category.");
        return;
    }

    const productData = {
        name: name,
        category: category,
        quantity: quantity,
        minimum_stock: minimumStock
    };

    const wasEditing = editingProductId !== null;

    const url = wasEditing
        ? `${API_BASE_URL}/products/${editingProductId}`
        : `${API_BASE_URL}/products`;

    const method = wasEditing ? "PUT" : "POST";

    try {
        const result = await apiRequest(url.replace(API_BASE_URL, ""), {
            method: method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(productData)
        });

        closeProductModal();

        await refreshAllData();

        alert(
            wasEditing
                ? "Product updated successfully!"
                : "Product added successfully!"
        );

    } catch (error) {
        console.error("Product save failed:", error);
        alert("Could not save product: " + error.message);
    }
});


// ==========================================
// EDIT PRODUCT BUTTON
// ==========================================

productTableBody.addEventListener("click", function (event) {
    if (!event.target.classList.contains("edit-btn")) {
        return;
    }

    const row = event.target.closest("tr");

    if (!row) {
        return;
    }

    editingProductId = Number(row.dataset.productId);

    const product = products.find(
        item => item.id === editingProductId
    );

    if (!product) {
        alert("Could not find this product in the database.");
        editingProductId = null;
        return;
    }

    document.getElementById("productName").value = product.name;
    document.getElementById("productCategory").value =
        product.category.toLowerCase();
    document.getElementById("productQuantity").value =
        product.quantity;
    document.getElementById("minimumStock").value =
        product.minimum_stock;

    modalTitle.textContent = "Edit Product";
    submitProductBtn.textContent = "Save Changes";

    productModal.classList.add("show");
});


// ==========================================
// DELETE PRODUCT
// ==========================================

productTableBody.addEventListener("click", function (event) {
    if (!event.target.classList.contains("delete-btn")) {
        return;
    }

    const row = event.target.closest("tr");

    if (!row) {
        return;
    }

    deletingProductId = Number(row.dataset.productId);

    const product = products.find(
        item => item.id === deletingProductId
    );

    if (!product) {
        alert("Could not find this product in the database.");
        deletingProductId = null;
        return;
    }

    deleteMessage.textContent =
        `Are you sure you want to delete "${product.name}"?`;

    deleteModal.classList.add("show");
});


function closeDeleteModal() {
    deleteModal.classList.remove("show");
    deletingProductId = null;
}

closeDeleteModalBtn.addEventListener("click", closeDeleteModal);
cancelDeleteBtn.addEventListener("click", closeDeleteModal);


confirmDeleteBtn.addEventListener("click", async function () {
    if (deletingProductId === null) {
        return;
    }

    const productId = deletingProductId;

    try {
        await apiRequest(`/products/${productId}`, {
            method: "DELETE"
        });

        closeDeleteModal();

        await refreshAllData();

        alert("Product deleted successfully!");

    } catch (error) {
        console.error("Product deletion failed:", error);
        alert("Could not delete product: " + error.message);
    }
});


// ==========================================
// OPEN / CLOSE STOCK MODALS
// ==========================================

stockInBtn.addEventListener("click", function () {
    updateProductDropdowns();
    stockInForm.reset();
    stockInModal.classList.add("show");
});

closeStockInBtn.addEventListener("click", function () {
    stockInModal.classList.remove("show");
});

cancelStockInBtn.addEventListener("click", function () {
    stockInModal.classList.remove("show");
});


stockOutBtn.addEventListener("click", function () {
    updateProductDropdowns();
    stockOutForm.reset();
    stockOutModal.classList.add("show");
});

closeStockOutBtn.addEventListener("click", function () {
    stockOutModal.classList.remove("show");
});

cancelStockOutBtn.addEventListener("click", function () {
    stockOutModal.classList.remove("show");
});


// ==========================================
// STOCK IN - SAVE TO DATABASE
// ==========================================

stockInForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const productId = Number(
        document.getElementById("stockInProduct").value
    );

    const quantity = Number(
        document.getElementById("stockInQuantity").value
    );

    if (!productId || quantity <= 0) {
        alert("Select a product and enter a positive quantity.");
        return;
    }

    try {
        const result = await apiRequest("/stock/in", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity
            })
        });

        stockInModal.classList.remove("show");
        stockInForm.reset();

        await refreshAllData();

        alert(result.message);

    } catch (error) {
        console.error("Stock In failed:", error);
        alert("Could not add stock: " + error.message);
    }
});


// ==========================================
// STOCK OUT - SAVE TO DATABASE
// ==========================================

stockOutForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const productId = Number(
        document.getElementById("stockOutProduct").value
    );

    const quantity = Number(
        document.getElementById("stockOutQuantity").value
    );

    if (!productId || quantity <= 0) {
        alert("Select a product and enter a positive quantity.");
        return;
    }

    try {
        const result = await apiRequest("/stock/out", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity
            })
        });

        stockOutModal.classList.remove("show");
        stockOutForm.reset();

        await refreshAllData();

        alert(result.message);

    } catch (error) {
        console.error("Stock Out failed:", error);
        alert("Could not remove stock: " + error.message);
    }
});


// ==========================================
// LOAD STOCK MOVEMENT HISTORY
// ==========================================

async function loadStockMovements() {
    stockMovements = await apiRequest("/stock/movements");

    const historyBody =
        document.getElementById("stockHistoryBody");

    historyBody.innerHTML = "";

    stockMovements.forEach(movement => {
        const row = document.createElement("tr");

        const movementType =
            movement.type === "IN" ? "Stock In" : "Stock Out";

        const signedQuantity =
            movement.type === "IN"
                ? `+${movement.quantity}`
                : `-${movement.quantity}`;

        appendCell(row, formatDate(movement.created_at));
        appendCell(row, movement.product_name);
        appendCell(row, movementType);
        appendCell(row, signedQuantity);
        appendCell(row, movement.balance);

        historyBody.appendChild(row);
    });

    const todaysMovements = stockMovements.filter(
        movement => isToday(movement.created_at)
    );

    const todayIn = todaysMovements
        .filter(movement => movement.type === "IN")
        .reduce((total, movement) => total + movement.quantity, 0);

    const todayOut = todaysMovements
        .filter(movement => movement.type === "OUT")
        .reduce((total, movement) => total + movement.quantity, 0);

    setText("stockInToday", todayIn);
    setText("stockOutToday", todayOut);
}


// ==========================================
// LOAD USAGE HISTORY
// ==========================================

async function loadUsageHistory() {
    usageRecords = await apiRequest("/usage");

    const usageBody =
        document.getElementById("usageHistoryBody");

    usageBody.innerHTML = "";

    usageRecords.forEach(record => {
        const row = document.createElement("tr");

        row.dataset.productId = record.product_id;
        row.dataset.date = getDateKey(record.created_at);

        appendCell(row, formatDate(record.created_at));
        appendCell(row, record.product_name);
        appendCell(row, record.quantity_used);
        appendCell(row, record.remaining_stock);

        usageBody.appendChild(row);
    });

    updateUsageProductFilter();
    updateUsageSummary();
    filterUsageHistory();
    updatePredictions();
}


// ==========================================
// USAGE SUMMARY
// ==========================================

function updateUsageSummary() {
    const totalUsage = usageRecords.reduce(
        (total, record) => total + record.quantity_used,
        0
    );

    const usageDates = new Set();
    const productsUsed = new Set();
    const productTotals = {};

    usageRecords.forEach(record => {
        usageDates.add(getDateKey(record.created_at));
        productsUsed.add(record.product_id);

        productTotals[record.product_name] =
            (productTotals[record.product_name] || 0) +
            record.quantity_used;
    });

    const averageUsage = usageDates.size > 0
        ? totalUsage / usageDates.size
        : 0;

    let mostUsedProduct = "-";
    let highestUsage = 0;

    Object.entries(productTotals).forEach(([name, quantity]) => {
        if (quantity > highestUsage) {
            highestUsage = quantity;
            mostUsedProduct = name;
        }
    });

    setText("totalUsage", totalUsage);
    setText("averageUsage", averageUsage.toFixed(1));
    setText("mostUsedProduct", mostUsedProduct);
    setText("trackedProducts", productsUsed.size);
}


// ==========================================
// FILTER USAGE HISTORY
// ==========================================

function filterUsageHistory() {
    if (!usageProductFilter) {
        return;
    }

    const selectedProduct = usageProductFilter.value;
    const usageBody =
        document.getElementById("usageHistoryBody");

    usageBody.querySelectorAll("tr").forEach(row => {
        const productId = row.dataset.productId;

        row.style.display =
            selectedProduct === "all" ||
            productId === selectedProduct
                ? ""
                : "none";
    });
}

usageProductFilter.addEventListener(
    "change",
    filterUsageHistory
);


// ==========================================
// RESTOCK PREDICTIONS
// ==========================================

function updatePredictions() {
    const predictionBody =
        document.getElementById("predictionBody");

    if (!predictionBody) {
        return;
    }

    predictionBody.innerHTML = "";

    const usageByProduct = {};

    usageRecords.forEach(record => {
        const id = record.product_id;

        if (!usageByProduct[id]) {
            usageByProduct[id] = {
                totalUsage: 0,
                dates: new Set()
            };
        }

        usageByProduct[id].totalUsage += record.quantity_used;
        usageByProduct[id].dates.add(
            getDateKey(record.created_at)
        );
    });

    let productsAtRisk = 0;
    let restockSoon = 0;
    let criticalProducts = 0;

    let totalDaysLeft = 0;
    let productsWithPrediction = 0;

    products.forEach(product => {
        const usage = usageByProduct[product.id];

        let averageDailyUsage = 0;
        let daysLeft = Infinity;

        if (usage && usage.dates.size > 0) {
            averageDailyUsage =
                usage.totalUsage / usage.dates.size;

            if (averageDailyUsage > 0) {
                daysLeft =
                    product.quantity / averageDailyUsage;
            }
        }

        let recommendation;
        let recommendationClass;

        if (product.quantity === 0) {
            recommendation = "Restock Now";
            recommendationClass = "prediction-critical";

            productsAtRisk++;
            criticalProducts++;

        } else if (daysLeft <= 3) {
            recommendation = "Restock Now";
            recommendationClass = "prediction-critical";

            productsAtRisk++;
            criticalProducts++;

        } else if (daysLeft <= 7) {
            recommendation = "Plan Restock";
            recommendationClass = "prediction-soon";

            productsAtRisk++;
            restockSoon++;

        } else if (daysLeft !== Infinity) {
            recommendation = "Stock Healthy";
            recommendationClass = "prediction-good";

        } else {
            recommendation = "Not Enough Data";
            recommendationClass = "prediction-unknown";
        }

        const row = document.createElement("tr");

        appendCell(row, product.name);
        appendCell(row, product.quantity);
        appendCell(row, averageDailyUsage.toFixed(1));

        appendCell(
            row,
            daysLeft === Infinity ? "-" : daysLeft.toFixed(1)
        );

        const recommendationCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className = `status ${recommendationClass}`;
        badge.textContent = recommendation;

        recommendationCell.appendChild(badge);
        row.appendChild(recommendationCell);

        predictionBody.appendChild(row);

        if (daysLeft !== Infinity && Number.isFinite(daysLeft)) {
            totalDaysLeft += daysLeft;
            productsWithPrediction++;
        }
    });

    const averageDaysLeft = productsWithPrediction > 0
        ? totalDaysLeft / productsWithPrediction
        : 0;

    setText("productsAtRisk", productsAtRisk);
    setText("restockSoon", restockSoon);
    setText("criticalProducts", criticalProducts);
    setText("averageDaysLeft", averageDaysLeft.toFixed(1));
}


// ==========================================
// REFRESH ALL DATA FROM BACKEND
// ==========================================

async function refreshAllData() {
    await loadProductsFromBackend();
    await loadStockMovements();
    await loadUsageHistory();
}


// ==========================================
// INITIALIZE APPLICATION
// ==========================================

async function initializeApp() {
    try {
        await refreshAllData();

        console.log("Inventory Manager connected to FastAPI.");
        console.log("Products loaded:", products);

    } catch (error) {
        console.error("Backend connection failed:", error);

        alert(
            "Could not load inventory data. Make sure FastAPI is running " +
            "at http://127.0.0.1:8000 and check the browser console."
        );
    }
}

initializeApp();