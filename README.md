# 🚀 Task Coach — Master Your Daily Routine with Precision

> **A high-performance desktop companion designed to coach you through your daily tasks with automated timing, routine synchronization, and intelligent productivity tracking.**

---

## 📌 Project Overview

### 🔍 The Problem
Modern professionals often struggle with "productivity debt"—the lost time between tasks and the inability to visualize the true duration of a daily routine. Traditional to-do lists are static, while time-trackers are often reactive, creating a gap where focus is lost during transitions.

### 💡 The Solution
**Task Coach** bridges this gap by transforming a static task list into an active, timed routine. By integrating a live "coaching" timer that automatically transitions between tasks and respects system power states, the app ensures users maintain a consistent flow state throughout their day.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 19, Vite, Lucide React |
| **Desktop Framework** | Electron 42 |
| **Styling** | Vanilla CSS3 (Custom Design System) |
| **State Management** | React Hooks (Custom Timer Logic) |
| **Storage & IPC** | Electron IPC, Local File System (JSON) |

---

## ✨ Core Features & Functionalities

* **⚡ Intelligent Routine Engine:** Automatically sequences multiple tasks and calculates projected completion times in real-time.
* **⏳ Smart Timer System:** High-precision countdown with intelligent pause/resume logic that automatically detects system sleep/wake events.
* **📊 Segmented Progress Tracking:** A dynamic visual timeline showing the status of the entire routine, with per-task progress bars and animated SVG sand-clocks.
* **📅 Scheduled Task Starts:** Set specific start times for tasks; the app enters a "waiting" state and triggers the routine precisely when needed.
* **📋 Template & History System:** Save complex daily routines as reusable templates and export detailed execution history to CSV for deep productivity analysis.

---

## 🎬 Visuals & Screenshots

| Main Dashboard | Active Task View |
| :---: | :---: |
| ![Dashboard](./screenshots/dashboard.png) | ![Active Task](./screenshots/active-task.png) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/task-coach.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run electron:build
   ```

---

## 🧠 Technical Challenges & Engineering Solutions

### 1. Challenge: Clock Drift & State Integrity
**Context:** React's re-render cycle and system-level sleep events can cause standard `setInterval` timers to drift.
**Solution:** Engineered a robust `useTimer` hook that utilizes system-level IPC listeners to ensure the timer pauses exactly when the computer sleeps and resumes accurately upon wake.

### 2. Challenge: Complex Sequential State Management
**Context:** Managing transitions between "Waiting", "Running", and "Completed" tasks.
**Solution:** Implemented a state-machine architecture to handle task lifecycles, using `useMemo` for heavy routine calculations.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
