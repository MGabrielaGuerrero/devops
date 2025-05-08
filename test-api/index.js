const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const {sequelize, Task}  = require("./sequelize/models");
const app = express();
const PORT = 4000;

app.use(bodyParser.json());

app.use(cors());

app.get("/", async (req, res) => {
  try {
    res.json({ message: "Hello World!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/tasks", async (req, res) => {
  try {
    const tasks = await Task.findAll();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/tasks", async (req, res) => {
  try {
    const { title, description, completed } = req.body;
    const task = await Task.create({ title, description, completed });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Task.destroy({ where: { id } });
    if (result) {
      res.status(200).json({ message: "Task deleted successfully" });
    } else {
      res.status(404).json({ message: "Task not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simulación de carga
// Esta ruta simula una carga de CPU durante 10 segundos
app.get("/load", (req, res) => {
  const start = Date.now();
  while (Date.now() - start < 10000) {
    Math.random(); // Simula carga
  }
  res.send("Carga simulada por 10s");
});



sequelize
  .sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Unable to connect to the database:", error);
  });
