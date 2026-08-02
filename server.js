/**
 * =====================================================
 * SMARTHUB - MÓDULO DE BASE DE DATOS
 * =====================================================
 * Gestiona todas las operaciones con SQLite utilizando
 * better-sqlite3 para mejor rendimiento.
 * 
 * @author SmartHub Team
 * @version 1.0.0
 * =====================================================
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class SmartHubDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'smarthub.db');
        this.ensureDataDirectory();
        this.initDatabase();
    }

    /**
     * Asegura que existe el directorio de datos
     */
    ensureDataDirectory() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Inicializa la base de datos y crea las tablas
     */
    initDatabase() {
        this.db = new Database(this.dbPath);
        
        // Habilitar foreign keys
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        
        this.createTables();
        console.log('✅ Base de datos SQLite inicializada:', this.dbPath);
    }

    /**
     * Crea todas las tablas necesarias
     */
    createTables() {
        // Tabla de cuentas
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'bank',
                icon TEXT DEFAULT 'wallet',
                color TEXT DEFAULT '#0066ff',
                balance REAL DEFAULT 0,
                description TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabla de categorías
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                icon TEXT DEFAULT 'tag',
                color TEXT DEFAULT '#0066ff',
                budget REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabla de transacciones (ingresos y gastos)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                date TEXT NOT NULL,
                concept TEXT NOT NULL,
                category_id TEXT,
                amount REAL NOT NULL,
                account_id TEXT,
                payment_method TEXT,
                notes TEXT DEFAULT '',
                is_recurring INTEGER DEFAULT 0,
                recurring_frequency TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
            )
        `);

        // Tabla de objetivos de ahorro
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS goals (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                target_amount REAL NOT NULL,
                current_amount REAL DEFAULT 0,
                target_date TEXT,
                icon TEXT DEFAULT 'flag',
                color TEXT DEFAULT '#00d4ff',
                description TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabla de presupuestos
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS budgets (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL,
                amount REAL NOT NULL,
                period TEXT DEFAULT 'monthly',
                year INTEGER,
                month INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            )
        `);

        // Crear índices para mejorar rendimiento
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
            CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
            CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
            CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
        `);

        console.log('✅ Tablas creadas/verificadas correctamente');
    }

    // ============================================
    // MÉTODOS DE CUENTAS
    // ============================================

    getAllAccounts() {
        return this.db.prepare('SELECT * FROM accounts ORDER BY name').all();
    }

    getAccountById(id) {
        return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    }

    getAccountByName(name) {
        return this.db.prepare('SELECT * FROM accounts WHERE name = ?').get(name);
    }

    createAccount(accountData) {
        const stmt = this.db.prepare(`
            INSERT INTO accounts (id, name, type, icon, color, balance, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            accountData.id,
            accountData.name,
            accountData.type,
            accountData.icon,
            accountData.color,
            accountData.balance,
            accountData.description,
            accountData.createdAt,
            accountData.updatedAt
        );
        return this.getAccountById(accountData.id);
    }

    updateAccount(id, updateData) {
        const fields = [];
        const values = [];
        
        Object.keys(updateData).forEach(key => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            fields.push(`${dbKey} = ?`);
            values.push(updateData[key]);
        });
        
        values.push(id);
        this.db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return this.getAccountById(id);
    }

    deleteAccount(id) {
        this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    }

    updateAccountBalance(id, amount) {
        this.db.prepare('UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?')
            .run(amount, new Date().toISOString(), id);
    }

    getTotalBalance() {
        const result = this.db.prepare('SELECT COALESCE(SUM(balance), 0) as total FROM accounts').get();
        return result.total;
    }

    // ============================================
    // MÉTODOS DE CATEGORÍAS
    // ============================================

    getAllCategories(type = null) {
        if (type) {
            return this.db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name').all(type);
        }
        return this.db.prepare('SELECT * FROM categories ORDER BY type, name').all();
    }

    getCategoryById(id) {
        return this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    }

    getCategoryByName(name) {
        return this.db.prepare('SELECT * FROM categories WHERE name = ?').get(name);
    }

    createCategory(categoryData) {
        const stmt = this.db.prepare(`
            INSERT INTO categories (id, name, type, icon, color, budget, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            categoryData.id,
            categoryData.name,
            categoryData.type,
            categoryData.icon,
            categoryData.color,
            categoryData.budget,
            categoryData.createdAt
        );
        return this.getCategoryById(categoryData.id);
    }

    updateCategory(id, updateData) {
        const fields = [];
        const values = [];
        
        Object.keys(updateData).forEach(key => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            fields.push(`${dbKey} = ?`);
            values.push(updateData[key]);
        });
        
        values.push(id);
        this.db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return this.getCategoryById(id);
    }

    deleteCategory(id) {
        this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    }

    // ============================================
    // MÉTODOS DE TRANSACCIONES
    // ============================================

    getTransactions(filters = {}) {
        let sql = `
            SELECT t.*,
                   c.name as category_name, c.icon as category_icon, c.color as category_color,
                   a.name as account_name, a.icon as account_icon, a.color as account_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts a ON t.account_id = a.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.type) {
            sql += ' AND t.type = ?';
            params.push(filters.type);
        }
        if (filters.categoryId) {
            sql += ' AND t.category_id = ?';
            params.push(filters.categoryId);
        }
        if (filters.accountId) {
            sql += ' AND t.account_id = ?';
            params.push(filters.accountId);
        }
        if (filters.month) {
            sql += " AND strftime('%m', t.date) = ?";
            params.push(String(filters.month).padStart(2, '0'));
        }
        if (filters.year) {
            sql += " AND strftime('%Y', t.date) = ?";
            params.push(String(filters.year));
        }
        if (filters.startDate) {
            sql += ' AND t.date >= ?';
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            sql += ' AND t.date <= ?';
            params.push(filters.endDate);
        }
        if (filters.search) {
            sql += ' AND t.concept LIKE ?';
            params.push(`%${filters.search}%`);
        }

        sql += ' ORDER BY t.date DESC, t.created_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }
        if (filters.offset) {
            sql += ' OFFSET ?';
            params.push(filters.offset);
        }

        return this.db.prepare(sql).all(...params);
    }

    countTransactions(filters = {}) {
        let sql = 'SELECT COUNT(*) as count FROM transactions t WHERE 1=1';
        const params = [];

        if (filters.type) {
            sql += ' AND t.type = ?';
            params.push(filters.type);
        }
        if (filters.categoryId) {
            sql += ' AND t.category_id = ?';
            params.push(filters.categoryId);
        }
        if (filters.accountId) {
            sql += ' AND t.account_id = ?';
            params.push(filters.accountId);
        }
        if (filters.month) {
            sql += " AND strftime('%m', t.date) = ?";
            params.push(String(filters.month).padStart(2, '0'));
        }
        if (filters.year) {
            sql += " AND strftime('%Y', t.date) = ?";
            params.push(String(filters.year));
        }

        return this.db.prepare(sql).get(...params).count;
    }

    getTransactionById(id) {
        const sql = `
            SELECT t.*,
                   c.name as category_name, c.icon as category_icon, c.color as category_color,
                   a.name as account_name, a.icon as account_icon, a.color as account_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts a ON t.account_id = a.id
            WHERE t.id = ?
        `;
        return this.db.prepare(sql).get(id);
    }

    createTransaction(transactionData) {
        const stmt = this.db.prepare(`
            INSERT INTO transactions (
                id, type, date, concept, category_id, amount, account_id,
                payment_method, notes, is_recurring, recurring_frequency,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            transactionData.id,
            transactionData.type,
            transactionData.date,
            transactionData.concept,
            transactionData.categoryId,
            transactionData.amount,
            transactionData.accountId,
            transactionData.paymentMethod,
            transactionData.notes,
            transactionData.isRecurring,
            transactionData.recurringFrequency,
            transactionData.createdAt,
            transactionData.updatedAt
        );
        return this.getTransactionById(transactionData.id);
    }

    updateTransaction(id, updateData) {
        const allowedFields = ['type', 'date', 'concept', 'categoryId', 'amount', 'accountId', 
                               'paymentMethod', 'notes', 'isRecurring', 'recurringFrequency'];
        const fields = [];
        const values = [];
        
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
                fields.push(`${dbField} = ?`);
                values.push(updateData[field]);
            }
        });
        
        fields.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);
        
        this.db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return this.getTransactionById(id);
    }

    deleteTransaction(id) {
        this.db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    }

    duplicateTransaction(id) {
        const original = this.getTransactionById(id);
        if (!original) throw new Error('Transacción no encontrada');

        const newId = require('uuid').v4();
        const now = new Date().toISOString();
        
        this.db.prepare(`
            INSERT INTO transactions (
                id, type, date, concept, category_id, amount, account_id,
                payment_method, notes, is_recurring, recurring_frequency,
                created_at, updated_at
            ) SELECT ?, type, date, concept, category_id, amount, account_id,
                       payment_method, notes, 0, recurring_frequency, ?, ?
            FROM transactions WHERE id = ?
        `).run(newId, now, now, id);

        return this.getTransactionById(newId);
    }

    getRecentTransactions(limit = 10) {
        const sql = `
            SELECT t.*,
                   c.name as category_name, c.icon as category_icon, c.color as category_color,
                   a.name as account_name, a.icon as account_icon
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts a ON t.account_id = a.id
            ORDER BY t.created_at DESC
            LIMIT ?
        `;
        return this.db.prepare(sql).all(limit);
    }

    // ============================================
    // MÉTODOS ESTADÍSTICOS
    // ============================================

    getMonthlyIncome(month, year) {
        const sql = `
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE type = 'income'
              AND strftime('%m', date) = ?
              AND strftime('%Y', date) = ?
        `;
        const result = this.db.prepare(sql).get(
            String(month).padStart(2, '0'),
            String(year)
        );
        return result.total;
    }

    getMonthlyExpenses(month, year) {
        const sql = `
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE type = 'expense'
              AND strftime('%m', date) = ?
              AND strftime('%Y', date) = ?
        `;
        const result = this.db.prepare(sql).get(
            String(month).padStart(2, '0'),
            String(year)
        );
        return result.total;
    }

    getMonthlyBalance(month, year) {
        return this.getMonthlyIncome(month, year) - this.getMonthlyExpenses(month, year);
    }

    getYearlyBalance(year) {
        const sql = `
            SELECT 
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) -
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as balance
            FROM transactions
            WHERE strftime('%Y', date) = ?
        `;
        const result = this.db.prepare(sql).get(String(year));
        return result.balance || 0;
    }

    getExpensesByCategory(month, year) {
        let sql = `
            SELECT 
                c.id as category_id,
                c.name as category_name,
                c.icon as category_icon,
                c.color as category_color,
                c.budget,
                COALESCE(SUM(t.amount), 0) as total
            FROM categories c
            LEFT JOIN transactions t ON c.id = t.category_id
                AND t.type = 'expense'
        `;
        const params = [];

        if (month && year) {
            sql += " WHERE strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?";
            params.push(String(month).padStart(2, '0'), String(year));
        }

        sql += ' GROUP BY c.id ORDER BY total DESC';

        return this.db.prepare(sql).all(...params);
    }

    getIncomeByCategory(month, year) {
        let sql = `
            SELECT 
                c.id as category_id,
                c.name as category_name,
                c.icon as category_icon,
                c.color as category_color,
                COALESCE(SUM(t.amount), 0) as total
            FROM categories c
            LEFT JOIN transactions t ON c.id = t.category_id
                AND t.type = 'income'
        `;
        const params = [];

        if (month && year) {
            sql += " WHERE strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?";
            params.push(String(month).padStart(2, '0'), String(year));
        }

        sql += ' GROUP BY c.id ORDER BY total DESC';

        return this.db.prepare(sql).all(...params);
    }

    getLast12MonthsData() {
        const sql = `
            WITH months AS (
                SELECT 
                    strftime('%Y-%m', date) as month,
                    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
                FROM transactions
                WHERE date >= date('now', '-11 months')
                GROUP BY strftime('%Y-%m', date)
            )
            SELECT * FROM months ORDER BY month
        `;
        return this.db.prepare(sql).all();
    }

    getMonthlyEvolution(year) {
        const sql = `
            SELECT 
                strftime('%m', date) as month,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
            FROM transactions
            WHERE strftime('%Y', date) = ?
            GROUP BY strftime('%m', date)
            ORDER BY month
        `;
        return this.db.prepare(sql).all(String(year));
    }

    getMonthlyComparison(month, year) {
        const currentSql = `
            SELECT 
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
            FROM transactions
            WHERE strftime('%m', date) = ? AND strftime('%Y', date) = ?
        `;
        const current = this.db.prepare(currentSql).get(
            String(month).padStart(2, '0'),
            String(year)
        );

        // Mes anterior
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 1) {
            prevMonth = 12;
            prevYear--;
        }

        const prevSql = `
            SELECT 
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
            FROM transactions
            WHERE strftime('%m', date) = ? AND strftime('%Y', date) = ?
        `;
        const previous = this.db.prepare(prevSql).get(
            String(prevMonth).padStart(2, '0'),
            String(prevYear)
        );

        return { current, previous };
    }

    getYearlyComparison(year) {
        const currentSql = `
            SELECT 
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
            FROM transactions
            WHERE strftime('%Y', date) = ?
        `;
        const current = this.db.prepare(currentSql).get(String(year));

        const previous = this.db.prepare(currentSql).get(String(year - 1));

        return { current, previous };
    }

    getTopTransaction(type, month, year) {
        const sql = `
            SELECT t.*, c.name as category_name, a.name as account_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts a ON t.account_id = a.id
            WHERE t.type = ?
              AND strftime('%m', t.date) = ?
              AND strftime('%Y', t.date) = ?
            ORDER BY t.amount DESC
            LIMIT 1
        `;
        return this.db.prepare(sql).get(
            type,
            String(month).padStart(2, '0'),
            String(year)
        );
    }

    getMonthlyAverage(year) {
        const sql = `
            SELECT 
                AVG(income) as avg_income,
                AVG(expense) as avg_expense
            FROM (
                SELECT 
                    strftime('%m', date) as month,
                    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
                FROM transactions
                WHERE strftime('%Y', date) = ?
                GROUP BY strftime('%m', date)
            )
        `;
        return this.db.prepare(sql).all(String(year))[0] || { avg_income: 0, avg_expense: 0 };
    }

    // ============================================
    // MÉTODOS DE OBJETIVOS
    // ============================================

    getAllGoals() {
        return this.db.prepare('SELECT * FROM goals ORDER BY created_at DESC').all();
    }

    getGoalById(id) {
        return this.db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    }

    createGoal(goalData) {
        const stmt = this.db.prepare(`
            INSERT INTO goals (id, name, target_amount, current_amount, target_date, icon, color, description, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            goalData.id,
            goalData.name,
            goalData.targetAmount,
            goalData.currentAmount,
            goalData.targetDate,
            goalData.icon,
            goalData.color,
            goalData.description,
            goalData.isActive,
            goalData.createdAt,
            goalData.updatedAt
        );
        return this.getGoalById(goalData.id);
    }

    updateGoal(id, updateData) {
        const fields = [];
        const values = [];
        
        Object.keys(updateData).forEach(key => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            fields.push(`${dbKey} = ?`);
            values.push(updateData[key]);
        });
        
        values.push(id);
        this.db.prepare(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return this.getGoalById(id);
    }

    deleteGoal(id) {
        this.db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    }

    addFundsToGoal(id, amount) {
        this.db.prepare(`
            UPDATE goals 
            SET current_amount = current_amount + ?, updated_at = ? 
            WHERE id = ?
        `).run(amount, new Date().toISOString(), id);
        return this.getGoalById(id);
    }

    // ============================================
    // MÉTODOS DE CALENDARIO
    // ============================================

    getCalendarTransactions(year, month) {
        const sql = `
            SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
                   a.name as account_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts a ON t.account_id = a.id
            WHERE strftime('%Y', t.date) = ?
              AND strftime('%m', t.date) = ?
            ORDER BY t.date DESC
        `;
        return this.db.prepare(sql).all(
            String(year),
            String(month).padStart(2, '0')
        );
    }

    // ============================================
    // MÉTODOS DE BÚSQUEDA
    // ============================================

    searchTransactions(options = {}) {
        let sql = `
            SELECT t.*,
                   c.name as category_name, c.color as category_color,
                   a.name as account_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts a ON t.account_id = a.id
            WHERE 1=1
        `;
        const params = [];

        if (options.query) {
            sql += ' AND (t.concept LIKE ? OR t.notes LIKE ?)';
            const searchTerm = `%${options.query}%`;
            params.push(searchTerm, searchTerm);
        }
        if (options.type) {
            sql += ' AND t.type = ?';
            params.push(options.type);
        }
        if (options.category) {
            sql += ' AND t.category_id = ?';
            params.push(options.category);
        }
        if (options.account) {
            sql += ' AND t.account_id = ?';
            params.push(options.account);
        }
        if (options.startDate) {
            sql += ' AND t.date >= ?';
            params.push(options.startDate);
        }
        if (options.endDate) {
            sql += ' AND t.date <= ?';
            params.push(options.endDate);
        }
        if (options.minAmount) {
            sql += ' AND t.amount >= ?';
            params.push(parseFloat(options.minAmount));
        }
        if (options.maxAmount) {
            sql += ' AND t.amount <= ?';
            params.push(parseFloat(options.maxAmount));
        }

        sql += ' ORDER BY t.date DESC';
        return this.db.prepare(sql).all(...params);
    }

    // ============================================
    // MÉTODOS DE GASTOS RECURRENTES
    // ============================================

    getRecurringTransactionsDue() {
        const today = new Date().toISOString().split('T')[0];
        const sql = `
            SELECT * FROM transactions 
            WHERE is_recurring = 1 
            ORDER BY date DESC
            LIMIT 10
        `;
        return this.db.prepare(sql).all();
    }

    // ============================================
    // MÉTODOS UTILITARIOS
    // ============================================

    close() {
        this.db.close();
    }
}

module.exports = SmartHubDatabase;
