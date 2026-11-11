import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import ConfirmModal from "../components/ConfirmModal";
import UserAvatar from "../components/UserAvatar";
import api, { getErrorMessage } from "../api/api";
import { clearUnread, refreshUnreadCounts } from "../utils/unread";
import { showGlobalToast } from "../utils/toast";

interface Actor {
  id: number;
  username?: string | null;
  name?: string | null;
  profileImageUrl?: string | null;
}

interface Notification {
  id: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actorId?: number | null;
  postId?: number | null;
  actor?: Actor | null;
}

interface FollowRequest {
  id: number;
  requestedAt: string;
  user: Actor;
}

type Filter = "all" | "unread" | "requests" | "like" | "comment" | "mention" | "follow" | "message";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "requests", label: "Requests" },
  { key: "like", label: "Likes" },
  { key: "comment", label: "Comments" },
  { key: "mention", label: "Mentions" },
  { key: "follow", label: "Follows" },
  { key: "message", label: "Messages" },
];

const TYPE_META: Record<string, { icon: string; tone: string; label: string }> = {
  like: { icon: "♥", tone: "like", label: "Like" },
  repost: { icon: "↻", tone: "comment", label: "Repost" },
  comment: { icon: "💬", tone: "comment", label: "Comment" },
  mention: { icon: "@", tone: "mention", label: "Mention" },
  follow: { icon: "👤", tone: "follow", label: "New follower" },
  follow_request: { icon: "＋", tone: "follow", label: "Follow request" },
  follow_accept: { icon: "✓", tone: "follow", label: "Request accepted" },
  message: { icon: "✉", tone: "message", label: "Message" },
};

/** Which filter chip a notification type belongs to. */
const FILTER_OF: Record<string, Filter> = {
  like: "like",
  repost: "like",
  comment: "comment",
  mention: "mention",
  follow: "follow",
  follow_request: "follow",
  follow_accept: "follow",
  message: "message",
};

function timeAgo(dateString: string) {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function groupLabel(dateString: string) {
  const d = new Date(dateString);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  if (d >= startOfToday) return "Today";
  if (d.getTime() >= startOfToday.getTime() - dayMs) return "Yesterday";
  if (d.getTime() >= startOfToday.getTime() - 6 * dayMs) return "This week";
  return "Earlier";
}

/** Split "Name did something" into a bold actor and the rest, when possible. */
function splitActor(message: string) {
  const m =
    /^(.+?) (liked|commented|started following|sent you|requested|accepted|mentioned|reposted)(.*)$/.exec(
      message
    );
  if (!m) return { actor: "", rest: message };
  return { actor: m[1], rest: ` ${m[2]}${m[3]}` };
}

function Activity() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [handling, setHandling] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const filterParam = searchParams.get("tab") as Filter | null;
  const filter: Filter = FILTERS.some((f) => f.key === filterParam) ? (filterParam as Filter) : "all";
  const setFilter = (next: Filter) =>
    setSearchParams(next === "all" ? {} : { tab: next }, { replace: true });

  const loadNotifications = async () => {
    try {
      const [response, requestsRes] = await Promise.all([
        api.get("/notifications"),
        api.get("/follows/requests").catch(() => ({ data: [] })),
      ]);
      setError(null);
      const list: Notification[] = Array.isArray(response.data) ? response.data : [];
      setNotifications(list);
      setRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);

      // Opening Activity marks activity as seen (messages are handled by the
      // Messages page). Items stay highlighted until the next visit.
      const unreadTypes = new Set(
        list.filter((n) => !n.isRead && n.type !== "message").map((n) => n.type)
      );
      if (unreadTypes.size > 0) {
        clearUnread("activity");
        await Promise.all(
          [...unreadTypes].map((type) =>
            api.patch("/notifications/read-all", null, { params: { type } })
          )
        ).catch(() => {});
        void refreshUnreadCounts();
      }
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load your activity"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // State is only set after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();
  }, []);

  const markRead = async (notification: Notification) => {
    if (notification.isRead) return;
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
    );
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      void refreshUnreadCounts();
    } catch {
      /* non-critical */
    }
  };

  const openNotification = (n: Notification) => {
    void markRead(n);
    if (n.type === "message") {
      navigate(n.actorId ? `/messages/${n.actorId}` : "/messages");
    } else if (n.postId && ["like", "comment", "mention", "repost"].includes(n.type)) {
      navigate(`/post/${n.postId}`);
    } else if (n.type === "follow_request") {
      setFilter("requests");
    } else if (n.actorId) {
      navigate(`/user/${n.actorId}`);
    }
  };

  const respond = async (request: FollowRequest, action: "approve" | "decline") => {
    setHandling(request.user.id);
    try {
      await api.post(`/follows/requests/${request.user.id}/${action}`);
      setRequests((list) => list.filter((r) => r.user.id !== request.user.id));
      setNotifications((list) =>
        list.filter((n) => !(n.type === "follow_request" && n.actorId === request.user.id))
      );
      showGlobalToast(
        action === "approve"
          ? `@${request.user.username || "user"} can now see your posts`
          : "Request removed"
      );
      void refreshUnreadCounts();
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't update the request"));
    } finally {
      setHandling(null);
    }
  };

  const markAllRead = async () => {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    try {
      await api.patch("/notifications/read-all");
      clearUnread("activity");
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't mark as read"));
    }
  };

  const removeOne = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const previous = notifications;
    setNotifications((current) => current.filter((n) => n.id !== id));
    try {
      await api.delete(`/notifications/${id}`);
      void refreshUnreadCounts();
    } catch (err) {
      setNotifications(previous);
      showGlobalToast(getErrorMessage(err, "Couldn't remove notification"));
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      await api.delete("/notifications");
      setNotifications([]);
      clearUnread("activity");
      setConfirmClear(false);
      showGlobalToast("All notifications cleared");
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't clear notifications"));
    } finally {
      setClearing(false);
    }
  };

  // Pending requests are shown in their own section, not twice.
  const listed = useMemo(
    () => notifications.filter((n) => n.type !== "follow_request"),
    [notifications]
  );

  const filtered = listed.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.isRead;
    if (filter === "requests") return false;
    return FILTER_OF[n.type] === filter;
  });

  const groups = useMemo(() => {
    const order = ["Today", "Yesterday", "This week", "Earlier"];
    const map = new Map<string, Notification[]>();
    for (const n of filtered) {
      const label = groupLabel(n.createdAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(n);
    }
    return order.filter((l) => map.has(l)).map((l) => ({ label: l, items: map.get(l)! }));
  }, [filtered]);

  const unreadCount = listed.filter((n) => !n.isRead).length;
  const countFor = (key: Filter) =>
    key === "all"
      ? listed.length
      : key === "unread"
        ? unreadCount
        : key === "requests"
          ? requests.length
          : listed.filter((n) => FILTER_OF[n.type] === key).length;

  const showRequests = (filter === "all" || filter === "requests") && requests.length > 0;

  return (
    <>
      <Navbar />

      <main className="activity-page">
        <div className="activity-container">
          <div className="activity-header">
            <div>
              <p className="eyebrow">NOTIFICATIONS</p>
              <h1>Activity</h1>
            </div>
            <div className="sc-header-actions">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="mark-all-btn">
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={() => setConfirmClear(true)} className="mark-all-btn sc-danger-outline">
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="sc-chip-row" role="tablist" aria-label="Filter notifications">
            {FILTERS.filter((f) => f.key !== "requests" || requests.length > 0).map((f) => {
              const n = countFor(f.key);
              return (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  className={`sc-chip ${filter === f.key ? "active" : ""}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  {n > 0 && <span className="sc-chip-count">{n}</span>}
                </button>
              );
            })}
          </div>

          {showRequests && (
            <section className="sc-notif-group">
              <h2 className="sc-notif-group-title">Follow requests · {requests.length}</h2>
              <div className="notification-list">
                {requests.map((request) => (
                  <div className="notification-item sc-request-item" key={request.id}>
                    <UserAvatar
                      src={request.user.profileImageUrl}
                      name={request.user.username || request.user.name}
                      size={44}
                      onClick={() => navigate(`/user/${request.user.id}`)}
                    />
                    <div className="notification-content">
                      <p>
                        <strong>{request.user.username || "user"}</strong>
                        {request.user.name ? ` · ${request.user.name}` : ""}
                      </p>
                      <small>Requested {timeAgo(request.requestedAt)}</small>
                    </div>
                    <div className="sc-request-actions">
                      <button
                        className="sc-btn sc-btn-primary sc-btn-sm"
                        disabled={handling === request.user.id}
                        onClick={() => void respond(request, "approve")}
                      >
                        Confirm
                      </button>
                      <button
                        className="sc-btn sc-btn-ghost sc-btn-sm"
                        disabled={handling === request.user.id}
                        onClick={() => void respond(request, "decline")}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {loading ? (
            <div className="notification-list">
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="notification-item" key={i} aria-hidden="true">
                  <div className="sc-skel sc-skel-circle" style={{ width: 42, height: 42 }} />
                  <div style={{ flex: 1 }}>
                    <div className="sc-skel" style={{ width: "70%", height: 12, marginBottom: 7 }} />
                    <div className="sc-skel" style={{ width: "25%", height: 10 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="activity-empty">
              <div className="activity-empty-icon">⚠️</div>
              <h2>Something went wrong</h2>
              <p>{error}</p>
              <button
                className="sc-btn sc-btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  void loadNotifications();
                }}
              >
                Try again
              </button>
            </div>
          ) : filter === "requests" ? (
            requests.length === 0 && (
              <div className="activity-empty">
                <div className="activity-empty-icon">✓</div>
                <h2>No pending requests</h2>
                <p>When someone asks to follow your private account, it shows up here.</p>
              </div>
            )
          ) : filtered.length === 0 ? (
            !showRequests && (
              <div className="activity-empty">
                <div className="activity-empty-icon">{filter === "unread" ? "✓" : "♡"}</div>
                <h2>{filter === "unread" ? "You're all caught up" : "No activity yet"}</h2>
                <p>
                  {filter === "all"
                    ? "When people like, comment on, mention or follow you, you'll see it here."
                    : "Nothing here for this filter."}
                </p>
              </div>
            )
          ) : (
            groups.map((group) => (
              <section key={group.label} className="sc-notif-group">
                <h2 className="sc-notif-group-title">{group.label}</h2>
                <div className="notification-list">
                  {group.items.map((notification) => {
                    const meta = TYPE_META[notification.type] ?? { icon: "•", tone: "default", label: "Update" };
                    const { actor, rest } = splitActor(notification.message);
                    return (
                      <div
                        key={notification.id}
                        className={`notification-item ${notification.isRead ? "" : "unread"}`}
                        onClick={() => openNotification(notification)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && openNotification(notification)}
                      >
                        {notification.actor ? (
                          <div className="sc-notif-avatar">
                            <UserAvatar
                              src={notification.actor.profileImageUrl}
                              name={notification.actor.username || notification.actor.name}
                              size={44}
                            />
                            <span className={`sc-notif-badge sc-tone-${meta.tone}`} title={meta.label}>
                              {meta.icon}
                            </span>
                          </div>
                        ) : (
                          <div className={`notification-icon sc-tone-${meta.tone}`} title={meta.label}>
                            {meta.icon}
                          </div>
                        )}

                        <div className="notification-content">
                          <p>
                            {actor ? (
                              <>
                                <strong>{actor}</strong>
                                {rest}
                              </>
                            ) : (
                              notification.message
                            )}
                          </p>
                          <small title={new Date(notification.createdAt).toLocaleString()}>
                            {timeAgo(notification.createdAt)}
                          </small>
                        </div>

                        {!notification.isRead && <span className="unread-dot" />}
                        <button
                          className="sc-notif-remove"
                          onClick={(e) => void removeOne(e, notification.id)}
                          aria-label="Remove notification"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      <ConfirmModal
        isOpen={confirmClear}
        title="Clear all notifications?"
        message="This permanently removes every notification. This can't be undone."
        confirmText="Clear all"
        onConfirm={() => void clearAll()}
        onCancel={() => setConfirmClear(false)}
        isLoading={clearing}
      />

      <BottomNav />
    </>
  );
}

export default Activity;
