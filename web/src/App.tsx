import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import CreatePost from "./pages/CreatePost";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Search from "./pages/Search";
import Activity from "./pages/Activity";
import Messages from "./pages/Messages";
import Connections from "./pages/Connections";
import PostDetail from "./pages/PostDetail";
import UsernameRedirect from "./pages/UsernameRedirect";
import Settings from "./pages/Settings";

import ProtectedRoute from "./components/ProtectedRoute";
import { subscribeToGlobalToast } from "./utils/toast";
// Loaded after every page stylesheet so its shared overrides win.
import "./enhancements.css";

function App() {
  const [globalToast, setGlobalToast] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = subscribeToGlobalToast((msg) => {
      setGlobalToast(msg);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setGlobalToast(null);
      }, 2500);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <CreatePost />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/user/:userId"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <Search />
            </ProtectedRoute>
          }
        />

        <Route
          path="/following"
          element={<ProtectedRoute><Connections /></ProtectedRoute>}
        />

        <Route
          path="/followers"
          element={<ProtectedRoute><Connections /></ProtectedRoute>}
        />

        <Route
          path="/user/:userId/following"
          element={<ProtectedRoute><Connections /></ProtectedRoute>}
        />

        <Route
          path="/user/:userId/followers"
          element={<ProtectedRoute><Connections /></ProtectedRoute>}
        />

        <Route
          path="/post/:postId"
          element={<ProtectedRoute><PostDetail /></ProtectedRoute>}
        />

        <Route
          path="/u/:username"
          element={<ProtectedRoute><UsernameRedirect /></ProtectedRoute>}
        />

        <Route
          path="/settings"
          element={<ProtectedRoute><Settings /></ProtectedRoute>}
        />

        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <Activity />
            </ProtectedRoute>
          }
        />

        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />

        <Route
          path="/messages/:userId"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <Navigate to="/" replace />
          }
        />

      </Routes>
      {globalToast && (
        <div className="global-app-toast" role="status" aria-live="polite">
          {globalToast}
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;