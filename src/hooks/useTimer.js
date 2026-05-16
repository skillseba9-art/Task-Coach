import { useState, useEffect, useCallback } from 'react';

export const useTimer = (initialSeconds, onComplete) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const start = useCallback((seconds) => {
    if (seconds !== undefined) setTimeLeft(seconds);
    setIsActive(true);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
  }, []);

  const addTime = useCallback((seconds) => {
    setTimeLeft(prev => prev + seconds);
  }, []);

  useEffect(() => {
    let interval = null;
    if (isActive && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      if (onComplete) onComplete();
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused, timeLeft, onComplete]);

  return {
    timeLeft,
    isActive,
    isPaused,
    start,
    pause,
    resume,
    stop,
    addTime,
    setTimeLeft
  };
};
