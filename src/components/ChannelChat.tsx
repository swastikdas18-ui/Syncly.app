import React, { useState, useEffect, useRef } from 'react';
import { 
  Hash, 
  Lock, 
  Send, 
  Plus, 
  Image as ImageIcon, 
  X, 
  Radio, 
  Sparkles,
  Info,
  Users,
  ChevronDown,
  Check,
  Circle,
  AtSign
} from 'lucide-react';
import { Channel, ChatMessage, Tenant, PresenceUser } from '../types.ts';
import { api } from '../lib/api.ts';

interface ChannelChatProps {
  channels: Channel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  onChannelCreated: (channel: Channel) => void;
  activeTenant: Tenant | null;
}

export const ChannelChat: React.FC<ChannelChatProps> = ({
  channels,
  activeChannelId,
  onSelectChannel,
  onChannelCreated,
  activeTenant,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [mediaAttachments, setMediaAttachments] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isNewChannelModalOpen, setIsNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);

  // Supabase Presence State
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [myStatus, setMyStatus] = useState<'online' | 'away' | 'busy' | 'offline'>('online');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Mention Dropdown State
  const [mentionQuery, setMentionQuery] = useState('');
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionMatchRange, setMentionMatchRange] = useState<{ start: number; end: number } | null>(null);

  // Mobile Drawer State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const currentChannel = channels.find((c) => c.id === activeChannelId) || channels[0];

  // Fetch messages when channel or tenant changes
  useEffect(() => {
    let isSubscribed = true;
    if (activeChannelId) {
      api.getMessages(activeChannelId).then((data) => {
        if (isSubscribed) {
          setMessages(data);
          scrollToBottom();
        }
      });
    }
    return () => {
      isSubscribed = false;
    };
  }, [activeChannelId, activeTenant?.id]);

  // Fetch & Track Presence on tenant change or channel change
  useEffect(() => {
    let isSubscribed = true;
    api.getPresence().then((data) => {
      if (isSubscribed && data) {
        setPresenceUsers(data);
      }
    });

    // Track active presence in Supabase Realtime channel
    api.trackPresence(myStatus, activeChannelId);

    return () => {
      isSubscribed = false;
    };
  }, [activeTenant?.id, activeChannelId, myStatus]);

  // Real-time listener for incoming messages & presence sync
  useEffect(() => {
    const unsubscribe = api.subscribeToEvents((event, data) => {
      const payload = data as { 
        type?: string; 
        channelId?: string; 
        message?: ChatMessage;
        presence?: PresenceUser[];
      };

      if (payload.type === 'MESSAGE_CREATED' && payload.channelId === activeChannelId && payload.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message?.id)) return prev;
          return [...prev, payload.message!];
        });
        scrollToBottom();
      }

      if (payload.type === 'PRESENCE_SYNC' && payload.presence) {
        setPresenceUsers(payload.presence);
      }
    });

    return () => unsubscribe();
  }, [activeChannelId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() && mediaAttachments.length === 0) return;

    const contentToSend = inputContent.trim();
    const attachmentsToSend = [...mediaAttachments];
    setInputContent('');
    setMediaAttachments([]);

    // Optimistic message append
    const tempId = 'temp-' + Date.now();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      tenantId: activeTenant?.id || '',
      channelId: activeChannelId,
      userId: 'current-user',
      userName: activeTenant?.name === 'Acme Corporation' ? 'Elena Rostova' : 'Devon Thorne',
      userRole: 'admin',
      userInitials: activeTenant?.name === 'Acme Corporation' ? 'ER' : 'DT',
      content: contentToSend,
      mediaUrls: attachmentsToSend,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    const savedMsg = await api.sendMessage(activeChannelId, contentToSend, attachmentsToSend);
    if (savedMsg) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...savedMsg, status: 'sent' } : m)));
    } else {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    for (let i = 0; i < files.length; i++) {
      try {
        const res = await api.uploadMedia(files[i]);
        if (res?.url) {
          setMediaAttachments((prev) => [...prev, res.url]);
        }
      } catch (err) {
        console.error('Chat upload failed:', err);
      }
    }
    setIsUploading(false);
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const created = await api.createChannel({
      name: newChannelName.trim(),
      description: newChannelDesc.trim(),
      isPrivate: newChannelPrivate,
    });

    if (created) {
      onChannelCreated(created);
      onSelectChannel(created.id);
      setIsNewChannelModalOpen(false);
      setNewChannelName('');
      setNewChannelDesc('');
      setNewChannelPrivate(false);
    }
  };

  const handleStatusChange = async (status: 'online' | 'away' | 'busy' | 'offline') => {
    setMyStatus(status);
    setIsStatusDropdownOpen(false);
    await api.trackPresence(status, activeChannelId);
  };

  // Mention Trigger Checker
  const checkMentionTrigger = (text: string, cursorPos: number) => {
    const textBefore = text.slice(0, cursorPos);
    const match = textBefore.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);
    if (match) {
      const q = match[1];
      setMentionQuery(q);
      setIsMentionOpen(true);
      setSelectedMentionIndex(0);
      const atIndex = textBefore.lastIndexOf('@');
      setMentionMatchRange({ start: atIndex, end: cursorPos });
    } else {
      setIsMentionOpen(false);
      setMentionMatchRange(null);
    }
  };

  const filteredMentionUsers = presenceUsers.filter((u) => {
    if (!mentionQuery.trim()) return true;
    const q = mentionQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.initials.toLowerCase().includes(q)
    );
  });

  const handleSelectMention = (user: PresenceUser) => {
    const cleanName = user.fullName.replace(/\s*\(You\)/g, '').replace(/\s+/g, '_');
    const tag = `@${cleanName} `;

    let newText = inputContent;
    let newCursorPos = inputContent.length;

    if (mentionMatchRange) {
      const before = inputContent.slice(0, mentionMatchRange.start);
      const after = inputContent.slice(mentionMatchRange.end);
      newText = before + tag + after;
      newCursorPos = before.length + tag.length;
    } else {
      newText = `${inputContent ? inputContent + ' ' : ''}${tag}`;
      newCursorPos = newText.length;
    }

    setInputContent(newText);
    setIsMentionOpen(false);
    setMentionMatchRange(null);

    setTimeout(() => {
      textInputRef.current?.focus();
      textInputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 15);
  };

  const handleMentionUser = (name: string) => {
    const cleanName = name.replace(/\s*\(You\)/g, '').replace(/\s+/g, '_');
    const tag = `@${cleanName} `;
    setInputContent((prev) => `${prev ? prev + ' ' : ''}${tag}`);
    textInputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputContent(val);
    const cursorPos = e.target.selectionStart ?? val.length;
    checkMentionTrigger(val, cursorPos);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isMentionOpen && filteredMentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % filteredMentionUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const user = filteredMentionUsers[selectedMentionIndex] || filteredMentionUsers[0];
        if (user) {
          handleSelectMention(user);
        }
        return;
      }
      if (e.key === 'Escape') {
        setIsMentionOpen(false);
        return;
      }
    }
  };

  const renderMessageContent = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_.-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span 
            key={i} 
            className="inline-flex items-center font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.2 rounded text-[11px] transition-colors"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const onlineCount = presenceUsers.filter((u) => u.status === 'online').length;

  const renderSidebarContent = (isMobileDrawer = false) => (
    <div className="flex flex-col h-full bg-slate-50/80">
      {/* Workspace Title & Current User Presence Controller */}
      <div className="p-3.5 border-b border-slate-200/80 bg-white shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Workspace
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {activeTenant?.id.slice(0, 8)}...
          </span>
        </div>
        <div className="text-sm font-bold text-slate-900 truncate mb-2">
          {activeTenant?.name}
        </div>

        {/* My Presence Status Toggler */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs transition-colors cursor-pointer"
            title="Change your real-time presence status"
          >
            <div className="flex items-center gap-2 truncate">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                myStatus === 'online' ? 'bg-emerald-500 ring-2 ring-emerald-100' :
                myStatus === 'away' ? 'bg-amber-500 ring-2 ring-amber-100' :
                myStatus === 'busy' ? 'bg-rose-500 ring-2 ring-rose-100' :
                'bg-slate-300 ring-2 ring-slate-100'
              }`} />
              <span className="font-semibold text-slate-700 capitalize">
                Status: {myStatus}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isStatusDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsStatusDropdownOpen(false)} 
              />
              <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 text-xs">
                {[
                  { key: 'online', label: 'Online', desc: 'Available for messages', color: 'bg-emerald-500' },
                  { key: 'away', label: 'Away', desc: 'Stepped away temporarily', color: 'bg-amber-500' },
                  { key: 'busy', label: 'Busy / In Meeting', desc: 'Notifications muted', color: 'bg-rose-500' },
                  { key: 'offline', label: 'Appear Offline', desc: 'Invisible in channel', color: 'bg-slate-300' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleStatusChange(opt.key as any)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      myStatus === opt.key ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${opt.color}`} />
                      <div>
                        <div className="font-semibold text-slate-900">{opt.label}</div>
                        <div className="text-[10px] text-slate-400">{opt.desc}</div>
                      </div>
                    </div>
                    {myStatus === opt.key && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* CHANNELS SECTION */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Channels ({channels.length})
          </span>
          <button
            type="button"
            onClick={() => {
              if (isMobileDrawer) setIsMobileSidebarOpen(false);
              setIsNewChannelModalOpen(true);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
            title="Create new channel"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-2 py-1 space-y-0.5">
          {channels.map((chan) => {
            const isActive = chan.id === activeChannelId;
            return (
              <button
                key={chan.id}
                type="button"
                onClick={() => {
                  onSelectChannel(chan.id);
                  if (isMobileDrawer) setIsMobileSidebarOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {chan.isPrivate ? (
                    <Lock className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  ) : (
                    <Hash className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  )}
                  <span className="truncate">{chan.name}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* TEAM PRESENCE (SUPABASE REALTIME) SECTION */}
        <div className="mt-4 pt-3 border-t border-slate-200/80">
          <div className="px-3 pb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Team Members
              </span>
              <span className="text-[10px] font-mono font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                {onlineCount} online
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {presenceUsers.length} total
            </span>
          </div>

          {/* Members List with Realtime Presence Indicators */}
          <div className="px-2 py-1 space-y-1">
            {presenceUsers.map((user) => {
              const isOnline = user.status === 'online';
              const isAway = user.status === 'away';
              const isBusy = user.status === 'busy';
              const isCurrentUser = user.fullName.includes('(You)');

              return (
                <div
                  key={user.id}
                  className="group flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
                  onClick={() => {
                    handleMentionUser(user.fullName);
                    if (isMobileDrawer) setIsMobileSidebarOpen(false);
                  }}
                  title={`Click to mention ${user.fullName} in chat`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Avatar with Status Ring */}
                    <div className="relative shrink-0">
                      <div className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center ${
                        isCurrentUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
                      }`}>
                        {user.initials}
                      </div>

                      {/* Live Presence Indicator Dot */}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                        isOnline ? 'bg-emerald-500' :
                        isAway ? 'bg-amber-500' :
                        isBusy ? 'bg-rose-500' :
                        'bg-slate-300'
                      }`} />
                    </div>

                    {/* Name, Role & Activity */}
                    <div className="truncate">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {user.fullName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        <span>{user.role}</span>
                        <span>·</span>
                        <span className={`capitalize font-mono text-[10px] ${
                          isOnline ? 'text-emerald-600 font-medium' : 
                          isAway ? 'text-amber-600' : 
                          isBusy ? 'text-rose-600' : 
                          'text-slate-400'
                        }`}>
                          {user.status === 'online' 
                            ? (user.currentChannelId ? `#${user.currentChannelId}` : 'online')
                            : user.lastSeen || user.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hover action to mention */}
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity"
                    title={`Mention ${user.fullName}`}
                  >
                    <AtSign className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SIDEBAR FOOTER */}
      <div className="p-3 border-t border-slate-200/80 bg-white shrink-0">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono">Supabase Presence</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            room:{activeTenant?.id.slice(0, 4)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto p-0 sm:py-3 sm:px-4 md:py-6 md:px-6 lg:px-8">
      <div className="bg-white rounded-none sm:rounded-xl border-x-0 border-y sm:border border-slate-200 shadow-xs overflow-hidden flex h-[calc(100dvh-7rem-env(safe-area-inset-bottom,0px))] md:h-[calc(100dvh-8.5rem)] md:max-h-[860px] md:min-h-[500px]">
        
        {/* DESKTOP SIDEBAR: CHANNELS & REALTIME PRESENCE */}
        <div className="hidden md:flex w-64 lg:w-72 xl:w-80 border-r border-slate-200 bg-slate-50/70 flex-col shrink-0 transition-all">
          {renderSidebarContent(false)}
        </div>

        {/* MOBILE SIDEBAR OVERLAY DRAWER */}
        {isMobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div 
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" 
              onClick={() => setIsMobileSidebarOpen(false)} 
            />
            <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
              <div className="px-3.5 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold tracking-wide">Channels &amp; Team Presence</span>
                <button 
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1 text-slate-300 hover:text-white rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {renderSidebarContent(true)}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT AREA: CHAT STREAM & INPUT */}
        <div className="flex-1 flex flex-col bg-white min-w-0">
          
          {/* Channel Header */}
          <div className="px-3 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-white shrink-0 gap-2">
            <div className="flex items-center gap-2 truncate">
              {/* Mobile Channels Drawer Button */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="md:hidden flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
                title="View channels and team presence"
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span className="truncate max-w-[70px]">Channels</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </button>

              {currentChannel?.isPrivate ? (
                <Lock className="w-4 h-4 text-slate-600 shrink-0" />
              ) : (
                <Hash className="w-4 h-4 text-slate-600 shrink-0" />
              )}
              <div className="min-w-0 truncate">
                <span className="font-semibold text-slate-900 text-sm truncate">
                  {currentChannel?.name || 'general'}
                </span>
                <span className="text-xs text-slate-400 ml-2 font-normal hidden lg:inline truncate">
                  {currentChannel?.description}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500 shrink-0">
              <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px]">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>{onlineCount} online</span>
              </div>
              <div className="hidden sm:block h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-600">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span className="hidden sm:inline">Realtime Synced</span>
                <span className="sm:hidden">Live</span>
              </div>
            </div>
          </div>

          {/* Message History Viewport */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Hash className="w-10 h-10 text-slate-300 mb-2" />
                <h4 className="text-sm font-semibold text-slate-800">#{currentChannel?.name || 'general'}</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  This is the start of the #{currentChannel?.name || 'general'} channel. Send a message to start the conversation.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const prevMsg = messages[idx - 1];
                const isSameAuthor = prevMsg && prevMsg.userId === msg.userId && 
                  Math.abs(new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 300000;

                return (
                  <div key={msg.id} className={`flex items-start gap-3 ${isSameAuthor ? 'mt-1' : 'mt-4'}`}>
                    {!isSameAuthor ? (
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {msg.userInitials || 'SY'}
                      </div>
                    ) : (
                      <div className="w-8 shrink-0" />
                    )}

                    <div className="flex-1 max-w-2xl">
                      {!isSameAuthor && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-slate-900">{msg.userName}</span>
                          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.status === 'sending' && (
                            <span className="text-[10px] text-amber-500 font-mono">sending...</span>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-slate-800 leading-relaxed break-words">
                        {renderMessageContent(msg.content)}
                      </div>

                      {/* Attachments */}
                      {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.mediaUrls.map((url, i) => (
                            <img 
                              key={i} 
                              src={url} 
                              alt="Attachment" 
                              className="max-h-48 rounded-lg border border-slate-200 object-cover" 
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sticky Message Composer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/50">
            {mediaAttachments.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                {mediaAttachments.map((url, i) => (
                  <div key={i} className="relative group w-12 h-12 rounded-lg overflow-hidden border border-slate-200">
                    <img src={url} alt="Attached" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setMediaAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileUpload(e.target.files)}
                multiple
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Attach media to message"
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              {/* Chat Input with Relative Mention Dropdown Container */}
              <div className="relative flex-1 min-w-0">
                {/* Floating Mention Dropdown */}
                {isMentionOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-[calc(100vw-3rem)] sm:w-80 max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/70">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <AtSign className="w-3 h-3 text-blue-600" />
                        <span>Mention a Teammate</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {filteredMentionUsers.length} in {activeTenant?.name}
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
                      {filteredMentionUsers.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-400 italic">
                          No team members match &ldquo;{mentionQuery}&rdquo;
                        </div>
                      ) : (
                        filteredMentionUsers.map((user, idx) => {
                          const isSelected = idx === selectedMentionIndex;
                          const isOnline = user.status === 'online';
                          const isAway = user.status === 'away';
                          const isBusy = user.status === 'busy';

                          return (
                            <button
                              key={user.id}
                              type="button"
                              onMouseEnter={() => setSelectedMentionIndex(idx)}
                              onClick={() => handleSelectMention(user)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                                isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div className="relative shrink-0">
                                  <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                                    {user.initials}
                                  </div>
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-white ${
                                    isOnline ? 'bg-emerald-500' :
                                    isAway ? 'bg-amber-500' :
                                    isBusy ? 'bg-rose-500' :
                                    'bg-slate-300'
                                  }`} />
                                </div>
                                <div className="truncate">
                                  <div className="font-semibold truncate flex items-center gap-1">
                                    <span>{user.fullName}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {user.role} · <span className="capitalize">{user.status}</span>
                                  </div>
                                </div>
                              </div>

                              {isSelected && (
                                <span className="text-[10px] font-mono text-blue-600 bg-blue-100/70 px-1.5 py-0.5 rounded shrink-0">
                                  ↵ select
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className="px-3 py-1 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Use ↑↓ to navigate</span>
                      <span>↵ or Tab to select</span>
                    </div>
                  </div>
                )}

                <input
                  ref={textInputRef}
                  type="text"
                  placeholder={`Message #${currentChannel?.name || 'channel'} (@ to mention)...`}
                  value={inputContent}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  className="w-full px-3 py-2 text-sm sm:text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={!inputContent.trim() && mediaAttachments.length === 0}
                className="px-3 sm:px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Send</span>
              </button>
            </form>
          </div>

        </div>

      </div>

      {/* New Channel Modal */}
      {isNewChannelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-md w-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Create Channel in {activeTenant?.name}</h3>
              <button
                type="button"
                onClick={() => setIsNewChannelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Channel Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-xs">#</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. security-sync"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="What is this channel about?"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="private-chan"
                  checked={newChannelPrivate}
                  onChange={(e) => setNewChannelPrivate(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="private-chan" className="text-xs text-slate-700">
                  Make private (only invited members can view)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewChannelModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
