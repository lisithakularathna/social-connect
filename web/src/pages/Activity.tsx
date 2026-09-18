import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import api from "../api/api";

interface Notification {
  id: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function Activity() {
  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [loading, setLoading] =
    useState(true);

  const loadNotifications = async () => {
    try {
      const response =
        await api.get("/notifications");

      setNotifications(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (
    notification: Notification
  ) => {
    if (notification.isRead) return;

    try {
      await api.patch(
        `/notifications/${notification.id}/read`
      );

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, isRead: true }
            : item
        )
      );
    } catch (error) {
      console.error(error);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch(
        "/notifications/read-all"
      );

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
        }))
      );
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  return (
    <>
      <Navbar />

      <main className="activity-page">
        <div className="activity-container">
          <div className="activity-header">
            <h1>Activity</h1>

            {notifications.some(
              (n) => !n.isRead
            ) && (
              <button
                onClick={markAllRead}
                className="mark-all-btn"
              >
                Mark all as read
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading">
              Loading activity...
            </div>
          ) : notifications.length === 0 ? (
            <div className="activity-empty">
              <div className="activity-empty-icon">
                ♡
              </div>

              <h2>No activity yet</h2>

              <p>
                When people interact with you,
                you'll see it here.
              </p>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map(
                (notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${
                      notification.isRead
                        ? ""
                        : "unread"
                    }`}
                    onClick={() =>
                      markRead(notification)
                    }
                  >
                    <div className="notification-icon">
                      {notification.type ===
                      "follow"
                        ? "👤"
                        : notification.type ===
                            "message"
                          ? "💬"
                          : "♡"}
                    </div>

                    <div className="notification-content">
                      <p>
                        {notification.message}
                      </p>

                      <small>
                        {new Date(
                          notification.createdAt
                        ).toLocaleString()}
                      </small>
                    </div>

                    {!notification.isRead && (
                      <span className="unread-dot" />
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  );
}

export default Activity;
