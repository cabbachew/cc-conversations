"use client";

import { useState, useCallback } from "react";
import { Search, MessageCircle, Paperclip, Loader2, User, Users, ArrowLeft } from "lucide-react";

type User = {
  uuid: string;
  details: {
    uuid: string;
    firstName: string;
    lastName: string;
    fullName: string;
    roles: string[];
    email: string;
  } | null;
};

type Engagement = {
  uuid: string;
  title: string;
};

type Message = {
  uuid: string;
  senderUuid: string;
  text: string | null;
  createdAt: string;
  updatedAt: string;
  cometMessageType: string;
  mediaMimeType: string | null;
  mediaName: string | null;
  mediaUrl: string | null;
  reactions: string[];
  reactedBy: string[];
  readByAll: boolean;
  sender: {
    uuid: string;
    firstName: string;
    lastName: string;
    fullName: string;
    roles: string[];
    email: string;
    profilePictureUrl: string | null;
  } | null;
};

type Conversation = {
  uuid: string;
  userUuids: string[];
  createdAt: string;
  updatedAt: string;
  cometConversationId: string;
  cometConversationType: string;
  engagementUuid: string | null;
  engagement: Engagement | null;
  engagements: Engagement[];
  users: User[];
};

export default function Home() {
  const [engagementSearch, setEngagementSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationMessageCounts, setConversationMessageCounts] = useState<Record<string, number>>({});
  const [conversationLatestDates, setConversationLatestDates] = useState<Record<string, string>>({});

  const searchConversations = useCallback(async () => {
    if (!engagementSearch.trim() && !userSearch.trim()) {
      setConversations([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/conversations");
      const allConversations = await response.json();

      const filtered = allConversations.filter((conversation: Conversation) => {
        let matchesEngagement = true;
        let matchesUser = true;

        // Filter by engagement
        if (engagementSearch.trim()) {
          matchesEngagement =
            conversation.engagementUuid
              ?.toLowerCase()
              .includes(engagementSearch.toLowerCase()) ||
            conversation.engagements.some(
              (eng) =>
                eng.uuid
                  .toLowerCase()
                  .includes(engagementSearch.toLowerCase()) ||
                eng.title.toLowerCase().includes(engagementSearch.toLowerCase())
            ) ||
            conversation.engagement?.title
              .toLowerCase()
              .includes(engagementSearch.toLowerCase()) ||
            false;
        }

        // Filter by user
        if (userSearch.trim()) {
          matchesUser = conversation.users.some(
            (user) =>
              user.uuid.toLowerCase().includes(userSearch.toLowerCase()) ||
              (user.details &&
                (user.details.email
                  .toLowerCase()
                  .includes(userSearch.toLowerCase()) ||
                  user.details.fullName
                    .toLowerCase()
                    .includes(userSearch.toLowerCase()) ||
                  user.details.firstName
                    .toLowerCase()
                    .includes(userSearch.toLowerCase()) ||
                  user.details.lastName
                    .toLowerCase()
                    .includes(userSearch.toLowerCase())))
          );
        }

        return matchesEngagement && matchesUser;
      });

      setConversations(filtered);

      // Preload messages for engagement searches to reduce individual API calls
      if (engagementSearch.trim() && filtered.length > 0 && filtered.length <= 10) {
        const preloadPromises = filtered.map(async (conversation: Conversation) => {
          if (!messagesCache[conversation.uuid]) {
            try {
              const response = await fetch(`/api/messages/${conversation.uuid}`);
              const data = await response.json();
              if (response.ok) {
                setMessagesCache(prev => ({
                  ...prev,
                  [conversation.uuid]: data.messages
                }));
                setConversationMessageCounts(prev => ({
                  ...prev,
                  [conversation.uuid]: data.messages.length
                }));

                const latestMessage = data.messages.length > 0 ?
                  data.messages.reduce((latest: Message, current: Message) =>
                    new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
                  ) : null;

                if (latestMessage) {
                  setConversationLatestDates(prev => ({
                    ...prev,
                    [conversation.uuid]: latestMessage.createdAt
                  }));
                }
              }
            } catch (error) {
              console.error(`Error preloading messages for ${conversation.uuid}:`, error);
            }
          }
        });

        // Execute preloading in background
        Promise.all(preloadPromises).catch(console.error);
      }
    } catch (error) {
      console.error("Search error:", error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [engagementSearch, userSearch, messagesCache]);

  const fetchMessages = async (conversationUuid: string) => {
    // Check if messages are already cached from preloading
    if (messagesCache[conversationUuid]) {
      setMessages(messagesCache[conversationUuid]);
      return;
    }

    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/messages/${conversationUuid}`);
      const data = await response.json();

      if (response.ok) {
        setMessages(data.messages);
        setMessagesCache(prev => ({
          ...prev,
          [conversationUuid]: data.messages
        }));
        const latestMessage = data.messages.length > 0 ?
          data.messages.reduce((latest: Message, current: Message) =>
            new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
          ) : null;

        setConversationMessageCounts(prev => ({
          ...prev,
          [conversationUuid]: data.messages.length
        }));

        if (latestMessage) {
          setConversationLatestDates(prev => ({
            ...prev,
            [conversationUuid]: latestMessage.createdAt
          }));
        }
      } else {
        console.error("Error fetching messages:", data.error);
        setMessages([]);
        setConversationMessageCounts(prev => ({
          ...prev,
          [conversationUuid]: 0
        }));
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await fetchMessages(conversation.uuid);
  };

  const handleSearch = () => {
    searchConversations();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchConversations();
    }
  };

  const getDaysSince = (dateString: string) => {
    const messageDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - messageDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Left Sidebar - Search */}
      <div className="w-full lg:w-80 bg-white border-r lg:border-r border-b lg:border-b-0 border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center mb-6">
            <img
              src="/images/blobIcon.png"
              alt="CC Logo"
              className="w-8 h-8 mr-3"
            />
            <h1 className="text-2xl font-bold text-gray-900">
              CC Conversations
            </h1>
          </div>

          {/* Engagement Search */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Engagement Search
            </label>
            <input
              type="text"
              value={engagementSearch}
              onChange={(e) => setEngagementSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="UUID or title..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-600 text-gray-900 font-mono"
            />
          </div>

          {/* User Search */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User Search
            </label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="UUID, name, or email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-600 text-gray-900 font-mono"
            />
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={
              loading || (!engagementSearch.trim() && !userSearch.trim())
            }
            className="w-full bg-[#059669] hover:bg-[#047857] disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors text-sm"
          >
            {loading ? "Searching..." : "Search"}
          </button>

          {/* Clear Button */}
          {(engagementSearch || userSearch) && (
            <button
              onClick={() => {
                setEngagementSearch("");
                setUserSearch("");
                setConversations([]);
                setSelectedConversation(null);
                setMessages([]);
              }}
              className="w-full mt-2 text-gray-600 hover:text-gray-800 text-sm py-1"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Middle Column - Conversations */}
      <div className={`flex-1 min-w-0 bg-white border-r border-gray-200 flex-col ${selectedConversation && 'hidden lg:flex'} ${!selectedConversation ? 'flex' : 'hidden lg:flex'}`}>
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Conversations{" "}
            {conversations.length > 0 && `(${conversations.length})`}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Search className="h-12 w-12 mb-4" />
              <p className="text-sm">
                {!engagementSearch.trim() && !userSearch.trim()
                  ? "Enter search terms to find conversations"
                  : "No conversations found"}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {conversations.map((conversation) => {
                const messageCount = conversationMessageCounts[conversation.uuid] ?? null;
                const latestMessageDate = conversationLatestDates[conversation.uuid];
                const hasNoMessages = messageCount === 0;
                const isSelected = selectedConversation?.uuid === conversation.uuid;
                const daysSince = latestMessageDate ? getDaysSince(latestMessageDate) : null;

                return (
                  <div
                    key={conversation.uuid}
                    onClick={() => selectConversation(conversation)}
                    className={`relative p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected
                        ? "bg-[#FFF8EC] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-[#FBC012]"
                        : ""
                    } ${hasNoMessages ? "opacity-50" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      {/* Left side */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {conversation.cometConversationType === "group" ? (
                            <Users className="h-4 w-4 text-gray-500" />
                          ) : (
                            <User className="h-4 w-4 text-gray-500" />
                          )}
                          <h3 className="font-medium text-gray-900 text-sm">
                            {conversation.cometConversationType === "group"
                              ? "Group Chat"
                              : "Direct Message"}
                          </h3>
                        </div>

                        {/* Users */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {conversation.users.slice(0, 3).map((user, idx) => {
                            const roles = user.details?.roles || [];
                            const primaryRole = roles.includes('guardian') ? 'guardian' :
                                               roles.includes('mentor') ? 'mentor' :
                                               roles.includes('student') ? 'student' : null;

                            const roleConfig = {
                              guardian: { letter: 'G' },
                              mentor: { letter: 'M' },
                              student: { letter: 'S' }
                            };

                            const config = primaryRole ? roleConfig[primaryRole as keyof typeof roleConfig] : null;

                            return (
                              <div key={idx} className="flex items-center">
                                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded flex items-center gap-1">
                                  {user.details?.fullName || "Unknown User"}
                                  {config && (
                                    <span className="text-xs font-bold text-black">
                                      {config.letter}
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                          {conversation.users.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{conversation.users.length - 3} more
                            </span>
                          )}
                        </div>

                        {/* Engagement Info */}
                        {(conversation.engagement ||
                          conversation.engagements.length > 0) && (
                          <div>
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-700">
                              {conversation.engagement?.title ||
                                conversation.engagements[0]?.title ||
                                "Engagement"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right side - Message info */}
                      <div className="flex flex-col items-end text-xs text-gray-500 ml-4">
                        {latestMessageDate ? (
                          <>
                            <div className="mb-1">
                              {new Date(latestMessageDate).toLocaleDateString()}
                            </div>
                            <div className="mb-1">
                              {daysSince === 0 ? 'Today' :
                               daysSince === 1 ? '1 day ago' :
                               `${daysSince} days ago`}
                            </div>
                          </>
                        ) : messageCount === 0 ? (
                          <>
                            <div className="mb-1">No messages</div>
                            <div className="mb-1">-</div>
                          </>
                        ) : (
                          <>
                            <div className="mb-1">-</div>
                            <div className="mb-1">-</div>
                          </>
                        )}
                        <div className="font-medium">
                          {messageCount !== null ?
                            (messageCount === 0 ? '0' : messageCount.toString()) :
                            '-'
                          } messages
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Messages */}
      <div className={`flex-1 min-w-0 bg-gray-50 flex-col ${selectedConversation ? 'flex' : 'hidden lg:flex'}`}>
        {selectedConversation ? (
          <>
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={() => {
                    setSelectedConversation(null);
                    setMessages([]);
                  }}
                  className="lg:hidden p-1 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div className="flex items-center gap-2">
                  {selectedConversation.cometConversationType === "group" ? (
                    <Users className="h-5 w-5 text-gray-500" />
                  ) : (
                    <User className="h-5 w-5 text-gray-500" />
                  )}
                  <h3 className="font-semibold text-gray-900">
                    {selectedConversation.cometConversationType === "group"
                      ? "Group Messages"
                      : "Direct Messages"}
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-500 ml-8 lg:ml-0">
                {selectedConversation.users.length} participants
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <MessageCircle className="mx-auto h-8 w-8 mb-2" />
                  <p className="text-sm">No messages found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.uuid}
                      className="bg-white rounded-lg p-3 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium text-gray-900 text-sm">
                            {message.sender?.fullName || "Unknown User"}
                          </span>
                          <div className="flex space-x-1 mt-1">
                            {message.sender?.roles.map((role, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  role === "mentor"
                                    ? "bg-blue-100 text-blue-800"
                                    : role === "student"
                                    ? "bg-green-100 text-green-800"
                                    : role === "guardian"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(message.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {message.text && (
                        <p className="text-sm text-gray-700 leading-relaxed mb-2">
                          {message.text}
                        </p>
                      )}

                      {message.mediaUrl && (
                        <div className="mb-2">
                          {message.mediaMimeType?.startsWith("image/") ? (
                            <img
                              src={message.mediaUrl}
                              alt={message.mediaName || "Attachment"}
                              className="max-w-full h-32 object-cover rounded border"
                            />
                          ) : (
                            <a
                              href={message.mediaUrl}
                              className="text-blue-600 hover:text-blue-700 text-sm underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Paperclip className="inline h-3 w-3 mr-1" />
                              {message.mediaName || "Attachment"}
                            </a>
                          )}
                        </div>
                      )}

                      {message.reactions.length > 0 && (
                        <div className="flex space-x-1">
                          {message.reactions.map((reaction, idx) => (
                            <span key={idx} className="text-sm">
                              {reaction}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <MessageCircle className="mx-auto h-12 w-12 mb-4" />
              <p className="text-sm">Select a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
