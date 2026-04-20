# 🏨 Hostel Management Backend

A modern, production-ready REST API for managing hostel operations — built with **Node.js**, **Express**, and **MongoDB**.

---

## 🚀 Features

- **Authentication & Authorization** — JWT-based auth with secure cookie sessions
- **File Uploads** — Multer + Cloudinary integration for image handling
- **Email Notifications** — Nodemailer for transactional emails
- **Job Queues** — Bull + Redis for background task processing
- **Caching** — Redis-backed caching layer
- **Security** — Helmet, CORS, rate limiting, XSS protection, HPP, Mongo sanitization
- **Logging** — Winston structured logging
- **Validation** — express-validator for request validation
- **Process Management** — PM2 ecosystem config for production deployment

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Database | MongoDB (Mongoose 8) |
| Cache / Queue | Redis, Bull |
| Auth | JWT, bcryptjs |
| Storage | Cloudinary |
| Email | Nodemailer |
| Logging | Winston |
| Process Manager | PM2 |

---

## 📁 Project Structure

```
hostel-backend/
├── config/          # DB, Redis, Cloudinary and other config
├── controllers/     # Route handler logic
├── middlewares/     # Auth, error handling, rate limiting, etc.
├── models/          # Mongoose schemas/models
├── routes/          # Express route definitions
├── services/        # Business logic / service layer
├── utils/           # Helper utilities and seed scripts
├── validators/      # express-validator rule sets
├── app.js           # Express app setup
├── server.js        # HTTP server entry point
└── ecosystem.config.js  # PM2 deployment config
```

---

## ⚙️ Getting Started

### Prerequisites

- Node.js `>= 18.0.0`
- npm `>= 9.0.0`
- MongoDB instance (local or Atlas)
- Redis instance

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/sukhpreetsingh1205/Hostel-backend.git
cd Hostel-backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/hostel_db

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://localhost:6379

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (Nodemailer)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password

# Session
SESSION_SECRET=your_session_secret
```

---

## 🏃 Running the App

```bash
# Development (with hot-reload via nodemon)
npm run dev

# Production
npm start
```

### PM2 (Production Process Manager)

```bash
npm run pm2:start      # Start with PM2
npm run pm2:stop       # Stop all processes
npm run pm2:restart    # Restart all processes
npm run pm2:logs       # View logs
```

---

## 🧪 Development Scripts

```bash
npm run seed      # Seed the database with sample data
npm run lint      # Run ESLint
npm run format    # Format code with Prettier
npm run test      # Run Jest test suite
npm run build     # Lint + test (CI check)
```

---

## 🔒 Security

This API includes the following security hardening out of the box:

- **Helmet** — HTTP security headers
- **express-rate-limit** — Brute-force protection
- **express-mongo-sanitize** — NoSQL injection prevention
- **xss-clean** — Cross-site scripting sanitization
- **hpp** — HTTP parameter pollution prevention
- **CORS** — Configurable cross-origin resource sharing

---

## 📄 License

This project is open source. Feel free to use and modify it.

---

## 👤 Author

**Sukhpreet Singh**  
GitHub: [@sukhpreetsingh1205](https://github.com/sukhpreetsingh1205)
