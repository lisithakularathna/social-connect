# Social Connect Mobile

Flutter mobile client for the Social Connect project.

## Features

- JWT login and registration
- Google sign-in
- Home feed
- Create posts with gallery/camera images
- Likes and comments
- User search
- Profiles and follow/unfollow
- Followers/following lists
- Activity notifications
- Dark/light theme
- Direct messages and chat
- Responsive Android/iOS Flutter UI

## Run

From the repository root:

```bash
cd mobile
flutter pub get
flutter run
```

## API URL

The app uses the existing NestJS backend.

### Android emulator

The default API URL is:

```
http://10.0.2.2:3000
```

This maps Android Emulator traffic to the host computer's localhost.

### Physical Android phone

Use the computer's LAN IPv4 address:

```bash
flutter run --dart-define=API_BASE_URL=http://YOUR_PC_IP:3000
```

Example:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3000
```

The phone and computer must be on the same Wi-Fi/LAN, and the backend must be running on port 3000.

## Backend

Start the backend before running the app:

```bash
cd backend
npm install
npm run start:dev
```
