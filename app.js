// server.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"; // ✅ added
import { users } from "./Routes/UserRouter.js";
import { admin } from "./Routes/AdminRoutes.js";
import dotenv from 'dotenv'
dotenv.config();


const app = express();

app.use(cors({
  origin: "http://localhost:5173", // frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true // ✅ required for cookies
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // ✅ added here

app.use('/images', express.static('public/images'));

app.use("/user", users);
app.use("/admin", admin);

app.listen(process.env.PORT, () => {
  console.log("Server running on http://localhost:3000");
});
