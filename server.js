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
import mongoose from "mongoose";

// Connect to MongoDB
mongoose.connect("mongodb+srv://Srf44334:srf44334@cluster0.gzdgh6a.mongodb.net/srf-backup", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected for periodic backup"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Define schemas
const donationSchema = new mongoose.Schema({
  name: String, email: String, phone: String,
  serviceDate: String, parcelName: String, parcelCount: String,
  date: String
}, { timestamps: true });

const volunteerSchema = new mongoose.Schema({
  name: String, email: String, phone: String,
  help: String, message: String, date: String
}, { timestamps: true });

const contactSchema = new mongoose.Schema({
  name: String, email: String, message: String,
  date: String
}, { timestamps: true });

const newsletterSchema = new mongoose.Schema({
  email: String, date: String
}, { timestamps: true });

// Define models
const Donation = mongoose.model("Donation", donationSchema);
const Volunteer = mongoose.model("Volunteer", volunteerSchema);
const Contact = mongoose.model("Contact", contactSchema);
const Newsletter = mongoose.model("Newsletter", newsletterSchema);

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
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content || "[]");
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
}
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
  const donationsFile = DONATIONS_FILE;
const volunteerFile = VOLUNTEER_FILE;
const contactFile = CONTACT_FILE;
const newsletterFile = NEWSLETTER_FILE;
  res.json({ donations, volunteer, newsletter, contact });
});

// ----------------------------------------------------------
// START
// ----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Data stored in: ${DATA_DIR}`);
});
// === AUTO BACKUP TO MONGODB EVERY 5 MINUTES ===

function arraysEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function syncToMongoDB() {
  try {
    // Donations
    const donationsRaw = readJSON(donationsFile);
    for (const entry of donationsRaw) {
      const exists = await Donation.findOne({ email: entry.email, date: entry.date });
      if (!exists) await Donation.create(entry);
    }

    // Volunteers
    const volunteersRaw = readJSON(volunteerFile);
    for (const entry of volunteersRaw) {
      const exists = await Volunteer.findOne({ email: entry.email, date: entry.date });
      if (!exists) await Volunteer.create(entry);
    }

    // Contacts
    const contactsRaw = readJSON(contactFile);
    for (const entry of contactsRaw) {
      const exists = await Contact.findOne({ email: entry.email, date: entry.date });
      if (!exists) await Contact.create(entry);
    }

    // Newsletters
    const newsletterRaw = readJSON(newsletterFile);
    for (const entry of newsletterRaw) {
      const email = typeof entry === "string" ? entry : entry.email;
      const exists = await Newsletter.findOne({ email });
      if (!exists) await Newsletter.create({ email, date: new Date().toISOString() });
    }

    console.log("✅ Synced local JSON files to MongoDB.");
  } catch (err) {
    console.error("❌ Error syncing to MongoDB:", err);
  }
}

// Run every 5 minutes
setInterval(syncToMongoDB, 5 * 60 * 1000);
