import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import ConfirmModal from "../components/ConfirmModal";
import api from "../api/api";
import {
  initUserE2EE,
  getConversationCryptoKey,
  encryptE2EEMessage,
  decryptE2EEMessage,
  isEncryptedMessage,
} from "../utils/e2ee";
import "./Messages.css";

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
  isEdited?: boolean;
  isEncrypted?: boolean;
}

interface ConversationItem {
  user: User;
  lastMessage?: {
    id: number;
    content: string;
    senderId: number;
    createdAt: string;
  };
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return "now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatDateDivider(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

const POPULAR_EMOJIS = ["👋", "❤️", "😂", "🔥", "👍", "✨", "🎉", "🙌", "💯", "😊"];

function Messages() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [pinnedUserIds, setPinnedUserIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loadingSidebar, setLoadingSidebar] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Message Context Menu state (down arrow inside bubble)
  const [activeDropdownMsgId, setActiveDropdownMsgId] = useState<number | null>(null);

  // Pinned message state (per chat)
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);

  // Edit message state
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editedMessageIds, setEditedMessageIds] = useState<number[]>([]);

  // Delete message confirmation
  const [deleteConfirmMsgId, setDeleteConfirmMsgId] = useState<number | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load pinned conversations from localStorage
  const loadPinnedChats = () => {
    try {
      const raw = localStorage.getItem("pinned_chats");
      if (raw) {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) setPinnedUserIds(ids);
      }
    } catch {
      setPinnedUserIds([]);
    }
  };

  // Toggle pin conversation
  const togglePinUser = (targetUserId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let updated: number[];
    if (pinnedUserIds.includes(targetUserId)) {
      updated = pinnedUserIds.filter((id) => id !== targetUserId);
    } else {
      updated = [targetUserId, ...pinnedUserIds];
    }
    setPinnedUserIds(updated);
    localStorage.setItem("pinned_chats", JSON.stringify(updated));
  };

  // Load pinned message for current chat
  const loadPinnedMessage = (chatUserId: number) => {
    try {
      const raw = localStorage.getItem(`pinned_msg_${chatUserId}`);
      if (raw) {
        setPinnedMessage(JSON.parse(raw));
      } else {
        setPinnedMessage(null);
      }
    } catch {
      setPinnedMessage(null);
    }
  };

  // Toggle pin a specific message
  const togglePinMessage = (msg: Message) => {
    if (!userId) return;
    setActiveDropdownMsgId(null);
    if (pinnedMessage?.id === msg.id) {
      // Unpin
      setPinnedMessage(null);
      localStorage.removeItem(`pinned_msg_${userId}`);
    } else {
      // Pin
      setPinnedMessage(msg);
      localStorage.setItem(`pinned_msg_${userId}`, JSON.stringify(msg));
    }
  };

  // Scroll to pinned message
  const scrollToPinnedMessage = () => {
    if (!pinnedMessage) return;
    const el = document.getElementById(`msg-${pinnedMessage.id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMsgId(pinnedMessage.id);
      setTimeout(() => setHighlightedMsgId(null), 1800);
    }
  };

  // Load edited messages tracking
  const loadEditedMessageIds = () => {
    try {
      const raw = localStorage.getItem("edited_messages");
      if (raw) {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) setEditedMessageIds(ids);
      }
    } catch {
      setEditedMessageIds([]);
    }
  };

  const markMessageAsEdited = (msgId: number) => {
    const updated = Array.from(new Set([...editedMessageIds, msgId]));
    setEditedMessageIds(updated);
    localStorage.setItem("edited_messages", JSON.stringify(updated));
  };

  // Load conversations + followed users
  const loadSidebar = async () => {
    try {
      setLoadingSidebar(true);
      const meRes = await api.get("/users/me");
      const me: User = meRes.data;
      setCurrentUserId(me.id);

      // Proactively initialize E2EE keypair and upload public key
      try {
        await initUserE2EE(me.id);
      } catch (e) {
        console.error("E2EE init error:", e);
      }

      // 1. Fetch conversations from backend
      let convItems: ConversationItem[] = [];
      try {
        const convRes = await api.get("/messages/conversations");
        if (Array.isArray(convRes.data)) {
          convItems = await Promise.all(
            convRes.data.map(async (item: any) => {
              let previewContent = item.lastMessage?.content;
              if (previewContent && isEncryptedMessage(previewContent)) {
                try {
                  const key = await getConversationCryptoKey(me.id, item.user.id);
                  previewContent = await decryptE2EEMessage(previewContent, key);
                } catch {
                  previewContent = "🔒 Encrypted message";
                }
              }
              return {
                user: item.user,
                lastMessage: item.lastMessage
                  ? { ...item.lastMessage, content: previewContent }
                  : undefined,
              };
            })
          );
        }
      } catch (e) {
        console.error("Conversations fetch error:", e);
      }

      // 2. Fetch following list
      try {
        const followRes = await api.get(`/follows/following/${me.id}`);
        const followedUsers: User[] = (followRes.data || []).map((f: any) => ({
          id: f.id,
          username: f.username,
          name: f.name,
          profileImageUrl: f.profileImageUrl,
        }));

        // Add followed users not yet in conversations
        const existingIds = new Set(convItems.map((c) => c.user.id));
        for (const u of followedUsers) {
          if (!existingIds.has(u.id)) {
            convItems.push({
              user: u,
              lastMessage: {
                id: 0,
                content: "Tap to chat",
                senderId: 0,
                createdAt: "",
              },
            });
          }
        }
      } catch (e) {
        console.error("Follows fetch error:", e);
      }

      setConversations(convItems);
    } catch (err) {
      console.error("Failed to load sidebar:", err);
    } finally {
      setLoadingSidebar(false);
    }
  };

  // Load selected user details
  const loadSelectedUser = async (id: number) => {
    try {
      setLoadingChat(true);
      const res = await api.get(`/users/${id}`);
      setSelectedUser(res.data);

      // Ensure active user exists in conversation sidebar
      setConversations((prev) => {
        if (!prev.some((c) => c.user.id === id)) {
          return [
            {
              user: res.data,
              lastMessage: {
                id: 0,
                content: "Started conversation",
                senderId: 0,
                createdAt: new Date().toISOString(),
              },
            },
            ...prev,
          ];
        }
        return prev;
      });
    } catch (err) {
      console.error("Failed to load user info:", err);
    } finally {
      setLoadingChat(false);
    }
  };

  // Load messages for selected user
  const loadMessages = async (id: number, isInitial = false) => {
    try {
      const res = await api.get(`/messages/${id}`);
      const list = Array.isArray(res.data) ? res.data : [];

      let myId = currentUserId;
      if (!myId) {
        try {
          const meRes = await api.get("/users/me");
          myId = meRes.data?.id;
          if (myId) {
            setCurrentUserId(myId);
            await initUserE2EE(myId);
          }
        } catch {}
      }

      let cryptoKey: CryptoKey | null = null;
      if (myId) {
        try {
          cryptoKey = await getConversationCryptoKey(myId, id);
        } catch (e) {
          console.error("Failed to get crypto key:", e);
        }
      }

      // Deduplicate messages by ID and decrypt E2EE messages
      const seen = new Set<number>();
      const decryptedList: Message[] = [];

      for (const m of list) {
        if (m.id && seen.has(m.id)) continue;
        if (m.id) seen.add(m.id);

        const isEncrypted = isEncryptedMessage(m.content);
        let decryptedContent = m.content;
        if (isEncrypted && cryptoKey) {
          decryptedContent = await decryptE2EEMessage(m.content, cryptoKey);
        }

        decryptedList.push({
          ...m,
          content: decryptedContent,
          isEncrypted,
        });
      }

      setMessages(decryptedList);

      if (isInitial) {
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: "auto" });
        }, 60);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessages([]);
    }
  };

  // Send or Edit message
  const handleSendOrEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = message.trim();
    if (!userId || !content || sending) return;

    // Handle Edit Mode
    if (editingMessage) {
      setSending(true);
      try {
        let payloadContent = content;
        if (currentUserId && userId) {
          try {
            const key = await getConversationCryptoKey(currentUserId, Number(userId));
            payloadContent = await encryptE2EEMessage(content, key);
          } catch (e) {
            console.error("Encryption error during edit:", e);
          }
        }

        await api.patch(`/messages/message/${editingMessage.id}`, { content: payloadContent });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessage.id ? { ...m, content, isEdited: true, isEncrypted: true } : m
          )
        );
        markMessageAsEdited(editingMessage.id);

        if (pinnedMessage?.id === editingMessage.id) {
          const updatedPinned = { ...pinnedMessage, content, isEdited: true, isEncrypted: true };
          setPinnedMessage(updatedPinned);
          localStorage.setItem(`pinned_msg_${userId}`, JSON.stringify(updatedPinned));
        }

        setEditingMessage(null);
        setMessage("");

        // Update last message in sidebar if this was the last message
        setConversations((prev) =>
          prev.map((c) =>
            c.user.id === Number(userId) && c.lastMessage?.id === editingMessage.id
              ? { ...c, lastMessage: { ...c.lastMessage, content } }
              : c
          )
        );
      } catch (err: any) {
        alert(err.response?.data?.message || "Failed to update message.");
      } finally {
        setSending(false);
      }
      return;
    }

    // Normal Send
    setSending(true);
    try {
      let payloadContent = content;
      if (currentUserId && userId) {
        try {
          const key = await getConversationCryptoKey(currentUserId, Number(userId));
          payloadContent = await encryptE2EEMessage(content, key);
        } catch (e) {
          console.error("Encryption error during send:", e);
        }
      }

      const res = await api.post(`/messages/${userId}`, { content: payloadContent });
      const newMsg = res.data;

      const readableMsg: Message = {
        ...newMsg,
        content: content,
        isEncrypted: isEncryptedMessage(newMsg.content),
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === readableMsg.id)) return prev;
        return [...prev, readableMsg];
      });
      setMessage("");
      setShowEmojiPicker(false);

      // Update last message in sidebar
      setConversations((prev) => {
        return prev.map((c) => {
          if (c.user.id === Number(userId)) {
            return {
              ...c,
              lastMessage: {
                id: newMsg.id,
                content: content,
                senderId: newMsg.senderId,
                createdAt: newMsg.createdAt,
              },
            };
          }
          return c;
        });
      });

      // Smooth scroll to bottom
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);

      inputRef.current?.focus();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // Start editing a message
  const startEditing = (msg: Message) => {
    setActiveDropdownMsgId(null);
    setEditingMessage(msg);
    setMessage(msg.content);
    inputRef.current?.focus();
  };

  // Cancel edit mode
  const cancelEditing = () => {
    setEditingMessage(null);
    setMessage("");
  };

  // Delete message execution
  const executeDeleteMessage = async () => {
    if (deleteConfirmMsgId === null) return;
    const msgId = deleteConfirmMsgId;
    setDeleteConfirmMsgId(null);

    // Optimistically remove from state immediately
    setMessages((prev) => prev.filter((m) => m.id !== msgId));

    if (pinnedMessage?.id === msgId) {
      setPinnedMessage(null);
      if (userId) localStorage.removeItem(`pinned_msg_${userId}`);
    }

    try {
      setIsDeletingMessage(true);
      await api.delete(`/messages/message/${msgId}`);

      // Refresh sidebar last message
      setConversations((prev) =>
        prev.map((c) => {
          if (c.user.id === Number(userId) && c.lastMessage?.id === msgId) {
            return {
              ...c,
              lastMessage: {
                id: 0,
                content: "Message deleted",
                senderId: 0,
                createdAt: new Date().toISOString(),
              },
            };
          }
          return c;
        })
      );
    } catch (err: any) {
      console.error("Delete error:", err);
      // Fallback reload if needed
      if (userId) loadMessages(Number(userId));
    } finally {
      setIsDeletingMessage(false);
    }
  };

  // Copy message text
  const copyMessageText = (text: string) => {
    setActiveDropdownMsgId(null);
    navigator.clipboard.writeText(text);
  };

  // Initial load
  useEffect(() => {
    loadPinnedChats();
    loadEditedMessageIds();
    loadSidebar();
  }, []);

  // When route userId changes
  useEffect(() => {
    cancelEditing();
    setActiveDropdownMsgId(null);
    if (userId) {
      const targetId = Number(userId);
      loadSelectedUser(targetId);
      loadMessages(targetId, true);
      loadPinnedMessage(targetId);
    } else {
      setSelectedUser(null);
      setMessages([]);
      setPinnedMessage(null);
    }
  }, [userId]);

  // Polling for new messages every 3s
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      loadMessages(Number(userId), false);
    }, 3000);
    return () => clearInterval(interval);
  }, [userId]);

  // Filter conversations with search query and sort pinned to TOP
  const filteredConversations = conversations
    .filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        (c.user.username && c.user.username.toLowerCase().includes(q)) ||
        (c.user.name && c.user.name.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const aPinned = pinnedUserIds.includes(a.user.id) ? 1 : 0;
      const bPinned = pinnedUserIds.includes(b.user.id) ? 1 : 0;
      return bPinned - aPinned;
    });

  return (
    <>
      <Navbar />

      <main className="messages-page">
        <div className={`messages-layout ${userId ? "chat-active" : ""}`}>
          {/* ── Sidebar: Conversations & Contacts ── */}
          <aside className="conversation-sidebar">
            <div className="messages-title-bar">
              <div>
                <p className="messages-eyebrow">DIRECT MESSAGES</p>
                <h1>Messages</h1>
              </div>
            </div>

            {/* Search Filter */}
            <div className="messages-search-bar">
              <div className="messages-search-input-wrap">
                <span>🔍</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Conversations List with Pinned items on top */}
            <div className="conversations-scroll-list">
              {loadingSidebar ? (
                <div className="conversation-loading">Loading conversations...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="conversation-empty">
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>💬</div>
                  {searchQuery ? (
                    <p>No contacts match "{searchQuery}"</p>
                  ) : (
                    <p>Follow users or start chatting to see them here.</p>
                  )}
                </div>
              ) : (
                filteredConversations.map((item) => {
                  const isSelected = userId === String(item.user.id);
                  const isPinned = pinnedUserIds.includes(item.user.id);

                  return (
                    <div
                      key={item.user.id}
                      className={`conversation-item ${isSelected ? "selected" : ""} ${
                        isPinned ? "pinned" : ""
                      }`}
                      onClick={() => navigate(`/messages/${item.user.id}`)}
                    >
                      <div className="conv-avatar-wrap">
                        <div className="conv-avatar">
                          {item.user.profileImageUrl ? (
                            <img
                              src={item.user.profileImageUrl}
                              alt={item.user.username || "User"}
                            />
                          ) : (
                            (item.user.username || item.user.name || "U")[0].toUpperCase()
                          )}
                        </div>
                        <div className="conv-online-dot" />
                      </div>

                      <div className="conv-info">
                        <div className="conv-header-row">
                          <div className="conv-name-wrap">
                            <span className="conv-name">
                              {item.user.username || item.user.name || "User"}
                            </span>
                            {isPinned && (
                              <span className="conv-pin-indicator" title="Pinned chat">
                                📌
                              </span>
                            )}
                          </div>
                          {item.lastMessage?.createdAt && (
                            <span className="conv-time">
                              {formatRelativeTime(item.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="conv-last-msg">
                          {item.lastMessage?.content || "Tap to chat"}
                        </p>
                      </div>

                      {/* Quick Pin / Unpin Button on Hover */}
                      <button
                        className="conv-pin-action-btn"
                        onClick={(e) => togglePinUser(item.user.id, e)}
                        title={isPinned ? "Unpin chat" : "Pin chat to top"}
                      >
                        {isPinned ? "✕" : "📌"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* ── Chat Section (Right Panel) ── */}
          <section className="chat-section">
            {!userId ? (
              <div className="no-chat-state">
                <div className="no-chat-icon-circle">
                  <svg
                    viewBox="0 0 24 24"
                    width="32"
                    height="32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h2>Your Messages</h2>
                <p>
                  Select a contact from the list or pin your favorites to quickly chat with
                  them.
                </p>
              </div>
            ) : loadingChat && !selectedUser ? (
              <div className="no-chat-state">
                <p>Loading conversation...</p>
              </div>
            ) : selectedUser ? (
              <>
                {/* Chat Header */}
                <header className="chat-header">
                  <button
                    className="chat-back-btn"
                    onClick={() => navigate("/messages")}
                    title="Back to messages"
                  >
                    ←
                  </button>

                  <div
                    className="chat-header-avatar"
                    onClick={() => navigate(`/user/${selectedUser.id}`)}
                  >
                    {selectedUser.profileImageUrl ? (
                      <img
                        src={selectedUser.profileImageUrl}
                        alt={selectedUser.username || "User"}
                      />
                    ) : (
                      (selectedUser.username || "U")[0].toUpperCase()
                    )}
                  </div>

                  <div className="chat-header-user-info">
                    <div
                      className="chat-header-name"
                      onClick={() => navigate(`/user/${selectedUser.id}`)}
                    >
                      {selectedUser.username || selectedUser.name || "User"}
                    </div>
                    <div className="chat-header-status">
                      <span className="status-dot" />
                      <span>Active now</span>
                    </div>
                  </div>

                  <div className="chat-header-actions">
                    <div className="e2ee-header-indicator" title="Messages in this chat are end-to-end encrypted">
                      <span className="e2ee-indicator-icon">🔒</span>
                      <span className="e2ee-indicator-text">E2EE Protected</span>
                    </div>
                    <button
                      className="chat-profile-btn"
                      onClick={() => navigate(`/user/${selectedUser.id}`)}
                    >
                      Profile
                    </button>
                  </div>
                </header>

                {/* ── Top Pinned Message Banner (WhatsApp/Telegram style) ── */}
                {pinnedMessage && (
                  <div
                    className="pinned-message-banner"
                    onClick={scrollToPinnedMessage}
                    title="Click to jump to pinned message"
                  >
                    <span className="pinned-icon">📌</span>
                    <div className="pinned-info">
                      <span className="pinned-label">Pinned Message</span>
                      <span className="pinned-snippet">{pinnedMessage.content}</span>
                    </div>
                    <button
                      className="unpin-msg-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinMessage(pinnedMessage);
                      }}
                      title="Unpin message"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* ── Chat Messages Scroll View ── */}
                <div className="chat-messages" ref={chatContainerRef}>
                  {/* End-to-end encryption system badge */}
                  <div className="e2ee-system-banner">
                    <div className="e2ee-system-badge">
                      <span className="e2ee-banner-lock">🔒</span>
                      <span>Messages are end-to-end encrypted. Nobody outside of this chat can read them.</span>
                    </div>
                  </div>

                  {/* Backdrop for closing active message dropdown */}
                  {activeDropdownMsgId !== null && (
                    <div
                      className="message-dropdown-backdrop"
                      onClick={() => setActiveDropdownMsgId(null)}
                    />
                  )}

                  {messages.length === 0 ? (
                    <div className="chat-empty-greeting">
                      <div className="chat-empty-avatar">
                        {selectedUser.profileImageUrl ? (
                          <img
                            src={selectedUser.profileImageUrl}
                            alt={selectedUser.username || "User"}
                          />
                        ) : (
                          (selectedUser.username || "U")[0].toUpperCase()
                        )}
                      </div>
                      <h3>Say hi to {selectedUser.username || "your friend"}! 👋</h3>
                      <p>Send a message to break the ice and start talking.</p>

                      <div className="quick-prompts">
                        <button
                          className="quick-prompt-btn"
                          onClick={() => handleSendOrEdit()}
                        >
                          👋 Hi!
                        </button>
                        <button
                          className="quick-prompt-btn"
                          onClick={() => {
                            setMessage("Hey there! How's it going?");
                            inputRef.current?.focus();
                          }}
                        >
                          Hey there! How's it going?
                        </button>
                      </div>
                    </div>
                  ) : (
                    messages.map((item, index) => {
                      const mine = item.senderId === currentUserId;
                      const prevMsg = messages[index - 1];

                      // Show date divider if date changed
                      const currentDateStr = new Date(item.createdAt).toDateString();
                      const prevDateStr = prevMsg
                        ? new Date(prevMsg.createdAt).toDateString()
                        : null;
                      const showDateDivider = currentDateStr !== prevDateStr;

                      const isEdited =
                        item.isEdited || editedMessageIds.includes(item.id);
                      const isDropdownOpen = activeDropdownMsgId === item.id;
                      const isThisPinned = pinnedMessage?.id === item.id;
                      const isHighlighted = highlightedMsgId === item.id;

                      return (
                        <div key={item.id} style={{ display: "contents" }}>
                          {showDateDivider && (
                            <div className="chat-date-divider">
                              <span className="chat-date-pill">
                                {formatDateDivider(item.createdAt)}
                              </span>
                            </div>
                          )}

                          <div
                            id={`msg-${item.id}`}
                            className={`message-row ${mine ? "mine" : "theirs"} ${
                              isHighlighted ? "pinned-highlight" : ""
                            }`}
                          >
                            {!mine && (
                              <div
                                className="message-sender-avatar"
                                onClick={() => navigate(`/user/${selectedUser.id}`)}
                                title={selectedUser.username}
                              >
                                {selectedUser.profileImageUrl ? (
                                  <img
                                    src={selectedUser.profileImageUrl}
                                    alt=""
                                  />
                                ) : (
                                  (selectedUser.username || "U")[0].toUpperCase()
                                )}
                              </div>
                            )}

                            {/* Message Bubble */}
                            <div className="message-bubble">
                              <div className="message-text-row">
                                <p>{item.content}</p>

                                {/* ── WhatsApp-style Small Down Arrow (⌄) inside Bubble ── */}
                                <button
                                  type="button"
                                  className={`message-down-arrow-btn ${
                                    isDropdownOpen ? "active" : ""
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownMsgId(
                                      isDropdownOpen ? null : item.id
                                    );
                                  }}
                                  title="Message options"
                                >
                                  <svg
                                    viewBox="0 0 20 20"
                                    width="14"
                                    height="14"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </button>
                              </div>

                              {/* ── Dropdown Context Menu for Message ── */}
                              {isDropdownOpen && (
                                <div
                                  className="message-dropdown-menu"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    className="msg-dropdown-item"
                                    onClick={() => togglePinMessage(item)}
                                  >
                                    <span>📌</span>
                                    <span>{isThisPinned ? "Unpin Message" : "Pin Message"}</span>
                                  </button>

                                  {mine && (
                                    <button
                                      className="msg-dropdown-item"
                                      onClick={() => startEditing(item)}
                                    >
                                      <span>✏️</span>
                                      <span>Edit Message</span>
                                    </button>
                                  )}

                                  <button
                                    className="msg-dropdown-item"
                                    onClick={() => copyMessageText(item.content)}
                                  >
                                    <span>📋</span>
                                    <span>Copy Text</span>
                                  </button>

                                  {mine && (
                                    <button
                                      className="msg-dropdown-item delete"
                                      onClick={() => {
                                        setActiveDropdownMsgId(null);
                                        setDeleteConfirmMsgId(item.id);
                                      }}
                                    >
                                      <span>🗑️</span>
                                      <span>Delete Message</span>
                                    </button>
                                  )}
                                </div>
                              )}

                              <div className="message-meta">
                                {item.isEncrypted && (
                                  <span className="e2ee-lock-badge" title="End-to-end encrypted message">
                                    🔒
                                  </span>
                                )}

                                {isThisPinned && (
                                  <span className="pinned-badge-mini" title="Pinned message">
                                    📌
                                  </span>
                                )}

                                {isEdited && (
                                  <span className="edited-badge">edited</span>
                                )}

                                <span className="time-text">
                                  {new Date(item.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>

                                {/* WhatsApp Double Blue Tick (Seen) Indicator for Sent Messages */}
                                {mine && (
                                  <span
                                    className="whatsapp-ticks seen"
                                    title="Seen / Read"
                                  >
                                    <svg
                                      viewBox="0 0 18 15"
                                      width="16"
                                      height="14"
                                      fill="none"
                                    >
                                      <path
                                        d="M15.01 3.31a.65.65 0 0 0-.92 0L9.85 7.55l-.75-.75a.65.65 0 0 0-.92.92l1.21 1.21a.65.65 0 0 0 .92 0l4.7-4.7a.65.65 0 0 0 0-.92z"
                                        fill="#53bdeb"
                                      />
                                      <path
                                        d="M10.75 3.31a.65.65 0 0 0-.92 0L5.59 7.55l-1.6-1.6a.65.65 0 0 0-.92.92l2.06 2.06a.65.65 0 0 0 .92 0l4.7-4.7a.65.65 0 0 0 0-.92z"
                                        fill="#53bdeb"
                                      />
                                    </svg>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* ── Edit Message Mode Banner ── */}
                {editingMessage && (
                  <div className="editing-banner">
                    <div>
                      <strong>Editing Message:</strong>
                      <span>
                        "{editingMessage.content.length > 45
                          ? editingMessage.content.substring(0, 45) + "..."
                          : editingMessage.content}"
                      </span>
                    </div>
                    <button
                      className="editing-cancel-btn"
                      onClick={cancelEditing}
                      title="Cancel edit"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* ── Message Input Bar ── */}
                <form className="message-input-bar" onSubmit={handleSendOrEdit}>
                  {/* Emoji Toggle */}
                  <button
                    type="button"
                    className="emoji-toggle-btn"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    title="Add emoji"
                  >
                    😊
                  </button>

                  {/* Emoji Quick Picker */}
                  {showEmojiPicker && (
                    <div className="emoji-picker-popover">
                      {POPULAR_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="emoji-item-btn"
                          onClick={() => {
                            setMessage((prev) => prev + emoji);
                            inputRef.current?.focus();
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  <input
                    ref={inputRef}
                    className="message-input-field"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      editingMessage
                        ? "Edit your message..."
                        : `Message ${selectedUser.username || "friend"}...`
                    }
                    disabled={sending}
                  />

                  <button
                    type="submit"
                    className="send-msg-btn"
                    disabled={!message.trim() || sending}
                    title={editingMessage ? "Update message" : "Send message"}
                  >
                    {editingMessage ? (
                      <span style={{ fontSize: "16px", fontWeight: "bold" }}>✓</span>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                  </button>
                </form>
              </>
            ) : null}
          </section>
        </div>
      </main>

      <ConfirmModal
        isOpen={deleteConfirmMsgId !== null}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeletingMessage}
        onConfirm={executeDeleteMessage}
        onCancel={() => setDeleteConfirmMsgId(null)}
      />

      <BottomNav />
    </>
  );
}

export default Messages;
