/**
 * Sagar Ratan Foundation Backend
 * ---------------------------------------------------------
 * Features:
 *  - Donation submissions + count
 *  - Volunteer submissions (with "help" field)
 *  - Newsletter subscriptions (deduped)
 *  - Contact form submissions
 *  - Admin data aggregation endpoint (with login)
 *  - Serves static frontend from ./public
 *  - Stores ALL JSON data in ./data/*.json (auto-creates folder)
 */

import express from "express";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";

// ----------------------------------------------------------
// Path setup (ESM-friendly __dirname)
// ----------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Data files
const DONATIONS_FILE = path.join(DATA_DIR, "donations.json");
const VOLUNTEER_FILE = path.join(DATA_DIR, "volunteerForms.json");
const NEWSLETTER_FILE = path.join(DATA_DIR, "newsletter.json");
const CONTACT_FILE = path.join(DATA_DIR, "contactForms.json");

// Ensure JSON files exist
function ensureFile(file, initialData) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(initialData, null, 2));
  }
}
ensureFile(DONATIONS_FILE, []);
ensureFile(VOLUNTEER_FILE, []);
ensureFile(NEWSLETTER_FILE, []);
ensureFile(CONTACT_FILE, []);

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
function safeReadJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return fallback;
  }
}

function safeWriteJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

function pushEntry(file, entryObj) {
  const data = safeReadJSON(file, []);
  data.push(entryObj);
  safeWriteJSON(file, data);
  return data.length; // return new count
}

// ----------------------------------------------------------
// App + Middleware
// ----------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ----------------------------------------------------------
// DONATION ROUTES
// ----------------------------------------------------------
app.post("/api/donate", (req, res) => {
  const { name, email, phone, parcelName, parcelCount, totalAmount } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ message: "Name, email, and phone are required." });
  }
  const countNum = parseInt(parcelCount, 10) || 1;
  const totalNum = parseInt(totalAmount, 10) || countNum * 75;

  const entry = {
    name,
    email,
    phone,
    parcelName: parcelName || "",
    parcelCount: countNum,
    totalAmount: totalNum,
    date: new Date().toISOString()
  };
  const newCount = pushEntry(DONATIONS_FILE, entry);
  return res.json({ message: "Donation submitted successfully!", count: newCount });
});

app.get("/api/donate/count", (req, res) => {
  const donations = safeReadJSON(DONATIONS_FILE, []);
  res.json({ count: donations.length });
});

// ----------------------------------------------------------
// VOLUNTEER ROUTES
// ----------------------------------------------------------
app.post("/api/volunteer", (req, res) => {
  const { name, email, phone, help, message } = req.body;
  if (!name || !email || !phone || !help) {
    return res.status(400).json({
      message: "Name, email, phone, and how you want to help are required."
    });
  }
  const entry = { name, email, phone, help, message: message || "", date: new Date().toISOString() };
  pushEntry(VOLUNTEER_FILE, entry);
  return res.json({ message: "Volunteer form submitted successfully!" });
});

// ----------------------------------------------------------
// NEWSLETTER ROUTE
// ----------------------------------------------------------
app.post("/api/newsletter", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });

  const list = safeReadJSON(NEWSLETTER_FILE, []);
  const lower = email.trim().toLowerCase();
  const exists = list.some((e) => (typeof e === "string" ? e.toLowerCase() === lower : e.email?.toLowerCase() === lower));

  if (!exists) {
    list.push(email.trim());
    safeWriteJSON(NEWSLETTER_FILE, list);
  }
  return res.json({ message: "Subscribed successfully!" });
});

// ----------------------------------------------------------
// CONTACT ROUTE
// ----------------------------------------------------------
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required." });
  }
  const entry = { name, email, message, date: new Date().toISOString() };
  pushEntry(CONTACT_FILE, entry);
  return res.json({ message: "Contact form submitted successfully!" });
});

// ----------------------------------------------------------
// ADMIN LOGIN + DATA
// ----------------------------------------------------------
const ADMIN_ID = "A@b@c";
const ADMIN_PASS = "A@b@c";

app.post("/admin/login", (req, res) => {
  const { id, password } = req.body;
  if (id === ADMIN_ID && password === ADMIN_PASS) {
    return res.json({ success: true, message: "Login successful" });
  }
  return res.status(401).json({ success: false, message: "Invalid ID or password" });
});

app.get("/admin/data", (req, res) => {
  const donations = safeReadJSON(DONATIONS_FILE, []);
  const volunteer = safeReadJSON(VOLUNTEER_FILE, []);
  const newsletter = safeReadJSON(NEWSLETTER_FILE, []);
  const contact = safeReadJSON(CONTACT_FILE, []);
  res.json({ donations, volunteer, newsletter, contact });
});

// ----------------------------------------------------------
// START
// ----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Data stored in: ${DATA_DIR}`);
});