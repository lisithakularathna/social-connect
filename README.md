# 🌐 Social Connect

A modern, full-stack social media application built with a **NestJS** backend, **PostgreSQL** (Prisma ORM), **Cloudinary** media storage, and features both a **React** web application and a cross-platform **Flutter** mobile client.

---

## ✨ Features

- 🔐 **Authentication & Security**: Secure JWT authentication with user registration, login, and session persistence.
- 📰 **Dynamic Feed**: Real-time sorted feed with author avatars, like status, like count, comment count, and relative timestamps.
- 📸 **Post Creation**: Create posts with titles, captions, and photos uploaded directly to Cloudinary. Also supports post deletion and editing!
- 💬 **Interactive Comments & Likes**: Real-time like toggling and comments sheet with author deletion privileges.
- ✉️ **Direct Messaging**: 1-to-1 real-time direct messaging between users with read status and unread badges.
- 👤 **Profiles & Customization**: User profile management with editable name, username, bio, and profile avatar upload.
- 👥 **Follow / Unfollow System**: Connect with other users, view follower/following lists, and explore other user profiles.
- 🔍 **User Search**: Instant user search by username or display name with debounce.
- 🔔 **Activity Notifications**: In-app notifications triggered by follows, likes, and comments with unread badges.
- 🌓 **Dark Mode / Light Mode**: Seamless dynamic theme switcher for mobile and polished responsive design for web.

---

## 🏗️ Architecture & Tech Stack

### ⚙️ Backend
- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Media Storage**: [Cloudinary](https://cloudinary.com/) API
- **Containerization**: Docker & Docker Compose

### 💻 Web Client (New!)
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Routing**: React Router
- **Networking**: Axios
- **Styling**: Vanilla CSS with modern responsive design

### 📱 Mobile Client
- **Framework**: [Flutter](https://flutter.dev/) (Dart 3)
- **State Management**: Stateful widgets & `ValueNotifier`
- **Networking**: `http` package with multipart upload support
- **Persistence**: `shared_preferences`

---

## 🚀 Getting Started

### 1. Prerequisites
- Docker & Docker Compose
- Node.js (v18+)
- Flutter SDK (v3.19+)

### 2. Database Setup
```bash
docker-compose up -d
```

### 3. Backend Setup
```bash
cd backend
npm install
npm run start:dev
```
Backend will start on `http://localhost:3000`.

### 4. Web Client Setup
```bash
cd web
npm install
npm run dev
```
Web client will start on `http://localhost:5173`.

### 5. Mobile Client Setup
```bash
cd mobile
flutter pub get
flutter run
```

---

## 📡 API Overview (Key Endpoints)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register new user account |
| `POST` | `/auth/login` | Log in and receive JWT token |
| `GET` | `/users/me` | Fetch authenticated user profile & stats |
| `GET` | `/users/search?q=:query` | Search users by keyword |
| `POST` | `/users/:id/follow` | Toggle follow/unfollow status |
| `GET` | `/posts?page=1&limit=10` | Get paginated feed posts |
| `POST` | `/posts` | Create new post |
| `PATCH`| `/posts/:id` | Update post content |
| `DELETE`| `/posts/:id` | Delete post |
| `POST` | `/likes/:postId` | Toggle like on post |
| `GET` | `/comments/:postId` | Get comments for a post |
| `GET` | `/messages/:userId` | Get chat history with user |
| `POST` | `/messages/:userId` | Send a direct message |
| `GET` | `/notifications` | Get user notifications |

---

## 📄 License
This project is licensed under the MIT License.