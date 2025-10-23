import app from "./app.js";
// import { connectDB } from "./config/database.js";
import "dotenv/config";

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // await connectDB();
    app.listen(PORT, () => {
      console.log(`Velosta backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Server failed:", err);
    process.exit(1);
  }
}

startServer();
