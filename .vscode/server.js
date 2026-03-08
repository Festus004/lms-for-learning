import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import generateCertificate from "./api/generate-certificate.js";

const app = express();

app.use(cors());
app.use(bodyParser.json());

// MAIN API ROUTE
app.post("/api/generate-certificate", generateCertificate);

app.listen(5000, () => console.log("Backend running on port 5000"));
