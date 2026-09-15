# 🌐 Social Connect

A modern, full-stack social media application built with a **NestJS** backend, **PostgreSQL** (Prisma ORM), **Cloudinary** media storage, and a cross-platform **Flutter** mobile client.

---

## ✨ Features

- 🔐 **Authentication & Security**: Secure JWT authentication with user registration, login, and session persistence.
- 📰 **Dynamic Feed**: Real-time sorted feed with author avatars, like status, like count, comment count, and relative timestamps.
- 📸 **Post Creation**: Create posts with titles, captions, and photos uploaded directly to Cloudinary from gallery or camera.
- 💬 **Interactive Comments & Likes**: Real-time like toggling and comments sheet with author deletion privileges.
- 👤 **Profiles & Customization**: User profile management with editable name, username, bio, and profile avatar upload.
- 👥 **Follow / Unfollow System**: Connect with other users, view follower/following lists, and explore other user profiles.
- 🔍 **User Search**: Instant user search by username or display name with debounce.
- 🔔 **Activity Notifications**: In-app notifications triggered by follows, likes, and comments with unread badges.
- 🌓 **Dark Mode / Light Mode**: Seamless dynamic theme switcher.

---

## 🏗️ Architecture & Tech Stack

### Backend
- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Media Storage**: [Cloudinary](https://cloudinary.com/) API
- **Containerization**: Docker & Docker Compose

### Mobile
- **Framework**: [Flutter](https://flutter.dev/) (Dart 3)
- **State Management**: Stateful widgets & `ValueNotifier`
- **Networking**: `http` package with multipart upload support
- **Persistence**: `shared_preferences`
- **Image Picker**: `image_picker`

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

### 4. Mobile Client Setup
```bash
cd mobile
flutter pub get
flutter run
```

---

## 📡 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register new user account |
| `POST` | `/auth/login` | Log in and receive JWT token |
| `GET` | `/users/me` | Fetch authenticated user profile & stats |
| `PATCH` | `/users/me` | Update name, username, bio, and avatar |
| `GET` | `/users/search?q=:query` | Search users by keyword |
| `GET` | `/users/:id` | View specific user profile |
| `POST` | `/users/:id/follow` | Toggle follow/unfollow status |
| `GET` | `/users/:id/followers` | Get user followers list |
| `GET` | `/users/:id/following` | Get user following list |
| `GET` | `/posts` | Get feed posts with like/comment counts |
| `POST` | `/posts` | Create new post with image upload |
| `PATCH` | `/posts/:id` | Update post title or content |
| `DELETE` | `/posts/:id` | Delete post (author only) |
| `POST` | `/likes/:postId` | Toggle like on post |
| `GET` | `/comments/:postId` | Get comments for a post |
| `POST` | `/comments/:postId` | Post a new comment |
| `DELETE` | `/comments/:id` | Delete comment (author only) |
| `GET` | `/notifications` | Get user notifications |
| `PATCH` | `/notifications/read-all` | Mark all notifications as read |

---

## 📄 License
This project is licensed under the MIT License.