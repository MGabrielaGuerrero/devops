import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import "./App.css";

const URL_API = "http://internal-BackendALB-648775989.us-east-1.elb.amazonaws.com/";

interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

const initialTask = {
  title: "",
  description: "",
  completed: false,
};

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<Omit<Task, "id">>(initialTask);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${URL_API}/tasks`);
      setTasks(response.data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked =
      type === "checkbox"
        ? (e as ChangeEvent<HTMLInputElement>).target.checked
        : null;
    setNewTask({
      ...newTask,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${URL_API}/tasks`, newTask);
      setNewTask(initialTask);
      fetchTasks();
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${URL_API}/tasks/${id}`);
      fetchTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  return (
    <div className="app">
      <div className="task-form-container">
        <h1>Task Manager</h1>
        <form onSubmit={handleSubmit} className="task-form">
          <input
            type="text"
            name="title"
            value={newTask.title}
            onChange={handleChange}
            placeholder="Title"
            required
          />
          <textarea
            name="description"
            value={newTask.description}
            onChange={handleChange}
            placeholder="Description"
          />
          <label>
            Completed:
            <input
              type="checkbox"
              name="completed"
              checked={newTask.completed}
              onChange={handleChange}
            />
          </label>
          <button type="submit">Add Task</button>
        </form>
      </div>
      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.completed ? "completed" : ""}>
            <h2>{task.title}</h2>
            <p>{task.description}</p>
            <p>{task.completed ? "Completed" : "Not Completed"}</p>
            <button onClick={() => handleDelete(task.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default App;
