'use client';

import { useState, useEffect, useCallback } from "react";

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [engagementSearch, setEngagementSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Message viewing state
  const [expandedConversation, setExpandedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      setConversations(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setLoading(false);
    }
  };

  const filterConversations = useCallback(() => {
    let filtered = conversations;

    // Filter by engagement UUID
    if (engagementSearch.trim()) {
      filtered = filtered.filter(conversation => {
        // Check primary engagement UUID
        if (conversation.engagementUuid?.toLowerCase().includes(engagementSearch.toLowerCase())) {
          return true;
        }
        // Check all engagements array
        return conversation.engagements.some(eng =>
          eng.uuid.toLowerCase().includes(engagementSearch.toLowerCase())
        );
      });
    }

    // Filter by user UUID
    if (userSearch.trim()) {
      filtered = filtered.filter(conversation => {
        // Check conversation user UUIDs
        if (conversation.userUuids.some(uuid =>
          uuid.toLowerCase().includes(userSearch.toLowerCase())
        )) {
          return true;
        }
        // Check user details
        return conversation.users.some(user =>
          user.uuid.toLowerCase().includes(userSearch.toLowerCase()) ||
          (user.details && (
            user.details.email.toLowerCase().includes(userSearch.toLowerCase()) ||
            user.details.fullName.toLowerCase().includes(userSearch.toLowerCase())
          ))
        );
      });
    }

    setFilteredConversations(filtered);
  }, [conversations, engagementSearch, userSearch]);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    filterConversations();
  }, [conversations, engagementSearch, userSearch, filterConversations]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expandedConversation) {
        setExpandedConversation(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expandedConversation]);

  const fetchMessages = async (conversationUuid: string) => {
    // Return cached messages if already loaded
    if (messages[conversationUuid]) {
      return;
    }

    setLoadingMessages(conversationUuid);
    try {
      const response = await fetch(`/api/messages/${conversationUuid}`);
      const data = await response.json();

      if (response.ok) {
        setMessages(prev => ({
          ...prev,
          [conversationUuid]: data.messages
        }));
      } else {
        console.error('Error fetching messages:', data.error);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(null);
    }
  };

  const toggleMessages = async (conversationUuid: string) => {
    if (expandedConversation === conversationUuid) {
      // Collapse if already expanded
      setExpandedConversation(null);
    } else {
      // Expand and fetch messages
      setExpandedConversation(conversationUuid);
      await fetchMessages(conversationUuid);
    }
  };

  if (loading) {
    return (
      <div className="font-sans min-h-screen p-8 pb-20">
        <main className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading conversations...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="font-sans min-h-screen p-8 pb-20">
      <main className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Conversations</h1>

        {/* Search bars */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="engagement-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search by Engagement UUID
            </label>
            <input
              id="engagement-search"
              type="text"
              value={engagementSearch}
              onChange={(e) => setEngagementSearch(e.target.value)}
              placeholder="Enter engagement UUID..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="user-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search by User UUID/Name/Email
            </label>
            <input
              id="user-search"
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Enter user UUID, name, or email..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Search results info */}
        <div className="mb-4 flex justify-between items-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredConversations.length} of {conversations.length} conversations
            {(engagementSearch || userSearch) && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                (filtered)
              </span>
            )}
          </p>
          {(engagementSearch || userSearch) && (
            <button
              onClick={() => {
                setEngagementSearch('');
                setUserSearch('');
              }}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear filters
            </button>
          )}
        </div>

        {filteredConversations.length > 0 ? (
          <div className="space-y-4">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.uuid}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Conversation Details</h3>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">UUID:</span>
                        <span className="font-mono ml-2 text-blue-600 dark:text-blue-400">
                          {conversation.uuid}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Comet ID:</span>
                        <span className="font-mono ml-2">
                          {conversation.cometConversationId}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Type:</span>
                        <span className="ml-2">
                          {conversation.cometConversationType}
                        </span>
                      </div>
                      {conversation.cometConversationType === 'group' && (
                        <>
                          <div>
                            <span className="font-medium text-gray-600 dark:text-gray-400">Engagement UUID:</span>
                            <span className="font-mono ml-2 text-purple-600 dark:text-purple-400">
                              {conversation.engagementUuid || 'Not found'}
                            </span>
                          </div>
                          {conversation.engagement && (
                            <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded border-l-4 border-purple-400">
                              <span className="font-medium text-gray-600 dark:text-gray-400">Engagement Title:</span>
                              <div className="font-semibold text-purple-700 dark:text-purple-300 mt-1">
                                {conversation.engagement.title}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {conversation.cometConversationType === 'user' && (
                        <>
                          {conversation.engagement ? (
                            <>
                              <div>
                                <span className="font-medium text-gray-600 dark:text-gray-400">Engagement UUID:</span>
                                <span className="font-mono ml-2 text-orange-600 dark:text-orange-400">
                                  {conversation.engagementUuid}
                                </span>
                              </div>
                              <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded border-l-4 border-orange-400">
                                <span className="font-medium text-gray-600 dark:text-gray-400">Engagement Title:</span>
                                <div className="font-semibold text-orange-700 dark:text-orange-300 mt-1">
                                  {conversation.engagement.title}
                                </div>
                              </div>
                            </>
                          ) : conversation.engagements.length > 1 ? (
                            <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-4 border-yellow-400">
                              <span className="font-medium text-gray-600 dark:text-gray-400">Multiple Engagements ({conversation.engagements.length}):</span>
                              <div className="mt-1 space-y-1">
                                {conversation.engagements.map((eng, idx) => (
                                  <div key={idx} className="text-sm">
                                    <span className="font-mono text-yellow-600 dark:text-yellow-400 mr-2">
                                      {eng.uuid}
                                    </span>
                                    <span className="font-semibold text-yellow-700 dark:text-yellow-300">
                                      {eng.title}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : conversation.engagements.length === 0 ? (
                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900/20 rounded border-l-4 border-gray-400">
                              <span className="text-sm text-gray-600 dark:text-gray-400">No matching engagement found</span>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Users ({conversation.users.length})</h4>
                    <div className="space-y-2">
                      {conversation.users.map((user, index) => (
                        <div key={index} className="bg-green-50 dark:bg-green-900/20 p-3 rounded border-l-4 border-green-400">
                          <div className="font-mono text-xs text-green-600 dark:text-green-400 mb-1">
                            {user.uuid}
                          </div>
                          {user.details ? (
                            <div className="space-y-1">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">
                                {user.details.fullName || `${user.details.firstName} ${user.details.lastName}`}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {user.details.email}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {user.details.roles.map((role, roleIndex) => (
                                  <span
                                    key={roleIndex}
                                    className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full"
                                  >
                                    {role}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                              User not found
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* View Messages Button */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center">
                    <div className="flex text-xs text-gray-500 dark:text-gray-400 space-x-4">
                      <span>Created: {new Date(conversation.createdAt).toLocaleString()}</span>
                      <span>Updated: {new Date(conversation.updatedAt).toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => toggleMessages(conversation.uuid)}
                      disabled={loadingMessages === conversation.uuid}
                      className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loadingMessages === conversation.uuid ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={expandedConversation === conversation.uuid
                                ? "M19 9l-7 7-7-7"
                                : "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.484L3 21l2.516-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"
                              }
                            />
                          </svg>
                          <span>
                            {expandedConversation === conversation.uuid ? 'Hide Messages' : 'View Messages'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable Messages Section */}
                {expandedConversation === conversation.uuid && (
                  <div className="mt-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                    <h4 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">
                      Messages ({messages[conversation.uuid]?.length || 0})
                    </h4>

                    {messages[conversation.uuid] && messages[conversation.uuid].length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {messages[conversation.uuid].map((message) => (
                          <div
                            key={message.uuid}
                            className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {message.sender?.fullName || 'Unknown User'}
                                  </span>
                                  <div className="flex space-x-1">
                                    {message.sender?.roles.map((role, idx) => (
                                      <span
                                        key={idx}
                                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                          role === 'mentor' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                                          role === 'student' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                                          role === 'guardian' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' :
                                          'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200'
                                        }`}
                                      >
                                        {role}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                {message.text && (
                                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                    {message.text}
                                  </p>
                                )}

                                {message.mediaUrl && (
                                  <div className="mt-2">
                                    {message.mediaMimeType?.startsWith('image/') ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={message.mediaUrl}
                                        alt={message.mediaName || 'Attachment'}
                                        className="max-w-xs rounded border"
                                      />
                                    ) : (
                                      <a
                                        href={message.mediaUrl}
                                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm underline"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        📎 {message.mediaName || 'Attachment'}
                                      </a>
                                    )}
                                  </div>
                                )}

                                {message.reactions.length > 0 && (
                                  <div className="mt-2 flex space-x-1">
                                    {message.reactions.map((reaction, idx) => (
                                      <span key={idx} className="text-sm">
                                        {reaction}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="text-xs text-gray-500 dark:text-gray-400 ml-4 flex-shrink-0">
                                {new Date(message.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400 mb-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.484L3 21l2.516-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"
                          />
                        </svg>
                        <p className="text-sm">No messages found in this conversation</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-lg text-center">
            <p className="text-gray-500 font-mono">
              {(engagementSearch || userSearch) ? 'No conversations match your search criteria' : 'No conversations found'}
            </p>
            {(engagementSearch || userSearch) && (
              <button
                onClick={() => {
                  setEngagementSearch('');
                  setUserSearch('');
                }}
                className="mt-3 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
