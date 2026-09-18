import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import api from "../api/api";

interface User {
  id: number;
  username?: string;
  name?: string;
  profileImageUrl?: string;
}

interface Message {
  id: number;
  content: string;
  senderId: number;
  receiverId: number;
  createdAt: string;
}

function Messages() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();

  const [followingUsers, setFollowingUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load current user + following list
  const loadSidebar = async () => {
    try {
      const meRes = await api.get("/users/me");
      const me: User = meRes.data;
      setCurrentUserId(me.id);

      // Load people current user follows — API returns {id, username, name, profileImageUrl, followedAt}
      const followRes = await api.get(`/follows/following/${me.id}`);
      const followedUsers: User[] = (followRes.data || []).map((f: any) => ({
        id: f.id,
        username: f.username,
        name: f.name,
        profileImageUrl: f.profileImageUrl,
      }));
      setFollowingUsers(followedUsers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load selected user info
  const loadSelectedUser = async (id: number) => {
    try {
      const res = await api.get(`/users/${id}`);
      setSelectedUser(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load messages for current conversation
  const loadMessages = async (id: number) => {
    try {
      const res = await api.get(`/messages/${id}`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!userId || !message.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/messages/${userId}`, { content: message });
      setMessages((prev) => [...prev, res.data]);
      setMessage("");
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadSidebar();
  }, []);

  // When userId param changes, load that conversation
  useEffect(() => {
    if (userId) {
      loadSelectedUser(Number(userId));
      loadMessages(Number(userId));
    } else {
      setSelectedUser(null);
      setMessages([]);
    }
  }, [userId]);

  // Poll messages every 3s when a conversation is open
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => loadMessages(Number(userId)), 3000);
    return () => clearInterval(interval);
  }, [userId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      <Navbar />

      <main className="messages-page">
        <div className="messages-layout">

          {/* Sidebar: Following list */}
          <aside className="conversation-sidebar">
            <div className="messages-title">
              <h1>Messages</h1>
            </div>

            {loading ? (
              <div className="conversation-loading">Loading...</div>
            ) : followingUsers.length === 0 ? (
              <div className="conversation-empty">
                <span>💬</span>
                <p>Follow people to start messaging!</p>
              </div>
            ) : (
              followingUsers.map((u) => (
                <div
                  key={u.id}
                  className={`conversation-item ${userId === String(u.id) ? "selected" : ""}`}
                  onClick={() => navigate(`/messages/${u.id}`)}
                >
                  {u.profileImageUrl ? (
                    <img src={u.profileImageUrl} alt="" />
                  ) : (
                    <div className="conversation-avatar">
                      {(u.username || u.name || "U")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <strong>{u.username || u.name}</strong>
                    <p style={{ color: "#8e8e8e", fontSize: 13, margin: "3px 0 0" }}>
                      Tap to chat
                    </p>
                  </div>
                </div>
              ))
            )}
          </aside>

          {/* Chat section */}
          <section className="chat-section">
            {!userId || !selectedUser ? (
              <div className="no-chat">
                <div className="no-chat-icon">💬</div>
                <h2>Your Messages</h2>
                <p>Select someone from the list to start chatting.</p>
              </div>
            ) : (
              <>
                <header className="chat-header">
                  <button
                    className="chat-back"
                    onClick={() => navigate("/messages")}
                  >
                    ←
                  </button>

                  {selectedUser.profileImageUrl ? (
                    <img src={selectedUser.profileImageUrl} alt="" />
                  ) : (
                    <div className="chat-avatar">
                      {(selectedUser.username || "U")[0].toUpperCase()}
                    </div>
                  )}

                  <div>
                    <strong
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate(`/user/${selectedUser.id}`)}
                    >
                      {selectedUser.username || selectedUser.name}
                    </strong>
                    {selectedUser.name && (
                      <small>{selectedUser.name}</small>
                    )}
                  </div>
                </header>

                <div className="chat-messages">
                  {messages.length === 0 && (
                    <div style={{ textAlign: "center", color: "#8e8e8e", margin: "auto" }}>
                      <p>No messages yet. Say hi! 👋</p>
                    </div>
                  )}
                  {messages.map((item) => {
                    const mine = item.senderId === currentUserId;
                    return (
                      <div
                        key={item.id}
                        className={`message-row ${mine ? "mine" : "theirs"}`}
                      >
                        <div className="message-bubble">
                          <p>{item.content}</p>
                          <small>
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>

                <div className="message-input">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Message..."
                  />
                  <button onClick={sendMessage} disabled={!message.trim() || sending}>
                    {sending ? "..." : "Send"}
                  </button>
                </div>
              </>
            )}
          </section>

        </div>
      </main>

      <BottomNav />
    </>
  );
}

export default Messages;
