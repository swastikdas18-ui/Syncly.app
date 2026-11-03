import React, { useState, useEffect, useMemo } from 'react';
import { 
  Menu, X, Search, Bell, Plus, Flame, Lock, MessageSquare, 
  Trophy, HelpCircle, ThumbsUp, Share2, Bookmark, CheckCircle2, 
  Code, BarChart3, Radio, ArrowUp, ChevronDown, Award, Send, Smile, Play, Volume2, Sparkles, Check, Home, User
} from 'lucide-react';

// --- TYPES ---
export type FlairType = 'All' | 'Announcements' | 'Discussions' | 'Wins & Demos' | 'Help Wanted';

export interface Comment {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timeAgo: string;
  upvotes: number;
  hasUpvoted?: boolean;
  replies?: Comment[];
}

export interface Post {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  isStaff?: boolean;
  timeAgo: string;
  flair: FlairType;
  title: string;
  content: string;
  hub: string; // Belongs to specific community
  mediaType?: 'terminal' | 'code' | 'chart' | 'poll';
  codeSnippet?: string;
  pollData?: { options: { id: number; text: string; votes: number }[]; userVoted?: number };
  upvotes: number;
  hasUpvoted?: boolean;
  commentsCount: number;
  comments: Comment[];
  stickers: { emoji: string; count: number }[];
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: 'upvote' | 'comment' | 'broadcast';
}

export function WorkConnectHub() {
  // --- USER STATE ---
  const [currentUser] = useState({
    name: 'Akash Patel',
    handle: 'u/akash',
    isStaff: true, // Configured for full Admin/Staff privileges in the prototype
    reputation: 140,
    curatedCount: 3,
  });

  // --- NAVIGATION & MODAL STATES ---
  const [currentHub, setCurrentHub] = useState('r/TechConnect');
  const [isHubDropdownOpen, setIsHubDropdownOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [activeCommentsPost, setActiveCommentsPost] = useState<Post | null>(null);
  const [activeFlair, setActiveFlair] = useState<FlairType>('All');
  
  // Custom screen modes: 'feed' | 'stages' | 'profile'
  const [activeTab, setActiveTab] = useState<'feed' | 'stages' | 'profile'>('feed');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- INTERACTIVE POST STATES ---
  const [simulatedEvents, setSimulatedEvents] = useState(42);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '[sync] Listening on postgres_changes public.posts...',
    '[worker] Connection pool initialized (max_conns: 20)',
  ]);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);
  const [selectedChartDay, setSelectedChartDay] = useState<'Mon' | 'Wed' | 'Fri'>('Fri');

  // --- AUDIO STAGE STATE ---
  const [isListeningToStage, setIsListeningToStage] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [stageParticipants] = useState([
    { name: 'Sarah Lin', role: 'Speaker', avatar: '👩‍💻', isMuted: false, isSpeaking: true },
    { name: 'Marcus V.', role: 'Speaker', avatar: '🎨', isMuted: true, isSpeaking: false },
    { name: 'Akash Patel (You)', role: 'Listener', avatar: '👑', isMuted: true, isSpeaking: false }
  ]);

  // --- FORM STATES FOR CREATING POST ---
  const [formFlair, setFormFlair] = useState<FlairType>('Discussions');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formMediaType, setFormMediaType] = useState<'none' | 'code' | 'poll'>('none');
  const [formCodeSnippet, setFormCodeSnippet] = useState(`// Advisory Lock Mutex pattern\nSELECT pg_try_advisory_xact_lock(hashtext('user_' || auth.uid()::text));`);
  const [formPollOptions, setFormPollOptions] = useState<string[]>(['Zustand + Immer', 'Native Context + useActionState', 'TanStack Store']);

  // --- NEW COMMENT STATE ---
  const [newCommentText, setNewCommentText] = useState('');

  // --- NOTIFICATIONS STATE ---
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n-1',
      title: '⚡ Event Sync Alert',
      body: 'Go sidecar database worker committed 20 transactions.',
      time: '5m ago',
      read: false,
      type: 'broadcast'
    },
    {
      id: 'n-2',
      title: '💬 New reply on Wins',
      body: 'Sarah Lin left a comment on your Neobrutalist design post.',
      time: '12m ago',
      read: false,
      type: 'comment'
    },
    {
      id: 'n-3',
      title: '🚀 Sticker slap!',
      body: 'Marcus V. slapped a 💯 sticker onto your Go Sync Engine diagram.',
      time: '1h ago',
      read: true,
      type: 'upvote'
    }
  ]);

  // --- TOAST NOTIFICATION STATE ---
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- POSTS INITIAL DATA ---
  const [posts, setPosts] = useState<Post[]>([
    {
      id: 'post-1',
      author: 'Akash Patel',
      handle: 'u/akash_staff',
      avatar: 'AP',
      isStaff: true,
      timeAgo: '2h ago',
      flair: 'Discussions',
      hub: 'r/TechConnect',
      title: 'Real-time Event Sync Engine in Go & Supabase',
      content: 'Benchmarked 0 unhandled exceptions across 500 concurrent RPC mutations. Tap simulate to view log streaming.',
      mediaType: 'terminal',
      upvotes: 48,
      commentsCount: 19,
      stickers: [
        { emoji: '🚀', count: 4 },
        { emoji: '⚡', count: 3 }
      ],
      comments: [
        {
          id: 'c-1',
          author: 'Sarah Lin',
          avatar: 'SL',
          content: 'Does this handle connection timeouts on edge cold starts?',
          timeAgo: '1h ago',
          upvotes: 6,
          replies: [
            {
              id: 'c-1-1',
              author: 'Akash Patel',
              avatar: 'AP',
              content: 'Yes, exponential backoff retries within 250ms.',
              timeAgo: '45m ago',
              upvotes: 4,
            }
          ]
        }
      ]
    },
    {
      id: 'post-2',
      author: 'Sarah Dev',
      handle: 'u/sarah_codes',
      avatar: 'SD',
      isStaff: false,
      timeAgo: '4h ago',
      flair: 'Help Wanted',
      hub: 'r/TechConnect',
      title: 'PostgreSQL advisory locks vs Redis Mutex on Supabase Free Tier',
      content: 'Evaluating mutex strategies for concurrent post composer submissions. Here is my current lock query:',
      mediaType: 'code',
      codeSnippet: `SELECT pg_try_advisory_xact_lock(hashtext('user_' || auth.uid()::text));`,
      upvotes: 24,
      commentsCount: 5,
      stickers: [
        { emoji: '💡', count: 5 }
      ],
      comments: [
        {
          id: 'c-2',
          author: 'Dan Abramov Fan',
          avatar: 'DA',
          content: 'Advisory locks are perfect if you already run Postgres anyway! No extra server cost.',
          timeAgo: '2h ago',
          upvotes: 8
        }
      ]
    },
    {
      id: 'post-3',
      author: 'Marcus V.',
      handle: 'u/marcus_arch',
      avatar: 'MV',
      isStaff: false,
      timeAgo: '6h ago',
      flair: 'Wins & Demos',
      hub: 'r/DesignCentral',
      title: 'Neobrutalist Redesign: 45% Drop in First Input Delay',
      content: 'Replaced heavy blurred glassmorphic cards with flat brutalist offsets. Inspect metrics below:',
      mediaType: 'chart',
      upvotes: 62,
      commentsCount: 11,
      stickers: [
        { emoji: '💯', count: 8 },
        { emoji: '🔥', count: 6 }
      ],
      comments: []
    },
    {
      id: 'post-4',
      author: 'Community Bot',
      handle: 'u/workconnect_hq',
      avatar: 'WC',
      isStaff: true,
      timeAgo: '1d ago',
      flair: 'Discussions',
      hub: 'r/TechConnect',
      title: 'Poll: Which state management pattern do you prefer in React 19?',
      content: 'Vote below to help guide our upcoming live stage workshop.',
      mediaType: 'poll',
      pollData: {
        options: [
          { id: 1, text: 'Zustand + Immer', votes: 34 },
          { id: 2, text: 'Native Context + useActionState', votes: 52 },
          { id: 3, text: 'TanStack Store', votes: 14 },
        ]
      },
      upvotes: 31,
      commentsCount: 8,
      stickers: [],
      comments: []
    }
  ]);

  // --- LOCK BODY SCROLL WHEN MODALS OPEN ---
  useEffect(() => {
    const isAnyModalOpen = isDrawerOpen || isComposerOpen || Boolean(activeCommentsPost) || isNotificationsOpen;
    document.body.style.overflow = isAnyModalOpen ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isDrawerOpen, isComposerOpen, activeCommentsPost, isNotificationsOpen]);

  // --- ACTIONS ---
  const handleToggleUpvote = (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const nextUpvoted = !p.hasUpvoted;
        return {
          ...p,
          hasUpvoted: nextUpvoted,
          upvotes: nextUpvoted ? p.upvotes + 1 : p.upvotes - 1
        };
      }
      return p;
    }));
  };

  const handleVotePoll = (postId: string, optionId: number) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId && p.pollData && p.pollData.userVoted === undefined) {
        const updatedOptions = p.pollData.options.map(opt => 
          opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
        );
        showToast("Your response has been registered! 🗳️");
        return {
          ...p,
          pollData: {
            ...p.pollData,
            userVoted: optionId,
            options: updatedOptions
          }
        };
      }
      return p;
    }));
  };

  const handleAddSticker = (postId: string, emoji: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        showToast(`Slapped sticker ${emoji} on post! ✨`);
        const stickersCopy = [...p.stickers];
        const existingIdx = stickersCopy.findIndex(s => s.emoji === emoji);
        if (existingIdx !== -1) {
          stickersCopy[existingIdx] = { ...stickersCopy[existingIdx], count: stickersCopy[existingIdx].count + 1 };
        } else {
          stickersCopy.push({ emoji, count: 1 });
        }
        return { ...p, stickers: stickersCopy };
      }
      return p;
    }));
  };

  const handleSimulateEvent = () => {
    const newCount = simulatedEvents + 1;
    setSimulatedEvents(newCount);
    const log = `[event #${newCount}] Payload synced successfully in 18ms`;
    setTerminalLogs(prev => [log, ...prev.slice(0, 3)]);
    showToast("Event simulated in Go Sidecar Engine! ⚡");
  };

  const handleCopyCode = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopyCodeSuccess(true);
    showToast("Code copied to clipboard! 📋");
    setTimeout(() => setCopyCodeSuccess(false), 2000);
  };

  const handleUpvoteComment = (commentId: string) => {
    if (!activeCommentsPost) return;
    
    const updatedComments = activeCommentsPost.comments.map(c => {
      if (c.id === commentId) {
        const nextVal = !c.hasUpvoted;
        return {
          ...c,
          hasUpvoted: nextVal,
          upvotes: nextVal ? c.upvotes + 1 : c.upvotes - 1
        };
      }
      return c;
    });

    setPosts(prev => prev.map(p => {
      if (p.id === activeCommentsPost.id) {
        const upPost = { ...p, comments: updatedComments };
        setActiveCommentsPost(upPost);
        return upPost;
      }
      return p;
    }));
    showToast("Comment upvoted!");
  };

  const handleSendComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCommentText.trim() || !activeCommentsPost) return;

    const freshComment: Comment = {
      id: `c-guest-${Date.now()}`,
      author: currentUser.name,
      avatar: 'AP',
      content: newCommentText,
      timeAgo: 'Just now',
      upvotes: 1,
      replies: []
    };

    setPosts(prev => prev.map(p => {
      if (p.id === activeCommentsPost.id) {
        const updatedPost = {
          ...p,
          comments: [...p.comments, freshComment],
          commentsCount: p.commentsCount + 1
        };
        setActiveCommentsPost(updatedPost);
        return updatedPost;
      }
      return p;
    }));

    setNewCommentText('');
    showToast("Constructive reply posted! 💬");
  };

  const handlePublishPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast("Please write a punchy title!");
      return;
    }

    const newCreatedPost: Post = {
      id: `post-${Date.now()}`,
      author: currentUser.name,
      handle: currentUser.handle,
      avatar: 'AP',
      isStaff: currentUser.isStaff,
      timeAgo: 'Just now',
      flair: formFlair,
      hub: currentHub,
      title: formTitle,
      content: formContent || "Empty description notes",
      upvotes: 1,
      hasUpvoted: true,
      commentsCount: 0,
      comments: [],
      stickers: []
    };

    if (formMediaType === 'code') {
      newCreatedPost.mediaType = 'code';
      newCreatedPost.codeSnippet = formCodeSnippet;
    } else if (formMediaType === 'poll') {
      newCreatedPost.mediaType = 'poll';
      newCreatedPost.pollData = {
        options: formPollOptions
          .filter(opt => opt.trim() !== '')
          .map((opt, idx) => ({ id: idx + 1, text: opt, votes: 0 }))
      };
    }

    setPosts([newCreatedPost, ...posts]);
    setIsComposerOpen(false);
    
    setFormTitle('');
    setFormContent('');
    setFormFlair('Discussions');
    setFormMediaType('none');

    showToast(`Published to ${currentHub}! 🚀`);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast("All notifications marked as read! ✔");
  };

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (post.hub !== currentHub) return false;

      const matchesFlair = activeFlair === 'All' || post.flair === activeFlair;
      const matchesQuery = searchQuery.trim() === '' || 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFlair && matchesQuery;
    });
  }, [posts, activeFlair, searchQuery, currentHub]);

  // Flair Counts
  const flairCounts = useMemo(() => {
    const counts: Record<string, number> = { All: posts.filter(p => p.hub === currentHub).length };
    posts.filter(p => p.hub === currentHub).forEach(p => {
      counts[p.flair] = (counts[p.flair] || 0) + 1;
    });
    return counts;
  }, [posts, currentHub]);

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-[#F4F0EA] text-black font-sans selection:bg-[#FFC900] relative flex justify-center py-0 md:py-6">
      
      {/* Dynamic Toast System */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#00F59B] border-2 border-black px-4 py-2 text-xs font-black shadow-[3px_3px_0_#000] rounded-lg animate-bounce text-center">
          {toastMessage}
        </div>
      )}

      {/* DEVICE WRAPPER PHONE SIMULATION */}
      <div className="w-full max-w-[395px] min-h-screen md:min-h-[812px] md:max-h-[860px] bg-[#F4F0EA] flex flex-col relative md:border-[4px] border-black md:rounded-[36px] md:shadow-[12px_12px_0px_#000] overflow-hidden">
        
        {/* Device Speaker Notch for desktop simulation */}
        <div className="hidden md:flex absolute top-0 left-0 right-0 h-7 bg-[#FFC900] z-50 items-center justify-center gap-1.5 border-b-2 border-black">
          <div className="w-14 h-3 bg-black rounded-full flex items-center justify-center">
            <div className="w-10 h-1 bg-zinc-800 rounded-full"></div>
          </div>
          <div className="w-3 h-3 bg-black rounded-full"></div>
        </div>

        {/* 
          1. TOP STICKY APP BAR (Focused & Optimized)
          Contract: Bright yellow background (#FFC900) with a 2px black bottom border.
          Ergonomic components according to high-impact brutalism specifications.
        */}
        <header className="sticky top-0 md:top-7 z-40 bg-[#FFC900] border-b-3 border-black px-3 py-2.5 shadow-[0_2.5px_0px_#000000] flex items-center justify-between gap-1.5 shrink-0 select-none">
          
          {/* Left Slot: Black hamburger menu button */}
          <button 
            onClick={() => {
              setIsDrawerOpen(true);
              showToast("Opening community channel list.");
            }}
            className="w-10 h-10 bg-black border-2 border-black text-[#FFC900] shadow-[2px_2px_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center cursor-pointer hover:bg-zinc-900"
            title="Open Channels Menu"
            aria-label="Open Channels Menu"
          >
            <Menu size={20} strokeWidth={3} />
          </button>

          {/* Center Slot: Chunky Pill Switche button */}
          <div className="relative">
            <button 
              onClick={() => setIsHubDropdownOpen(!isHubDropdownOpen)}
              className="px-3 py-1.5 bg-white border-2 border-black rounded-full text-xs font-black uppercase tracking-tight shadow-[2px_2px_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center gap-1 hover:bg-[#FF90E8]"
            >
              <span>{currentHub}</span>
              <ChevronDown size={12} strokeWidth={3} />
            </button>

            {isHubDropdownOpen && (
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-44 bg-white border-2 border-black shadow-[4px_4px_0_#000] z-50 overflow-hidden rounded-xl">
                <div className="text-[9px] font-black uppercase text-zinc-500 bg-zinc-100 px-2 py-1 border-b border-black">
                  Select Server
                </div>
                {['r/TechConnect', 'r/DesignCentral', 'r/SoloSprints'].map(hub => (
                  <button
                    key={hub}
                    onClick={() => {
                      setCurrentHub(hub);
                      setActiveFlair('All');
                      setIsHubDropdownOpen(false);
                      showToast(`Navigated to ${hub}!`);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-black hover:bg-[#FFC900] border-b border-black last:border-b-0 transition-colors flex items-center gap-1.5 ${
                      currentHub === hub ? 'bg-[#FF90E8]/40' : ''
                    }`}
                  >
                    <span className="text-[10px]">🏢</span>
                    <span>{hub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Slot: Search toggle & Avatar box with 2px border */}
          <div className="flex items-center gap-1.5">
            {/* Search toggler */}
            <button 
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                showToast(isSearchOpen ? "Search dismissed." : "Focusing search filter...");
              }}
              className={`w-9 h-9 border-2 border-black rounded-lg flex items-center justify-center transition-all shadow-[2px_2px_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer ${
                isSearchOpen ? 'bg-[#23A9FA]' : 'bg-white hover:bg-zinc-100'
              }`}
              aria-label="Toggle Search Overlay"
            >
              <Search size={16} strokeWidth={3} />
            </button>

            {/* Notifications Bell */}
            <button 
              onClick={() => {
                setIsNotificationsOpen(true);
                showToast("Opening alerts box.");
              }}
              className="w-9 h-9 bg-white border-2 border-black rounded-lg flex items-center justify-center transition-all shadow-[2px_2px_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer relative hover:bg-[#00F59B]"
              aria-label="Activity Notifications"
            >
              <Bell size={16} strokeWidth={2.5} />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FF90E8] text-black text-[8px] font-black w-4 h-4 rounded-full border border-black flex items-center justify-center">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* SEARCH WIDGET FLYOUT INSIDE THE APP BAR CONTEXT */}
        {isSearchOpen && (
          <div className="bg-white border-b-2 border-black px-3 py-2 flex items-center gap-1.5 shrink-0 animate-slide-up select-none">
            <div className="relative flex-1">
              <input 
                type="text"
                placeholder={`Search posts in ${currentHub}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2.5 py-1.5 bg-[#F4F0EA] border-2 border-black rounded-lg text-xs font-bold placeholder:text-zinc-600 focus:outline-none focus:bg-[#FF90E8]/5"
                autoFocus
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-700" strokeWidth={3} />
            </div>
            <button 
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
                showToast("Filters reset.");
              }}
              className="text-[10px] font-black border border-black bg-[#FF90E8] px-2 py-1.5 shadow-[1.5px_1.5px_0_#000] active:translate-y-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* VOICE STAGE HEADER FLOATING COMPONENT */}
        {isListeningToStage && (
          <div className="bg-[#E8F4FE] border-b-2 border-black px-3 py-1.5 flex items-center justify-between text-[11px] font-black shadow-[0_1.5px_0_#000] shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </span>
              <span className="uppercase tracking-tight text-[10px] font-extrabold">stage active (sarah speaking)</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  setIsMuted(!isMuted);
                  showToast(isMuted ? "Audio stream live" : "Mic audio muted");
                }}
                className={`px-1.5 py-0.5 border border-black rounded text-[8px] font-black uppercase ${
                  isMuted ? 'bg-[#FF90E8]' : 'bg-white'
                }`}
              >
                {isMuted ? "Muted" : "Active"}
              </button>
              <button 
                onClick={() => {
                  setIsListeningToStage(false);
                  showToast("Left stage channel.");
                }}
                className="bg-red-500 text-white px-1.5 py-0.5 border border-black rounded text-[8px] font-bold"
              >
                Exit
              </button>
            </div>
          </div>
        )}

        {/* SCROLLABLE MOBILE BODY VIEWPORT */}
        <div className="flex-1 overflow-y-auto pb-[76px] scrollbar-none bg-[#F4F0EA]">
          
          {activeTab === 'feed' && (
            <>
              {/* 2. HORIZONTAL FLAIR CAROUSEL */}
              <section className="px-3 pt-3.5 pb-1">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                  {(['All', 'Announcements', 'Discussions', 'Wins & Demos', 'Help Wanted'] as FlairType[]).map((flair) => {
                    const isActive = activeFlair === flair;
                    const count = flairCounts[flair] || 0;
                    const isRestricted = flair === 'Announcements' && !currentUser.isStaff;

                    return (
                      <button
                        key={flair}
                        onClick={() => {
                          if (isRestricted) {
                            showToast("Announcements restricted to Admin publishing.");
                            return;
                          }
                          setActiveFlair(flair);
                          showToast(`Filtering by [${flair}]`);
                        }}
                        className={`whitespace-nowrap flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-black text-xs font-black transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-[#FF90E8] shadow-[2.5px_2.5px_0_#000] translate-x-[-1px] translate-y-[-1px]' 
                            : 'bg-white shadow-[1.5px_1.5px_0_#000] hover:bg-zinc-100'
                        } ${isRestricted ? 'opacity-65 bg-zinc-200 cursor-not-allowed' : ''}`}
                      >
                        {isRestricted && <Lock size={10} className="text-zinc-600" />}
                        <span>{flair}</span>
                        <span className="text-[9px] px-1 bg-black/10 rounded font-mono">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ACTIVE FILTER BANNER */}
              {(activeFlair !== 'All' || searchQuery) && (
                <div className="mx-3 mt-1 bg-[#23A9FA]/10 border-2 border-dashed border-black p-2 flex items-center justify-between text-[11px] font-black">
                  <span className="truncate">
                    Showing: {activeFlair !== 'All' ? `[${activeFlair}] ` : ''}
                    {searchQuery ? `"${searchQuery}"` : ''}
                  </span>
                  <button 
                    onClick={() => {
                      setActiveFlair('All');
                      setSearchQuery('');
                      showToast("All filters cleared!");
                    }}
                    className="text-[10px] underline hover:text-[#FF90E8]"
                  >
                    Clear Filter
                  </button>
                </div>
              )}

              {/* 3. REDDIT-STYLE NEOBRUTALIST FEED */}
              <div className="px-3 space-y-4 pt-2">
                {filteredPosts.length === 0 ? (
                  <div className="bg-white border-3 border-black rounded-2xl p-6 text-center shadow-[4px_4px_0_#000] my-2">
                    <HelpCircle size={32} className="mx-auto mb-2 text-[#FF90E8]" strokeWidth={2.5} />
                    <h3 className="font-black text-sm">No posts here yet!</h3>
                    <p className="text-[11px] text-zinc-600 mt-1 font-semibold leading-relaxed">
                      {activeFlair === 'Announcements' 
                        ? 'Only hub admins and staff members can publish announcements here.' 
                        : `Be the first to share an update, query, or project win to the ${currentHub} feed!`}
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                      <button 
                        onClick={() => {
                          setActiveFlair('All');
                          showToast("Cleared active category filter.");
                        }}
                        className="px-3 py-1 bg-[#FFC900] border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0_#000]"
                      >
                        Clear Filter
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredPosts.map(post => (
                    <article 
                      key={post.id} 
                      className="bg-white border-3 border-black rounded-2xl p-3.5 shadow-[4px_4px_0_#000] transition-all hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#000]"
                    >
                      {/* Post Header */}
                      <div className="flex items-center justify-between gap-1.5 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#23A9FA] border-2 border-black flex items-center justify-center font-black text-xs text-white shadow-[1.5px_1.5px_0_#000]">
                            {post.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-xs">{post.author}</span>
                              {post.isStaff && (
                                <span className="bg-[#FFC900] text-black text-[8px] font-black uppercase px-1 rounded border border-black leading-tight">
                                  STAFF
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-zinc-500 font-mono block">{post.handle} · {post.timeAgo}</span>
                          </div>
                        </div>

                        {/* Flair Sticker */}
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border-2 border-black shadow-[1.5px_1.5px_0_#000] ${
                          post.flair === 'Help Wanted' ? 'bg-[#FF90E8]' :
                          post.flair === 'Wins & Demos' ? 'bg-[#00F59B]' : 'bg-[#FFC900]'
                        }`}>
                          {post.flair}
                        </span>
                      </div>

                      {/* Title & Content */}
                      <h2 
                        onClick={() => {
                          setActiveCommentsPost(post);
                          showToast("Opening comment thread.");
                        }}
                        className="font-black text-sm tracking-tight leading-snug mb-1.5 cursor-pointer hover:text-[#23A9FA] break-words"
                      >
                        {post.title}
                      </h2>
                      <p className="text-[11px] text-zinc-700 leading-relaxed font-semibold mb-3 break-words">
                        {post.content}
                      </p>

                      {/* DYNAMIC WIDGET PREVIEWS */}
                      {post.mediaType === 'terminal' && (
                        <div className="mb-3 bg-black text-[#00F59B] p-3 rounded-xl border-2 border-black font-mono text-[11px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-zinc-400 text-[10px]">
                            <span className="font-bold text-[9px]">LSN STATE: ACTIVE · SYNCED: {simulatedEvents}</span>
                            <button 
                              onClick={handleSimulateEvent}
                              className="px-2 py-0.5 bg-[#00F59B] text-black font-black rounded border border-black active:scale-95 cursor-pointer text-[9px]"
                            >
                              ⚡ Simulate Event
                            </button>
                          </div>
                          <div className="mt-2 space-y-1 text-[10px]">
                            {terminalLogs.map((log, i) => (
                              <div key={i} className="truncate">{log}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {post.mediaType === 'code' && post.codeSnippet && (
                        <div className="mb-3 relative bg-zinc-900 text-[#FFC900] p-3 rounded-xl border-2 border-black font-mono text-[11px]">
                          <div className="flex justify-between items-center pb-1 text-zinc-400 text-[9px]">
                            <span>SQL Advisory lock schema</span>
                            <button 
                              onClick={() => handleCopyCode(post.codeSnippet!)}
                              className="flex items-center gap-1 text-[10px] text-white bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-600 hover:bg-zinc-700 active:scale-95 cursor-pointer"
                            >
                              {copyCodeSuccess ? <CheckCircle2 size={10} className="text-emerald-400" /> : <Code size={10} />}
                              <span>{copyCodeSuccess ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <pre className="overflow-x-auto pt-1 text-[10px] leading-relaxed">{post.codeSnippet}</pre>
                        </div>
                      )}

                      {post.mediaType === 'chart' && (
                        <div className="mb-3 bg-[#E8F4FE] p-2.5 rounded-xl border-2 border-black">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase flex items-center gap-1">
                              <BarChart3 size={12} /> FID Metrics (ms)
                            </span>
                            <div className="flex gap-1">
                              {(['Mon', 'Wed', 'Fri'] as const).map(day => (
                                <button
                                  key={day}
                                  onClick={() => {
                                    setSelectedChartDay(day);
                                    showToast(`Inspecting First Input Delay for ${day}`);
                                  }}
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border border-black ${
                                    selectedChartDay === day ? 'bg-[#FF90E8]' : 'bg-white'
                                  }`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="h-16 flex items-end justify-between gap-2.5 px-2 pt-2 bg-white rounded-lg border border-black relative">
                            <div 
                              onClick={() => { setSelectedChartDay('Mon'); showToast('Monday latency: 48ms'); }}
                              className={`w-1/3 border border-black rounded-t flex flex-col justify-end items-center text-[9px] font-bold transition-all cursor-pointer ${
                                selectedChartDay === 'Mon' ? 'bg-[#FF90E8] h-[85%]' : 'bg-zinc-200 h-[65%]'
                              }`}
                            >
                              <span className="text-[8px] mb-0.5">Mon</span>
                              <span className="bg-white/80 border-t border-black text-[8px] w-full text-center">48ms</span>
                            </div>

                            <div 
                              onClick={() => { setSelectedChartDay('Wed'); showToast('Wednesday latency: 32ms'); }}
                              className={`w-1/3 border border-black rounded-t flex flex-col justify-end items-center text-[9px] font-bold transition-all cursor-pointer ${
                                selectedChartDay === 'Wed' ? 'bg-[#FFC900] h-[65%]' : 'bg-zinc-200 h-[45%]'
                              }`}
                            >
                              <span className="text-[8px] mb-0.5">Wed</span>
                              <span className="bg-white/80 border-t border-black text-[8px] w-full text-center">32ms</span>
                            </div>

                            <div 
                              onClick={() => { setSelectedChartDay('Fri'); showToast('Friday latency: 18ms'); }}
                              className={`w-1/3 border border-black rounded-t flex flex-col justify-end items-center text-[9px] font-bold transition-all cursor-pointer ${
                                selectedChartDay === 'Fri' ? 'bg-[#00F59B] h-[45%]' : 'bg-zinc-200 h-[30%]'
                              }`}
                            >
                              <span className="text-[8px] mb-0.5">Fri</span>
                              <span className="bg-white/80 border-t border-black text-[8px] w-full text-center">18ms</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {post.mediaType === 'poll' && post.pollData && (
                        <div className="mb-3 bg-[#FFFEE0] p-2.5 rounded-xl border-2 border-black space-y-1.5">
                          <div className="text-[10px] font-black uppercase mb-1">Live Survey:</div>
                          {post.pollData.options.map(option => {
                            const totalVotes = post.pollData!.options.reduce((acc, o) => acc + o.votes, 0);
                            const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                            const hasVotedThis = post.pollData!.userVoted === option.id;

                            return (
                              <button
                                key={option.id}
                                disabled={post.pollData!.userVoted !== undefined}
                                onClick={() => handleVotePoll(post.id, option.id)}
                                className={`w-full text-left p-1.5 rounded-lg border-2 border-black relative overflow-hidden text-[11px] font-bold transition-all cursor-pointer ${
                                  hasVotedThis ? 'bg-[#FF90E8]' : 'bg-white hover:bg-zinc-50'
                                }`}
                              >
                                <div 
                                  className="absolute left-0 top-0 bottom-0 bg-[#00F59B]/40 pointer-events-none transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="relative flex justify-between z-10 pointer-events-none">
                                  <span>{option.text}</span>
                                  <span className="font-mono text-[10px] font-black">{pct}% ({option.votes})</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Stickers attached */}
                      {post.stickers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {post.stickers.map((s, idx) => (
                            <span 
                              key={idx} 
                              className="px-2 py-0.5 bg-white border border-black rounded-full text-[10px] shadow-[1px_1px_0_#000] rotate-[-2deg] font-extrabold flex items-center gap-1"
                            >
                              <span>{s.emoji}</span>
                              <span className="text-[8px] bg-[#F4F0EA] px-1 rounded-full">{s.count}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Interaction Bar */}
                      <div className="flex items-center justify-between border-t-2 border-black/10 pt-2.5">
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleToggleUpvote(post.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 border-black text-[11px] font-black shadow-[1.5px_1.5px_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer ${
                              post.hasUpvoted ? 'bg-[#FFC900]' : 'bg-white hover:bg-zinc-50'
                            }`}
                          >
                            <ArrowUp size={12} strokeWidth={3} className={post.hasUpvoted ? 'text-black' : 'text-zinc-600'} />
                            <span>{post.upvotes}</span>
                          </button>

                          <button 
                            onClick={() => {
                              setActiveCommentsPost(post);
                              showToast("Open discussions window.");
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border-2 border-black text-[11px] font-black shadow-[1.5px_1.5px_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer hover:bg-zinc-100"
                          >
                            <MessageSquare size={11} strokeWidth={2.5} />
                            <span>{post.commentsCount}</span>
                          </button>
                        </div>

                        {/* Sticker Slap Quick Actions */}
                        <div className="flex items-center gap-1">
                          {['🚀', '🔥', '💡', '💯'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => handleAddSticker(post.id, emoji)}
                              className="w-6 h-6 bg-white border border-black rounded-md flex items-center justify-center text-xs shadow-[1px_1px_0_#000] hover:scale-110 active:scale-95 transition-transform cursor-pointer hover:bg-[#FF90E8]"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </>
          )}

          {/* SIMULATED STAGE CONTROLLER VIEW */}
          {activeTab === 'stages' && (
            <div className="p-4 space-y-4">
              <div className="bg-white border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0_#000]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                    <span className="text-[10px] font-black uppercase text-zinc-500">Active Broadcast Room</span>
                  </div>
                  <span className="text-xs font-bold text-[#23A9FA] font-mono">r/TechConnect</span>
                </div>
                
                <h3 className="font-black text-sm mb-1">🎙 demo-stage: Go Benchmarking & Hydration</h3>
                <p className="text-[11px] text-zinc-600 font-semibold mb-3">
                   discussing Advisory locks vs Redis cluster with Akash, Sarah, and the core team.
                </p>

                {/* Speaker Matrix */}
                <div className="space-y-2 border-t border-black pt-3">
                  <span className="block text-[10px] font-black uppercase text-zinc-400">Speakers Panel</span>
                  {stageParticipants.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-[#F4F0EA] p-2 border border-black rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{p.avatar}</span>
                        <div>
                          <span className="font-black text-xs block">{p.name}</span>
                          <span className="text-[9px] text-zinc-500 block leading-tight">{p.role}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p.isSpeaking && (
                          <span className="text-[9px] bg-[#00F59B] border border-black px-1 rounded-sm font-bold animate-pulse">SPEAKING</span>
                        )}
                        <span className="text-xs">{p.isMuted ? '🔇' : '🎙️'}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Connection button */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      setIsListeningToStage(!isListeningToStage);
                      showToast(isListeningToStage ? "Disconnected from demo-stage" : "Joined live audio stream stage! 🎙");
                    }}
                    className={`flex-1 py-2 text-xs font-black border-2 border-black rounded-lg shadow-[2.5px_2.5px_0_#000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer ${
                      isListeningToStage ? 'bg-red-500 text-white' : 'bg-[#00F59B]'
                    }`}
                  >
                    {isListeningToStage ? '🔴 Stop Listening' : '🟢 Listen Live (3 Speaker)'}
                  </button>

                  <button
                    onClick={() => {
                      if (!isListeningToStage) {
                        showToast("Please join the stage first!");
                        return;
                      }
                      setIsMuted(!isMuted);
                      showToast(isMuted ? "Unmuted microphone" : "Microphone muted");
                    }}
                    className="p-2 bg-white border-2 border-black rounded-lg shadow-[2.5px_2.5px_0_#000] active:translate-y-0.5 active:shadow-none cursor-pointer"
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* 7. PROFILE CONSOLE VIEW */}
          {activeTab === 'profile' && (
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b-2 border-black">
                <h2 className="font-black text-sm uppercase">Studio Member Console</h2>
                <button 
                  onClick={() => {
                    setActiveTab('feed');
                    showToast("Returned to feeds.");
                  }}
                  className="px-2 py-0.5 bg-[#FFC900] border-2 border-black rounded text-[10px] font-black shadow-[1.5px_1.5px_0_#000]"
                >
                  ✕ Exit
                </button>
              </div>

              {/* Profile Detail Card */}
              <div className="bg-white border-3 border-black rounded-2xl p-4 shadow-[4px_4px_0_#000] flex items-center gap-3">
                <div className="w-12 h-12 bg-[#FF90E8] border-3 border-black rounded-xl flex items-center justify-center font-black text-lg shadow-[2px_2px_0_#000]">
                  AP
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-xs">{currentUser.name}</h3>
                    <span className="text-[8px] bg-[#00F59B] border border-black px-1 rounded font-black">STAFF ADMIN</span>
                  </div>
                  <p className="text-zinc-600 font-mono text-[10px]">{currentUser.handle}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[9px] font-black bg-[#FFE600] px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0_#000]">
                      REPUTATION: {currentUser.reputation} XP
                    </span>
                  </div>
                </div>
              </div>

              {/* Metrics block */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FFFEE0] p-3 border-2 border-black rounded-xl text-center shadow-[2px_2px_0_#000]">
                  <span className="block text-xl font-black leading-none">{posts.length}</span>
                  <span className="text-[8px] font-black text-zinc-500 uppercase">Articles Published</span>
                </div>
                <div className="bg-[#E8F4FE] p-3 border-2 border-black rounded-xl text-center shadow-[2px_2px_0_#000]">
                  <span className="block text-xl font-black leading-none">{currentUser.curatedCount}</span>
                  <span className="text-[8px] font-black text-zinc-500 uppercase">Curated Digest Items</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* DISCORD-STYLE SLIDING LEFT DRAWER */}
        {isDrawerOpen && (
          <div className="absolute inset-0 z-50 flex">
            <div 
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <div className="relative w-[280px] bg-white border-r-3 border-black flex h-full shadow-[4px_0_0_#000] z-10 animate-slide-in-left">
              <div className="w-13 bg-[#FFC900] border-r-2 border-black flex flex-col items-center py-4 gap-3">
                <div className="w-8 h-8 rounded-xl bg-white border-2 border-black flex items-center justify-center font-black text-[10px] shadow-[2px_2px_0_#000]">
                  WC
                </div>
                <div className="w-6 h-[2px] bg-black" />
                {['TC', 'DC', 'SS'].map((srv, i) => {
                  const label = srv === 'TC' ? 'r/TechConnect' : srv === 'DC' ? 'r/DesignCentral' : 'r/SoloSprints';
                  const active = currentHub === label;
                  return (
                    <button
                      key={srv}
                      onClick={() => {
                        setCurrentHub(label);
                        setActiveFlair('All');
                        setIsDrawerOpen(false);
                        showToast(`Switched space to ${label}! 💻`);
                      }}
                      className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center text-[10px] font-black shadow-[2px_2px_0_#000] active:scale-95 cursor-pointer ${
                        active ? 'bg-[#FF90E8]' : 'bg-white'
                      }`}
                    >
                      {srv}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 flex flex-col justify-between p-4 overflow-y-auto bg-[#F4F0EA]">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-3">
                    <div>
                      <h3 className="font-black text-xs">{currentHub}</h3>
                      <span className="text-[9px] font-mono text-zinc-600">14 active members</span>
                    </div>
                    <button onClick={() => setIsDrawerOpen(false)} className="p-1 border border-black bg-white rounded">
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[9px] font-black uppercase text-zinc-500 px-2 py-1">Channels List</div>
                    {[
                      { name: 'announcements', flair: 'Announcements', locked: true },
                      { name: 'general-chat', flair: 'Discussions' },
                      { name: 'wins-and-demos', flair: 'Wins & Demos' },
                      { name: 'help-desk', flair: 'Help Wanted' },
                    ].map(ch => (
                      <button
                        key={ch.name}
                        onClick={() => {
                          if (ch.locked && !currentUser.isStaff) {
                            showToast("Announcements channel is read-only for guest tiers.");
                            return;
                          }
                          setActiveFlair(ch.flair as FlairType);
                          setIsDrawerOpen(false);
                          showToast(`Joined channel #${ch.name}!`);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[11px] font-bold border border-transparent hover:border-black hover:bg-[#FFC900] transition-all cursor-pointer ${
                          activeFlair === ch.flair ? 'bg-white border-black shadow-[1.5px_1.5px_0_#000]' : ''
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <span className="text-zinc-500 font-mono">#</span>
                          <span>{ch.name}</span>
                        </span>
                        {ch.locked && <Lock size={10} className="text-zinc-500" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t-2 border-black flex items-center justify-between bg-white p-2 rounded-xl border-2 border-black shadow-[1.5px_1.5px_0_#000]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 rounded bg-[#FF90E8] border-2 border-black flex items-center justify-center font-black text-[10px]">
                      AP
                    </div>
                    <div className="text-[10px] font-bold leading-tight">
                      <div className="font-black">{currentUser.name}</div>
                      <div className="text-zinc-500 font-mono text-[8px]">Rep: {currentUser.reputation}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* THREADED COMMENTS BOTTOM SHEET */}
        {activeCommentsPost && (
          <div className="absolute inset-0 z-50 flex items-end justify-center">
            <div 
              onClick={() => setActiveCommentsPost(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <div className="relative w-full bg-white border-t-3 border-black rounded-t-3xl max-h-[80%] flex flex-col z-10 shadow-[0_-4px_0_#000] animate-slide-up">
              <div className="p-3 border-b-2 border-black flex items-center justify-between bg-[#FFC900] rounded-t-[21px]">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} strokeWidth={2.5} />
                  <span className="font-black text-xs">Comments ({activeCommentsPost.commentsCount})</span>
                </div>
                <button onClick={() => setActiveCommentsPost(null)} className="w-5 h-5 bg-white rounded border-2 border-black flex items-center justify-center font-black text-[10px]">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 overscroll-contain bg-[#F4F0EA]">
                <div className="pb-3 border-b border-zinc-200 bg-white p-3 border-2 border-black shadow-[2px_2px_0_#000] rounded-xl">
                  <h4 className="font-black text-xs leading-snug">{activeCommentsPost.title}</h4>
                  <p className="text-[10px] text-zinc-600 mt-1">{activeCommentsPost.content}</p>
                </div>

                {activeCommentsPost.comments.length === 0 ? (
                  <div className="text-center py-8 bg-white border-2 border-dashed border-black rounded-xl text-xs text-zinc-500 font-bold p-4">
                    No replies yet. Be the first to start the thread!
                  </div>
                ) : (
                  activeCommentsPost.comments.map(c => (
                    <div key={c.id} className="space-y-1.5">
                      <div className="p-2.5 bg-white rounded-xl border-2 border-black shadow-[1.5px_1.5px_0_#000] text-xs">
                        <div className="flex justify-between items-center font-black text-[10px] border-b border-zinc-100 pb-1 mb-1">
                          <span>{c.author}</span>
                          <button onClick={() => handleUpvoteComment(c.id)} className="bg-zinc-100 border border-black rounded-sm px-1 text-[8px] font-black">
                            ▲ {c.upvotes}
                          </button>
                        </div>
                        <p className="text-zinc-700 font-semibold">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendComment} className="p-3 border-t-2 border-black bg-white flex items-center gap-2">
                <input 
                  type="text"
                  placeholder="Write a constructive reply..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-50 border-2 border-black rounded-xl text-xs font-bold focus:outline-none"
                />
                <button type="submit" className="p-2.5 bg-[#FFC900] border-2 border-black rounded-xl shadow-[2px_2px_0_#000]">
                  <Send size={13} strokeWidth={2.5} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* COMPOSER MODAL */}
        {isComposerOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            <div onClick={() => setIsComposerOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-xs" />
            <div className="relative w-full max-w-[340px] bg-white border-3 border-black rounded-2xl shadow-[5px_5px_0_#000] z-10 overflow-hidden flex flex-col max-h-[85%] animate-slide-up">
              <div className="px-3.5 py-2.5 bg-[#FF90E8] border-b-3 border-black flex justify-between items-center">
                <h3 className="font-black text-xs">Create Publication</h3>
                <button onClick={() => setIsComposerOpen(false)} className="w-5 h-5 bg-white rounded border-2 border-black flex items-center justify-center font-black text-[10px]">✕</button>
              </div>

              <form onSubmit={handlePublishPost} className="p-3.5 space-y-3 overflow-y-auto bg-[#F4F0EA]">
                <div>
                  <label className="block text-[10px] font-black uppercase mb-1">Select Category</label>
                  <select value={formFlair} onChange={(e) => setFormFlair(e.target.value as FlairType)} className="w-full px-2.5 py-1.5 bg-white border-2 border-black rounded-xl text-xs font-bold focus:outline-none">
                    <option value="Discussions">💬 Discussions</option>
                    <option value="Wins & Demos">🏆 Wins & Demos</option>
                    <option value="Help Wanted">💡 Help Wanted</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase mb-1">Title</label>
                  <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border-2 border-black rounded-xl text-xs font-bold focus:outline-none" required />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase mb-1">Content</label>
                  <textarea rows={3} value={formContent} onChange={(e) => setFormContent(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border-2 border-black rounded-xl text-xs font-medium focus:outline-none resize-none" />
                </div>

                <button type="submit" className="w-full py-2 bg-[#00F59B] text-black border-2 border-black rounded-xl font-black text-xs shadow-[2.5px_2.5px_0_#000]">Publish 🚀</button>
              </form>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS BOX MODAL */}
        {isNotificationsOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            <div onClick={() => setIsNotificationsOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-xs" />
            <div className="relative w-full max-w-[320px] bg-white border-3 border-black rounded-2xl shadow-[5px_5px_0_#000] z-10 overflow-hidden flex flex-col max-h-[75%] animate-slide-up">
              <div className="px-3.5 py-2.5 bg-[#FFC900] border-b-3 border-black flex justify-between items-center">
                <span className="font-black text-xs uppercase">Activity Alerts</span>
                <button onClick={() => setIsNotificationsOpen(false)} className="w-5 h-5 bg-white rounded border-2 border-black flex items-center justify-center font-black text-[9px]">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#F4F0EA]">
                {notifications.map(n => (
                  <div key={n.id} className="p-2.5 rounded-xl border-2 border-black bg-white">
                    <span className="block text-[8px] font-black text-zinc-400">{n.time}</span>
                    <p className="text-[10px] font-bold text-zinc-800 leading-tight">{n.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 
          2. STICKY BOTTOM DOCK (Optimized Mobile Ergonomics)
          Contract: Fixed white bar with 3px top black border.
          Includes: [Home] · [Channels] · [Lime Plus Action in Lime #00F59B with 4px shadow] · [Stages] · [Profile]
        */}
        <footer className="absolute bottom-0 left-0 right-0 z-40 bg-white border-t-3 border-black shadow-[0_-3px_0px_rgba(0,0,0,1)] select-none">
          <div className="h-16 flex items-center justify-around px-2 relative">
            
            {/* Button 1: [Home / Feed] */}
            <button 
              onClick={() => {
                setActiveTab('feed');
                showToast("Viewing active feed.");
              }}
              className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 text-[9px] font-black cursor-pointer transition-all ${
                activeTab === 'feed' 
                  ? 'text-black bg-[#FF90E8]/20 border-r-2 border-l-2 border-black' 
                  : 'text-zinc-600 hover:text-black hover:bg-zinc-50'
              }`}
            >
              <Home size={18} strokeWidth={activeTab === 'feed' ? 3 : 2} className="transition-transform active:scale-90" />
              <span>Home</span>
            </button>

            {/* Button 2: [Channels Drawer Trigger] */}
            <button 
              onClick={() => {
                setIsDrawerOpen(true);
                showToast("Opening channels list.");
              }}
              className="flex-1 flex flex-col items-center justify-center h-full gap-0.5 text-[9px] font-black text-zinc-600 hover:text-black hover:bg-zinc-50 cursor-pointer border-r-2 border-black"
            >
              <Menu size={18} strokeWidth={2} className="transition-transform active:scale-90" />
              <span>Channels</span>
            </button>

            {/* Button 3: Elevated Center '+' Action in Lime (#00F59B) with 4px shadow */}
            <div className="relative -top-4 w-12 flex items-center justify-center shrink-0">
              <button 
                onClick={() => {
                  setIsComposerOpen(true);
                  showToast("Compiling new publication draft.");
                }}
                className="w-13 h-13 rounded-2xl bg-[#00F59B] border-3 border-black text-black font-black shadow-[4px_4px_0px_#000000] hover:rotate-90 transition-transform duration-300 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center justify-center"
                aria-label="Create New Post"
              >
                <Plus size={24} strokeWidth={3.5} />
              </button>
            </div>

            {/* Button 4: [Stages] */}
            <button 
              onClick={() => {
                setActiveTab('stages');
                showToast("Opening stage panel.");
              }}
              className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 text-[9px] font-black cursor-pointer transition-all border-l-2 border-black border-r-2 border-black ${
                activeTab === 'stages' 
                  ? 'text-black bg-[#23A9FA]/20 font-extrabold' 
                  : 'text-zinc-600 hover:text-black hover:bg-zinc-50'
              }`}
            >
              <Radio 
                size={18} 
                strokeWidth={activeTab === 'stages' ? 3 : 2} 
                className={`transition-transform active:scale-90 ${isListeningToStage ? 'text-red-500 animate-pulse' : ''}`} 
              />
              <span>Stages</span>
            </button>

            {/* Button 5: [Profile Console] */}
            <button 
              onClick={() => {
                setActiveTab('profile');
                showToast("Loading member console statistics.");
              }}
              className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 text-[9px] font-black cursor-pointer transition-all ${
                activeTab === 'profile' 
                  ? 'text-black bg-[#FFC900]/20' 
                  : 'text-zinc-600 hover:text-black hover:bg-zinc-50'
              }`}
            >
              <User size={18} strokeWidth={activeTab === 'profile' ? 3 : 2} className="transition-transform active:scale-90" />
              <span>Profile</span>
            </button>

          </div>
        </footer>

      </div>

    </div>
  );
}

export default WorkConnectHub;
