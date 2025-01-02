import express from "express";
import dotenv from "dotenv";
import connectDB from "./database/connectDB.js";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import crypto from "crypto";
import telegramRoutes from "./routes/telegramRoutes.js";

dotenv.config();


const dbUrl = process.env.DB_URL;

connectDB(dbUrl);
const app = express();
app.use(express.json());
app.use(bodyParser.json());
const port = process.env.PORT || 4000;



app.use(telegramRoutes);

app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
