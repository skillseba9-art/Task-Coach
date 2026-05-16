import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Play, Pause, SkipForward, CheckCircle, 
  Clock, History, Settings, Plus, Trash2, 
  Layout, Save, Download, Search, Tag, AlertCircle, Hourglass,
  ChevronUp, ChevronDown, RefreshCw
} from 'lucide-react';
import { useTimer } from './hooks/useTimer';
import { Storage } from './utils/storage';

// Helper to play a reliable beep sound using Web Audio API
const playBeep = (frequency = 880, duration = 0.2) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.error("Audio API not supported or failed:", e);
  }
};

// Custom Animated Sand Clock SVG Component
const SandClock = ({ progress }) => {
  // progress is 0 to 1 (timeLeft / plannedTime)
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Frame */}
      <path d="M18 2H6V6.5L10.5 11L11.1 11.6C11.5 12 11.5 12.6 11.1 13L10.5 13.6L6 18.1V22H18V18.1L13.5 13.6L12.9 13C12.5 12.6 12.5 12 12.9 11.6L13.5 11L18 6.5V2Z" 
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Top Sand */}
      <path d={`M7.5 4H16.5L12 8.5L7.5 4Z`} fill="currentColor" opacity="0.3" />
      <path d={`M${12 - 4.5 * progress} ${8.5 - 4.5 * progress}H${12 + 4.5 * progress}L12 8.5L${12 - 4.5 * progress} ${8.5 - 4.5 * progress}Z`} fill="currentColor" />
      
      {/* Bottom Sand */}
      <path d={`M7.5 20H16.5L12 15.5L7.5 20Z`} fill="currentColor" opacity="0.3" />
      <path d={`M${12 - 4.5 * (1-progress)} 20H${12 + 4.5 * (1-progress)}L12 ${20 - 4.5 * (1-progress)}L${12 - 4.5 * (1-progress)} 20Z`} fill="currentColor" />
      
      {/* Falling Sand Drop */}
      {progress > 0 && (
        <line x1="12" y1="11" x2="12" y2="13.5" stroke="currentColor" strokeWidth="1" strokeDasharray="1 2">
          <animate attributeName="stroke-dashoffset" from="3" to="0" dur="0.5s" repeatCount="indefinite" />
        </line>
      )}
    </svg>
  );
};

const App = () => {
  // --- State ---
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'history', 'settings', 'templates'
  const [runningTaskId, setRunningTaskId] = useState(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedTag, setSelectedTag] = useState('completed');
  const [settings, setSettings] = useState({
    darkMode: true,
    soundEnabled: true,
    autoPause: true
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [savedTimeLeft, setSavedTimeLeft] = useState(null);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [waitingTaskId, setWaitingTaskId] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const runningTask = useMemo(() => tasks.find(t => t.id === runningTaskId), [tasks, runningTaskId]);

  const onTimerComplete = useCallback(() => {
    if (settings.soundEnabled) {
      // Play a pattern of beeps
      playBeep(880, 0.2);
      setTimeout(() => playBeep(880, 0.2), 300);
      setTimeout(() => playBeep(880, 0.2), 600);
    }
    setShowCompletionModal(true);
  }, [settings.soundEnabled]);

  const { 
    timeLeft, isActive, isPaused, start, pause, resume, stop, addTime, setTimeLeft 
  } = useTimer(0, onTimerComplete);

  // --- Persistence ---
  useEffect(() => {
    const init = async () => {
      const data = await Storage.load();
      if (data) {
        if (data.tasks) setTasks(data.tasks);
        if (data.history) setHistory(data.history);
        if (data.settings) setSettings(data.settings);
        if (data.templates) setTemplates(data.templates);
        if (data.runningTaskId) setRunningTaskId(data.runningTaskId);
        if (data.timeLeft !== undefined) setSavedTimeLeft(data.timeLeft);
      }
    };
    init();
  }, []);

  // Initialize timer after data is loaded - ONLY ONCE on startup
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    if (!isInitialized && savedTimeLeft !== null && runningTaskId) {
      if (savedTimeLeft > 0) {
        start(savedTimeLeft);
        resume();
      } else {
        setRunningTaskId(null);
      }
      setIsInitialized(true);
    } else if (savedTimeLeft === null && !runningTaskId && !isInitialized) {
      // No saved session found
      setIsInitialized(true);
    }
  }, [savedTimeLeft, runningTaskId, isInitialized]);

  const saveData = useCallback(async (newTasks = tasks, newHistory = history, newSettings = settings, newTemplates = templates, newRunningTaskId = runningTaskId, newTimeLeft = timeLeft) => {
    await Storage.save({ 
      tasks: newTasks, 
      history: newHistory, 
      settings: newSettings, 
      templates: newTemplates,
      runningTaskId: newRunningTaskId,
      timeLeft: newTimeLeft
    });
  }, [tasks, history, settings, templates, runningTaskId, timeLeft]);

  // --- IPC Events ---
  useEffect(() => {
    const handlePowerEvent = (type) => {
      if (settings.autoPause) {
        if (type === 'suspend' || type === 'shutdown') {
          pause();
          // Log pause event
          if (runningTaskId) {
            setTasks(prev => prev.map(t => t.id === runningTaskId ? {
              ...t,
              pauseHistory: [...(t.pauseHistory || []), { paused: new Date().toISOString() }]
            } : t));
          }
        } else if (type === 'resume') {
          if (runningTaskId) {
            resume();
            setTasks(prev => prev.map(t => t.id === runningTaskId ? {
              ...t,
              pauseHistory: t.pauseHistory.map((p, i) => i === t.pauseHistory.length - 1 ? { ...p, resumed: new Date().toISOString() } : p)
            } : t));
          }
        }
      }
    };

    window.electronAPI.onPowerEvent(handlePowerEvent);
    return () => window.electronAPI.removePowerListeners();
  }, [settings.autoPause, pause, runningTaskId]);

  // --- Actions ---
  const handleAddTask = () => {
    if (tasks.length === 0) {
      // First time: Add 7 tasks
      const initialTasks = Array.from({ length: 7 }, (_, i) => ({
        id: (Date.now() + i).toString(),
        name: 'New Task ' + (i + 1),
        plannedTime: 3600, // 1 hour
        actualTime: 0,
        status: 'pending',
        priority: 'Medium',
        notes: '',
        tags: [],
        startTime: '',
        endTime: '',
        dateCreated: new Date().toISOString(),
        pauseHistory: []
      }));
      setTasks(initialTasks);
      saveData(initialTasks);
    } else {
      // Not first time: Add 1 task
      const newTask = {
        id: Date.now().toString(),
        name: 'New Task',
        plannedTime: 3600, // 1 hour
        actualTime: 0,
        status: 'pending',
        priority: 'Medium',
        notes: '',
        tags: [],
        startTime: '',
        endTime: '',
        dateCreated: new Date().toISOString(),
        pauseHistory: []
      };
      const updated = [...tasks, newTask];
      setTasks(updated);
      saveData(updated);
    }
  };

  const handleDeleteTask = (id) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    saveData(updated);
    if (runningTaskId === id) {
      stop();
      setRunningTaskId(null);
    }
  };

  const handleMoveTask = (id, direction) => {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;
    
    const newTasks = [...tasks];
    if (direction === 'up' && index > 0) {
      [newTasks[index - 1], newTasks[index]] = [newTasks[index], newTasks[index - 1]];
    } else if (direction === 'down' && index < tasks.length - 1) {
      [newTasks[index + 1], newTasks[index]] = [newTasks[index], newTasks[index + 1]];
    }
    setTasks(newTasks);
    saveData(newTasks);
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (index) => {
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newTasks = [...tasks];
    const draggedItem = newTasks[draggedIndex];
    newTasks.splice(draggedIndex, 1);
    newTasks.splice(index, 0, draggedItem);
    
    setTasks(newTasks);
    saveData(newTasks);
    setDraggedIndex(null);
  };

  const handleClearAllTasks = () => {
    if (window.confirm("Are you sure you want to clear all of today's tasks?")) {
      setTasks([]);
      setRunningTaskId(null);
      stop();
      saveData([], undefined, undefined, undefined, null, 0);
    }
  };

  const handleStartTask = (task) => {
    if (!task || !task.plannedTime || task.plannedTime <= 0) {
      alert("Please set a valid duration for the task before starting.");
      return;
    }
    setWaitingTaskId(null); // Clear waiting state
    setRunningTaskId(task.id);
    start(task.plannedTime);
    
    // Set start time in 24h format if not already set
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    // Auto-calculate end time
    const endTimeDate = new Date(now.getTime() + task.plannedTime * 1000);
    const endTimeStr = endTimeDate.getHours().toString().padStart(2, '0') + ':' + endTimeDate.getMinutes().toString().padStart(2, '0');
    
    setTasks(prev => {
      const updated = prev.map(t => t.id === task.id ? { 
        ...t, 
        startTime: t.startTime && t.startTime !== '00:00' ? t.startTime : timeStr,
        endTime: t.endTime && t.endTime !== '00:00' ? t.endTime : endTimeStr
      } : t);
      saveData(updated, undefined, undefined, undefined, task.id, task.plannedTime);
      return updated;
    });
  };

  const handleStartRoutine = () => {
    if (tasks.length === 0) {
      alert("Please add some tasks before starting the routine.");
      return;
    }
    const firstTask = tasks[0];
    
    // Check if task has a valid HH:mm start time
    const timeMatch = firstTask.startTime && firstTask.startTime.match(/^(\d{1,2}):(\d{1,2})$/);
    
    if (!timeMatch || firstTask.startTime === '00:00') {
      handleStartTask(firstTask);
      return;
    }

    const [h, m] = firstTask.startTime.split(':').map(Number);
    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(h, m, 0, 0);

    // If scheduled time is in the past for today, treat it as "start now"
    const diffMs = scheduled - now;
    if (diffMs <= 0) {
      handleStartTask(firstTask);
    } else {
      alert(`Routine is scheduled for ${firstTask.startTime}. Waiting for the start time...`);
      setWaitingTaskId(firstTask.id);
    }
  };

  // Check waiting task every second
  useEffect(() => {
    if (waitingTaskId) {
      const task = tasks.find(t => t.id === waitingTaskId);
      if (task) {
        const [h, m] = task.startTime.split(':').map(Number);
        const scheduled = new Date();
        scheduled.setHours(h, m, 0, 0);
        if (new Date() >= scheduled) {
          handleStartTask(task);
        }
      }
    }
  }, [currentTime, waitingTaskId, tasks]);

  const handleCompleteTask = () => {
    const actualTime = runningTask.plannedTime - timeLeft;
    const now = new Date();
    const historyItem = {
      ...runningTask,
      actualTime,
      status: selectedTag,
      notes: notes,
      endTime: now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'),
      dateCompleted: now.toISOString()
    };

    const newHistory = [historyItem, ...history];
    const newTasks = tasks.filter(t => t.id !== runningTaskId);

    setHistory(newHistory);
    setTasks(newTasks);
    setRunningTaskId(null);
    setShowCompletionModal(false);
    setNotes('');
    stop();
    saveData(newTasks, newHistory);
    
    // Auto-start next task
    if (newTasks.length > 0) {
      setTimeout(() => handleStartTask(newTasks[0]), 500);
    }
  };

  const handleContinueTask = (mins) => {
    addTime(mins * 60);
    setShowCompletionModal(false);
    resume();
  };

  const handleNextTask = () => {
    if (!runningTask) return setShowCompletionModal(false);
    
    // Current task goes to history as "skipped" or "incomplete"
    const historyItem = {
      ...runningTask,
      actualTime: runningTask.plannedTime - timeLeft,
      status: 'skipped',
      dateCompleted: new Date().toISOString(),
      endTime: new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0')
    };
    const newHistory = [historyItem, ...history];
    const newTasks = tasks.filter(t => t.id !== runningTaskId);
    
    setHistory(newHistory);
    setTasks(newTasks);
    setRunningTaskId(null);
    setShowCompletionModal(false);
    stop();
    saveData(newTasks, newHistory);
    
    // Start next task if exists
    if (newTasks.length > 0) {
      setTimeout(() => handleStartTask(newTasks[0]), 100);
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Status', 'Planned Time (m)', 'Actual Time (m)', 'Date', 'Notes'];
    const rows = history.map(h => [
      h.name,
      h.status,
      Math.round(h.plannedTime / 60),
      Math.round(h.actualTime / 60),
      new Date(h.dateCompleted).toLocaleDateString(),
      h.notes.replace(/,/g, ';')
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'task-history.csv';
    a.click();
  };

  const handleSaveAsTemplate = (name) => {
    if (!name) return;
    const newTemplate = {
      id: Date.now().toString(),
      name,
      tasks: tasks.map(({ id, ...rest }) => rest) // Store task structures without IDs
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    saveData(undefined, undefined, undefined, updated);
  };

  const handleLoadTemplate = (template) => {
    const newTasks = template.tasks.map(t => ({ ...t, id: Date.now().toString() + Math.random() }));
    setTasks(newTasks);
    saveData(newTasks);
    setActiveTab('today');
  };

  // --- Helpers ---
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (item.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [history, searchQuery, filterStatus]);

  const historyByDate = useMemo(() => {
    const groups = {};
    filteredHistory.forEach(item => {
      const date = new Date(item.dateCompleted).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  }, [filteredHistory]);

  const availableDates = useMemo(() => Object.keys(historyByDate).sort((a, b) => new Date(b) - new Date(a)), [historyByDate]);

  // Set initial selected date
  useEffect(() => {
    if (!selectedHistoryDate && availableDates.length > 0) {
      setSelectedHistoryDate(availableDates[0]);
    }
  }, [availableDates]);

  // --- Render ---
  return (
    <div className="app-container">
      {/* Title Bar for Dragging */}
      <div className="title-bar">
        <span>Task Coach</span>
      </div>

      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--accent)', padding: '8px', borderRadius: '12px' }}>
            <Layout className="icon" style={{ color: 'var(--bg-primary)' }} />
          </div>
          <h1 style={{ fontSize: '20px' }}>Task Coach</h1>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
          <button 
            className={`btn btn-ghost ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
            style={{ justifyContent: 'flex-start', background: activeTab === 'today' ? 'var(--bg-accent)' : 'transparent' }}
          >
            <Clock className="icon" /> Today
          </button>
          <button 
            className={`btn btn-ghost ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{ justifyContent: 'flex-start', background: activeTab === 'history' ? 'var(--bg-accent)' : 'transparent' }}
          >
            <History className="icon" /> History
          </button>
          <button 
            className={`btn btn-ghost ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
            style={{ justifyContent: 'flex-start', background: activeTab === 'templates' ? 'var(--bg-accent)' : 'transparent' }}
          >
            <Layout className="icon" /> Templates
          </button>
          <button 
            className={`btn btn-ghost ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            style={{ justifyContent: 'flex-start', background: activeTab === 'settings' ? 'var(--bg-accent)' : 'transparent' }}
          >
            <Settings className="icon" /> Settings
          </button>
          <button 
            className="btn btn-ghost"
            onClick={() => window.location.reload()}
            style={{ justifyContent: 'flex-start', color: 'var(--text-muted)' }}
          >
            <RefreshCw className="icon" /> Reload App
          </button>
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div style={{ 
            background: 'white', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <p style={{ color: 'var(--danger)', fontSize: '14px', fontWeight: '600' }}>PENDING TASKS</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                background: 'var(--danger)', 
                color: 'white', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '16px'
              }}>
                {tasks.length}
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Tasks to finish</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'today' && (
          <div className="fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontSize: '24px', color: 'var(--text-primary)' }}>Task Coach</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => {
                  if (history.length === 0) return alert("No history found to copy from!");
                  const lastDate = new Date(history[0].dateCompleted).toLocaleDateString();
                  const lastDayTasks = history.filter(h => new Date(h.dateCompleted).toLocaleDateString() === lastDate);
                  const newTasks = lastDayTasks.map(({ id, dateCompleted, notes, actualTime, status, ...rest }) => ({
                    ...rest,
                    id: Date.now().toString() + Math.random(),
                    status: 'pending',
                    notes: '',
                    pauseHistory: []
                  }));
                  setTasks([...tasks, ...newTasks]);
                  saveData([...tasks, ...newTasks]);
                }}>
                  <History className="icon" /> Copy Previous Day
                </button>
                <button className="btn btn-ghost" onClick={handleClearAllTasks} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  <Trash2 className="icon" /> Clear All
                </button>
                <button className="btn btn-primary" onClick={handleStartRoutine}>
                  <Play className="icon" /> Start Routine
                </button>
                <button className="btn btn-ghost" onClick={() => alert("Routine finalized and saved!")}>
                  <CheckCircle className="icon" /> Submit Routine
                </button>
                <button className="btn btn-primary" onClick={handleAddTask}>
                  <Plus className="icon" /> Add Task
                </button>
              </div>
            </header>
            {/* Routine Timeline - Segmented Progress Bar */}
            {tasks.length > 0 && (
              <section className="card" style={{ marginBottom: '24px', padding: '20px', background: 'white', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Routine Progress
                  </h3>
                  {runningTask ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--number-color)' }}>
                        <SandClock progress={timeLeft / runningTask.plannedTime} />
                        <span style={{ fontSize: '14px', fontWeight: '700' }}>{runningTask.name}</span>
                      </div>
                      <div style={{ 
                        background: 'var(--number-color)', 
                        color: 'white', 
                        padding: '4px 12px', 
                        borderRadius: '6px', 
                        fontSize: '20px', 
                        fontWeight: '800', 
                        fontFamily: 'monospace',
                        boxShadow: '0 4px 10px rgba(44, 95, 138, 0.2)'
                      }}>
                        {formatTime(timeLeft)}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Click "Submit Routine" to start</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '4px', height: '12px', width: '100%', borderRadius: '6px', overflow: 'hidden', background: 'var(--bg-accent)' }}>
                  {tasks.map((t, idx) => {
                    const isRunning = runningTaskId === t.id;
                    const taskIndex = tasks.indexOf(t);
                    const runningIndex = runningTask ? tasks.indexOf(runningTask) : -1;
                    const isPast = runningIndex !== -1 && taskIndex < runningIndex;
                    
                    // Calculate progress for the active task (shrinking effect)
                    const progress = isRunning ? (timeLeft / t.plannedTime) * 100 : 0;

                    return (
                      <div key={t.id} style={{ 
                        flex: 1, 
                        height: '100%', 
                        background: 'rgba(0,0,0,0.05)', 
                        position: 'relative',
                        borderRadius: '2px'
                      }}>
                        {/* Fill Layer */}
                        <div style={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          height: '100%',
                          width: isPast ? '100%' : isRunning ? `${progress}%` : '0%',
                          background: isPast ? 'var(--success)' : isRunning ? 'var(--accent)' : 'transparent',
                          transition: isRunning ? 'width 1s linear' : 'all 0.4s ease',
                          borderRadius: '2px'
                        }} />
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  {tasks.map((t, idx) => (
                    <span key={t.id} style={{ 
                      fontSize: '10px', 
                      fontWeight: runningTaskId === t.id ? '800' : '600',
                      color: runningTaskId === t.id ? 'var(--accent)' : 'var(--text-muted)',
                      flex: 1,
                      textAlign: 'center'
                    }}>
                      T{idx + 1}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {waitingTaskId && (
              <div className="card" style={{ 
                marginBottom: '24px', 
                background: '#FFF4E5', 
                border: '1px solid #FFD59F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h3 style={{ color: '#663C00', fontSize: '14px', fontWeight: '700' }}>⏳ WAITING TO START</h3>
                  <p style={{ color: '#663C00', fontSize: '16px' }}>
                    Next task: <strong>{tasks.find(t => t.id === waitingTaskId)?.name}</strong> starts at {tasks.find(t => t.id === waitingTaskId)?.startTime}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#663C00' }}>REMAINING</p>
                  <p style={{ fontSize: '24px', fontWeight: '800', color: '#663C00', fontFamily: 'monospace' }}>
                    {(() => {
                      const task = tasks.find(t => t.id === waitingTaskId);
                      const [h, m] = task.startTime.split(':').map(Number);
                      const scheduled = new Date();
                      scheduled.setHours(h, m, 0, 0);
                      const diffSec = Math.max(0, Math.floor((scheduled - currentTime) / 1000));
                      return formatTime(diffSec);
                    })()}
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => handleStartTask(tasks.find(t => t.id === waitingTaskId))} style={{ background: '#663C00', color: 'white' }}>
                  Start Now
                </button>
              </div>
            )}

            {runningTask && (
              <section className="card" style={{ 
                marginBottom: '32px', 
                background: 'white',
                border: '1px solid var(--border-color)',
                borderLeft: '4px solid var(--number-color)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '14px', textTransform: 'uppercase' }}>📌 Running Task</h3>
                    <h1 style={{ fontSize: '32px', color: 'var(--text-primary)' }}>{runningTask.name}</h1>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '48px', fontWeight: '800', fontFamily: 'monospace', color: 'var(--number-color)' }}>
                      {formatTime(timeLeft)}
                    </p>
                  </div>
                </div>

                <div style={{ margin: '24px 0' }}>
                  <div style={{ height: '8px', background: 'var(--bg-accent)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      background: 'var(--accent)', 
                      width: `${(timeLeft / runningTask.plannedTime) * 100}%`,
                      transition: 'width 1s linear'
                    }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  {!isPaused ? (
                    <button className="btn btn-secondary" onClick={pause}><Pause className="icon" /> Pause</button>
                  ) : (
                    <button className="btn btn-primary" onClick={resume}><Play className="icon" /> Resume</button>
                  )}
                  <button className="btn btn-ghost" onClick={onTimerComplete}><CheckCircle className="icon" style={{ color: 'var(--success)' }} /> Complete</button>
                  <button className="btn btn-ghost" onClick={handleNextTask}><SkipForward className="icon" /> Skip</button>
                </div>
              </section>
            )}

            <section>
              <h3 style={{ marginBottom: '16px' }}>Today's Tasks</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="task-table">
                  <thead>
                    <tr>
                      <th style={{ width: '30px' }}>No</th>
                      <th style={{ width: '30px' }}>Done</th>
                      <th>Task Description</th>
                      <th style={{ width: '100px' }}>Priority</th>
                      <th style={{ width: '130px' }}>Duration</th>
                      <th style={{ width: '100px' }}>Start Time</th>
                      <th style={{ width: '100px' }}>End Time</th>
                      <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', py: '40px', opacity: 0.6 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px' }}>
                            <AlertCircle className="icon" style={{ width: '32px', height: '32px' }} />
                            <p>No tasks added for today yet.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      tasks.map((task, index) => {
                        const isRunning = runningTaskId === task.id;
                        return (
                          <tr 
                            key={task.id} 
                            draggable 
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(index)}
                            style={{ 
                              background: isRunning ? '#FFFFFF' : index % 2 !== 0 ? 'var(--bg-accent)' : 'var(--bg-secondary)',
                              cursor: 'move',
                              opacity: draggedIndex === index ? 0.5 : 1,
                              transition: 'all 0.3s',
                              position: 'relative',
                              boxShadow: isRunning ? '0 0 15px rgba(44, 95, 138, 0.15)' : 'none',
                              transform: isRunning ? 'scale(1.01)' : 'scale(1)',
                              zIndex: isRunning ? 10 : 1,
                              borderLeft: isRunning ? '4px solid var(--accent)' : 'none'
                            }}
                          >
                            <td className="task-no" style={{ padding: '8px 4px', position: 'relative' }}>
                              {isRunning && (
                                <div style={{ 
                                  position: 'absolute', 
                                  left: '-4px', 
                                  top: '50%', 
                                  transform: 'translateY(-50%)',
                                  width: '4px',
                                  height: '70%',
                                  background: 'var(--accent)',
                                  borderRadius: '0 4px 4px 0'
                                }} />
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px' }}>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, 'up'); }}
                                  style={{ background: 'none', border: 'none', color: index === 0 ? '#ccc' : 'var(--accent)', cursor: index === 0 ? 'default' : 'pointer', padding: 0 }}
                                  disabled={index === 0}
                                >
                                  <ChevronUp size={14} />
                                </button>
                                <span style={{ fontSize: '12px', lineHeight: '1', fontWeight: isRunning ? '800' : '500' }}>{(index + 1).toString().padStart(2, '0')}</span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, 'down'); }}
                                  style={{ background: 'none', border: 'none', color: index === tasks.length - 1 ? '#ccc' : 'var(--accent)', cursor: index === tasks.length - 1 ? 'default' : 'pointer', padding: 0 }}
                                  disabled={index === tasks.length - 1}
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isRunning ? (
                                <div style={{ animation: 'pulse 2s infinite', borderRadius: '50%' }}>
                                  <SandClock progress={timeLeft / task.plannedTime} />
                                </div>
                              ) : (
                                <input 
                                  type="checkbox" 
                                  checked={task.status === 'completed'}
                                  onChange={(e) => {
                                    if (e.target.checked && isRunning) {
                                      onTimerComplete();
                                    } else {
                                      const updated = tasks.map(t => t.id === task.id ? { ...t, status: e.target.checked ? 'completed' : 'pending' } : t);
                                      setTasks(updated);
                                      saveData(updated);
                                    }
                                  }}
                                  style={{ 
                                    width: '16px', 
                                    height: '16px', 
                                    accentColor: 'var(--success)',
                                    cursor: 'pointer'
                                  }}
                                />
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isRunning && <span style={{ fontSize: '10px', background: 'var(--danger)', color: 'white', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>LIVE</span>}
                                <input 
                                  className="task-name-input"
                                  value={task.name}
                                  onChange={(e) => {
                                    const updated = tasks.map(t => t.id === task.id ? { ...t, name: e.target.value } : t);
                                    setTasks(updated);
                                    saveData(updated);
                                  }}
                                  style={{ 
                                    background: isRunning ? 'transparent' : 'rgba(44, 95, 138, 0.03)', 
                                    border: isRunning ? 'none' : '1px solid transparent', 
                                    borderRadius: '4px',
                                    color: 'var(--text-primary)', 
                                    fontSize: '13px', 
                                    fontWeight: isRunning ? '700' : '500', 
                                    outline: 'none', 
                                    width: '100%',
                                    padding: '4px 8px',
                                    transition: 'all 0.2s'
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.background = '#FFFFFF';
                                    e.target.style.borderColor = 'var(--accent)';
                                    e.target.style.boxShadow = '0 0 0 2px rgba(44, 95, 138, 0.1)';
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.background = isRunning ? 'transparent' : 'rgba(44, 95, 138, 0.03)';
                                    e.target.style.borderColor = 'transparent';
                                    e.target.style.boxShadow = 'none';
                                  }}
                                />
                              </div>
                            </td>
                          <td>
                              <select 
                                value={task.priority || 'Medium'}
                                onMouseDown={(e) => e.stopPropagation()}
                                draggable={false}
                                onChange={(e) => {
                                  const updated = tasks.map(t => t.id === task.id ? { ...t, priority: e.target.value } : t);
                                  setTasks(updated);
                                  saveData(updated);
                                }}
                                style={{ 
                                  background: 'var(--bg-accent)', 
                                  border: '1px solid var(--border-color)', 
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  padding: '2px 4px',
                                  color: task.priority === 'High' ? '#D9534F' : task.priority === 'Low' ? '#2E7D32' : '#2C5F8A',
                                  fontWeight: '600',
                                  width: '100%',
                                  cursor: 'pointer'
                                }}
                              >
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <select 
                                value={Math.floor(task.plannedTime / 3600)}
                                onMouseDown={(e) => e.stopPropagation()}
                                draggable={false}
                                onChange={(e) => {
                                  const h = parseInt(e.target.value) || 0;
                                  const m = (task.plannedTime % 3600);
                                  const newPlannedTime = (h * 3600) + m;
                                  
                                  let newEndTime = task.endTime;
                                  if (task.startTime && task.startTime !== '00:00') {
                                    const [sh, sm] = task.startTime.split(':').map(Number);
                                    const ed = new Date(new Date().setHours(sh, sm, 0, 0) + newPlannedTime * 1000);
                                    newEndTime = ed.getHours().toString().padStart(2, '0') + ':' + ed.getMinutes().toString().padStart(2, '0');
                                  }

                                  const updated = tasks.map(t => t.id === task.id ? { ...t, plannedTime: newPlannedTime, endTime: newEndTime } : t);
                                  setTasks(updated);
                                  saveData(updated);
                                }}
                                style={{ background: '#E1E8F0', border: '1px solid #CBD5E0', color: 'var(--number-color)', fontSize: '12px', fontWeight: '700', borderRadius: '4px', padding: '1px 3px' }}
                              >
                                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}h</option>)}
                              </select>
                              <select 
                                value={Math.floor((task.plannedTime % 3600) / 60)}
                                onMouseDown={(e) => e.stopPropagation()}
                                draggable={false}
                                onChange={(e) => {
                                  const m = parseInt(e.target.value) || 0;
                                  const h = Math.floor(task.plannedTime / 3600);
                                  const newPlannedTime = (h * 3600) + (m * 60);
                                  
                                  let newEndTime = task.endTime;
                                  if (task.startTime) {
                                    const [sh, sm] = task.startTime.split(':').map(Number);
                                    const ed = new Date(new Date().setHours(sh, sm, 0, 0) + newPlannedTime * 1000);
                                    newEndTime = ed.getHours().toString().padStart(2, '0') + ':' + ed.getMinutes().toString().padStart(2, '0');
                                  }

                                  const updated = tasks.map(t => t.id === task.id ? { ...t, plannedTime: newPlannedTime, endTime: newEndTime } : t);
                                  setTasks(updated);
                                  saveData(updated);
                                }}
                                style={{ background: '#E1E8F0', border: '1px solid #CBD5E0', color: 'var(--number-color)', fontSize: '12px', fontWeight: '700', borderRadius: '4px', padding: '1px 3px' }}
                              >
                                {Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{i}m</option>)}
                              </select>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <select 
                                value={task.startTime?.split(':')[0] || '00'}
                                onMouseDown={(e) => e.stopPropagation()}
                                draggable={false}
                                onChange={(e) => {
                                  const h = e.target.value;
                                  const m = (task.startTime?.split(':')[1] || '00');
                                  const newStartTime = `${h}:${m}`;
                                  
                                  const [sh, sm] = newStartTime.split(':').map(Number);
                                  const ed = new Date(new Date().setHours(sh, sm, 0, 0) + task.plannedTime * 1000);
                                  const newEndTime = ed.getHours().toString().padStart(2, '0') + ':' + ed.getMinutes().toString().padStart(2, '0');

                                  const updated = tasks.map(t => t.id === task.id ? { ...t, startTime: newStartTime, endTime: newEndTime } : t);
                                  setTasks(updated);
                                  saveData(updated);
                                }}
                                style={{ background: '#F1F4FA', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--number-color)', fontSize: '12px', fontWeight: '600', padding: '1px' }}
                              >
                                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>)}
                              </select>
                              <span>:</span>
                              <select 
                                value={task.startTime?.split(':')[1] || '00'}
                                onMouseDown={(e) => e.stopPropagation()}
                                draggable={false}
                                onChange={(e) => {
                                  const m = e.target.value;
                                  const h = (task.startTime?.split(':')[0] || '00');
                                  const newStartTime = `${h}:${m}`;
                                  
                                  const [sh, sm] = newStartTime.split(':').map(Number);
                                  const ed = new Date(new Date().setHours(sh, sm, 0, 0) + task.plannedTime * 1000);
                                  const newEndTime = ed.getHours().toString().padStart(2, '0') + ':' + ed.getMinutes().toString().padStart(2, '0');

                                  const updated = tasks.map(t => t.id === task.id ? { ...t, startTime: newStartTime, endTime: newEndTime } : t);
                                  setTasks(updated);
                                  saveData(updated);
                                }}
                                style={{ background: '#F1F4FA', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--number-color)', fontSize: '12px', fontWeight: '600', padding: '1px' }}
                              >
                                {Array.from({ length: 60 }, (_, i) => <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>)}
                              </select>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <select 
                                value={task.endTime?.split(':')[0] || '00'}
                                onMouseDown={(e) => e.stopPropagation()}
                                draggable={false}
                                onChange={(e) => {
                                  const h = e.target.value;
                                  const m = (task.endTime?.split(':')[1] || '00');
                                  const updated = tasks.map(t => t.id === task.id ? { ...t, endTime: `${h}:${m}` } : t);
                                  setTasks(updated);
                                  saveData(updated);
                                }}
                                style={{ background: '#F1F4FA', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--number-color)', fontSize: '12px', fontWeight: '600', padding: '1px' }}
                              >
                                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>)}
                              </select>
                              <span>:</span>
                              <select 
                                value={task.endTime?.split(':')[1] || '00'}
                                onMouseDown={(e) => e.stopPropagation()}
                                draggable={false}
                                onChange={(e) => {
                                  const m = e.target.value;
                                  const h = (task.endTime?.split(':')[0] || '00');
                                  const updated = tasks.map(t => t.id === task.id ? { ...t, endTime: `${h}:${m}` } : t);
                                  setTasks(updated);
                                  saveData(updated);
                                }}
                                style={{ background: '#F1F4FA', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--number-color)', fontSize: '12px', fontWeight: '600', padding: '1px' }}
                              >
                                {Array.from({ length: 60 }, (_, i) => <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>)}
                              </select>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <input 
                                placeholder="Add comm"
                                value={task.notes || ''}
                                onChange={(e) => {
                                  const updated = tasks.map(t => t.id === task.id ? { ...t, notes: e.target.value } : t);
                                  setTasks(updated);
                                  saveData(updated);
                                }}
                                style={{ 
                                  background: 'transparent', 
                                  border: 'none', 
                                  color: 'var(--text-secondary)', 
                                  fontSize: '12px', 
                                  outline: 'none', 
                                  width: '100%', 
                                  fontStyle: 'italic'
                                }}
                              />
                              <button className="btn-ghost" onClick={() => handleDeleteTask(task.id)} style={{ color: 'var(--danger)', padding: '2px' }} title="Delete">
                                <Trash2 className="icon" style={{ width: '14px' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2>Task History</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Track your progress over time.</p>
              </div>
              <button className="btn btn-secondary" onClick={exportCSV}>
                <Download className="icon" /> Export CSV
              </button>
            </header>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search className="icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  placeholder="Search tasks or notes..." 
                  className="card" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', paddingLeft: '44px', background: 'var(--bg-secondary)', border: 'none' }}
                />
              </div>
              <div style={{ width: '200px' }}>
                <select 
                  className="card" 
                  value={selectedHistoryDate || ''}
                  onChange={(e) => setSelectedHistoryDate(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none' }}
                >
                  <option value="">Select Date</option>
                  {availableDates.map(date => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedHistoryDate && historyByDate[selectedHistoryDate]?.map((item, i) => (
                <div 
                  key={item.id || i} 
                  className="card" 
                  onClick={() => setExpandedHistoryId(expandedHistoryId === (item.id || i) ? null : (item.id || i))}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px', 
                    cursor: 'pointer',
                    borderLeft: `4px solid ${item.status === 'completed' ? 'var(--success)' : 'var(--danger)'}`,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold', marginRight: '8px' }}>
                        TASK {(i + 1).toString().padStart(2, '0')}
                      </span>
                      <h4 style={{ display: 'inline', fontSize: '18px' }}>{item.name}</h4>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        ⏱️ {Math.round(item.actualTime / 60)} min
                      </span>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        background: item.status === 'completed' ? 'rgba(46, 125, 50, 0.1)' : 'rgba(217, 83, 79, 0.1)',
                        color: item.status === 'completed' ? 'var(--success)' : 'var(--danger)',
                        fontWeight: '700'
                      }}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {expandedHistoryId === (item.id || i) && (
                    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-accent)', borderRadius: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '12px' }}>
                        <div>
                          <p style={{ fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>TIMING</p>
                          <p>{item.startTime || '--:--'} to {item.endTime || '--:--'}</p>
                        </div>
                        <div>
                          <p style={{ fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>PRIORITY</p>
                          <p style={{ color: item.priority === 'High' ? 'var(--danger)' : 'var(--text-primary)' }}>{item.priority || 'Medium'}</p>
                        </div>
                        <div>
                          <p style={{ fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>PLANNED</p>
                          <p>{Math.round(item.plannedTime / 60)} min</p>
                        </div>
                      </div>
                      {item.notes && (
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                          <p style={{ fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>NOTES</p>
                          <p style={{ fontStyle: 'italic' }}>"{item.notes}"</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {availableDates.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                  <p>No history available matching your filters.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div>
                <h2>Routine Templates</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Save and switch between your daily routines.</p>
              </div>
              <button className="btn btn-primary" onClick={() => {
                const name = prompt("Enter template name:");
                if (name) handleSaveAsTemplate(name);
              }}>
                <Save className="icon" /> Save Current as Template
              </button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {templates.map(template => (
                <div key={template.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3>{template.name}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{template.tasks.length} tasks included</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleLoadTemplate(template)}>Load</button>
                    <button className="btn btn-ghost" onClick={() => {
                      const updated = templates.filter(t => t.id !== template.id);
                      setTemplates(updated);
                      saveData(undefined, undefined, undefined, updated);
                    }}>
                      <Trash2 className="icon" style={{ color: 'var(--danger)' }} />
                    </button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', py: '40px', opacity: 0.6 }}>
                  <p>No templates saved yet. Create a routine and save it!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="fade-in">
            <h2>Settings</h2>
            <div className="card" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4>Sound Notifications</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Play a sound when the timer ends.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.soundEnabled} 
                  onChange={(e) => {
                    const newSettings = { ...settings, soundEnabled: e.target.checked };
                    setSettings(newSettings);
                    saveData(undefined, undefined, newSettings);
                  }} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4>Auto-pause on System Sleep</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Pause the timer automatically when PC locks or sleeps.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.autoPause} 
                  onChange={(e) => {
                    const newSettings = { ...settings, autoPause: e.target.checked };
                    setSettings(newSettings);
                    saveData(undefined, undefined, newSettings);
                  }} 
                />
              </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => {
                      playBeep(880, 0.5);
                    }}>
                      Test Sound
                    </button>
                    <button className="btn btn-secondary" onClick={() => {
                      const data = JSON.stringify({ tasks, history, settings }, null, 2);
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'task-coach-backup.json';
                      a.click();
                    }}>
                      <Download className="icon" /> Export Data Backup
                    </button>
                  </div>
            </div>
          </div>
        )}
      </main>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="card" style={{ width: '450px', background: 'white', border: '1px solid var(--border-color)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>⏰ Time's Up!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Great job on <strong>{runningTask?.name}</strong>. How did it go?
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {['completed', 'incomplete', 'retry', 'reschedule'].map(tag => (
                <button 
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`btn ${selectedTag === tag ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ textTransform: 'capitalize', fontSize: '12px', padding: '6px 12px' }}
                >
                  <Tag className="icon" style={{ width: '14px', height: '14px' }} /> {tag}
                </button>
              ))}
            </div>

            <textarea 
              placeholder="Add a quick note..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="card"
              style={{ 
                width: '100%', 
                height: '100px', 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-color)', 
                marginBottom: '24px', 
                color: 'var(--text-primary)', 
                resize: 'none',
                padding: '12px',
                fontSize: '14px',
                outline: 'none'
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn btn-primary" onClick={handleCompleteTask} style={{ width: '100%' }}>
                <CheckCircle className="icon" /> Save & Next Task
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => handleContinueTask(5)} style={{ flex: 1 }}>+5 min</button>
                <button className="btn btn-secondary" onClick={() => handleContinueTask(10)} style={{ flex: 1 }}>+10 min</button>
                <button className="btn btn-ghost" onClick={handleNextTask} style={{ flex: 1 }}>Skip</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .active { color: var(--accent) !important; }
        .task-name-input:focus { border-bottom: 1px solid var(--accent) !important; }
      `}</style>
    </div>
  );
};

export default App;
