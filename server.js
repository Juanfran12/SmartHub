const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = 3000;

// Base de datos
const db = new Database("smarthub.db");

// Crear tabla si no existe
db.prepare(`
CREATE TABLE IF NOT EXISTS movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    concepto TEXT NOT NULL,
    importe REAL NOT NULL,
    fecha TEXT NOT NULL
)
`).run();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Obtener movimientos
app.get("/api/movimientos", (req, res) => {
    const movimientos = db
        .prepare("SELECT * FROM movimientos ORDER BY fecha DESC, id DESC")
        .all();

    res.json(movimientos);
});

// Añadir movimiento
app.post("/api/movimientos", (req, res) => {

    const { tipo, concepto, importe, fecha } = req.body;

    db.prepare(`
        INSERT INTO movimientos (tipo, concepto, importe, fecha)
        VALUES (?, ?, ?, ?)
    `).run(tipo, concepto, importe, fecha);

    res.json({ ok: true });
});

// Eliminar movimiento
app.delete("/api/movimientos/:id", (req, res) => {

    db.prepare("DELETE FROM movimientos WHERE id = ?")
      .run(req.params.id);

    res.json({ ok: true });
});

// Dashboard
app.get("/api/dashboard", (req, res) => {

    const ingresos = db.prepare(`
        SELECT IFNULL(SUM(importe),0) total
        FROM movimientos
        WHERE tipo='ingreso'
    `).get().total;

    const gastos = db.prepare(`
        SELECT IFNULL(SUM(importe),0) total
        FROM movimientos
        WHERE tipo='gasto'
    `).get().total;

    res.json({
        ingresos,
        gastos,
        saldo: ingresos - gastos
    });

});

app.listen(PORT, () => {
    console.log(`🚀 SmartHub iniciado`);
    console.log(`👉 http://localhost:${PORT}`);
});
