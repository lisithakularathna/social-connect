import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

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

interface Conversation {
  user: User;
  lastMessage: {
    id: number;
    content: string;
    senderId: number;
    createdAt: string;
  };
}

function Messages() {
  const navigate = useNavigate();

  const { userId } = useParams<{
    userId?: string;
  }>();

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [selectedUser, setSelectedUser] =
    useState<User | null>(null);

  const [message, setMessage] =
    useState("");

  const [currentUserId, setCurrentUserId] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const loadCurrentUser = async () => {
    try {
      const response =
        await api.get("/users/me");

      setCurrentUserId(response.data.id);
    } catch (error) {
      console.error(error);
    }
  };

  const loadConversations = async () => {
    try {
      const response =
        await api.get(
          "/messages/conversations"
        );

      setConversations(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadConversation = async (
    id: number
  ) => {
    try {
      const userResponse =
        await api.get(`/users/${id}`);

      setSelectedUser(userResponse.data);

      const messagesResponse =
        await api.get(`/messages/${id}`);

      setMessages(messagesResponse.data);
    } catch (error: any) {
      console.error(error);

      alert(
        error.response?.data?.message ||
          "Cannot open this conversation."
      );
    }
  };

  const sendMessage = async () => {
    if (!userId || !message.trim()) {
      return;
    }

    try {
      const response = await api.post(
        `/messages/${userId}`,
        {
          content: message,
        }
      );

      setMessages((current) => [
        ...current,
        response.data,
      ]);

      setMessage("");

      await loadConversations();
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          "Failed to send message."
      );
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      await Promise.all([
        loadCurrentUser(),
        loadConversations(),
      ]);

      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    if (userId) {
      loadConversation(Number(userId));
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      loadConversation(Number(userId));
    }, 3000);

    return () => clearInterval(interval);
  }, [userId]);

  return (
    <>
      <Navbar />

      <main className="messages-page">
        <div className="messages-layout">

          {/* Conversations */}
          <aside className="conversation-sidebar">
            <div className="messages-title">
              <h1>Messages</h1>
            </div>

            {loading ? (
              <div className="conversation-loading">
                Loading...
              </div>
            ) : conversations.length === 0 ? (
              <div className="conversation-empty">
                <span>💬</span>
                <p>
                  No conversations yet.
                </p>
              </div>
            ) : (
              conversations.map(
                (conversation) => (
                  <div
                    key={conversation.user.id}
                    className={`conversation-item ${
                      userId ===
                      String(
                        conversation.user.id
                      )
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      navigate(
                        `/messages/${conversation.user.id}`
                      )
                    }
                  >
                    {conversation.user
                      .profileImageUrl ? (
                      <img
                        src={
                          conversation.user
                            .profileImageUrl
                        }
                        alt=""
                      />
                    ) : (
                      <div className="conversation-avatar">
                        {(
                          conversation.user
                            .username ||
                          "U"
                        )[0].toUpperCase()}
                      </div>
                    )}

                    <div>
                      <strong>
                        {conversation.user
                          .username ||
                          conversation.user
                            .name}
                      </strong>

                      <p>
                        {
                          conversation.lastMessage
                            .content
                        }
                      </p>
                    </div>
                  </div>
                )
              )
            )}
          </aside>

          {/* Chat */}
          <section className="chat-section">
            {!userId || !selectedUser ? (
              <div className="no-chat">
                <div className="no-chat-icon">
                  💬
                </div>

                <h2>Your Messages</h2>

                <p>
                  Select a conversation to start
                  chatting.
                </p>
              </div>
            ) : (
              <>
                <header className="chat-header">
                  <button
                    className="chat-back"
                    onClick={() =>
                      navigate("/messages")
                    }
                  >
                    ←
                  </button>

                  {selectedUser.profileImageUrl ? (
                    <img
                      src={
                        selectedUser.profileImageUrl
                      }
                      alt=""
                    />
                  ) : (
                    <div className="chat-avatar">
                      {(
                        selectedUser.username ||
                        "U"
                      )[0].toUpperCase()}
                    </div>
                  )}

                  <div>
                    <strong>
                      {selectedUser.username ||
                        selectedUser.name}
                    </strong>

                    {selectedUser.name && (
                      <small>
                        {selectedUser.name}
                      </small>
                    )}
                  </div>
                </header>

                <div className="chat-messages">
                  {messages.map((item) => {
                    const mine =
                      item.senderId ===
                      currentUserId;

                    return (
                      <div
                        key={item.id}
                        className={`message-row ${
                          mine ? "mine" : "theirs"
                        }`}
                      >
                        <div className="message-bubble">
                          <p>{item.content}</p>

                          <small>
                            {new Date(
                              item.createdAt
                            ).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="message-input">
                  <input
                    value={message}
                    onChange={(e) =>
                      setMessage(e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey
                      ) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Message..."
                  />

                  <button
                    onClick={sendMessage}
                    disabled={!message.trim()}
                  >
                    Send
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
