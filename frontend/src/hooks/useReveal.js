import { useEffect, useState, useRef, useCallback } from 'react';

export function useReveal(options = {}) {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', once = true } = options;
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(element);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [elementRef, isVisible];
}

export function useCarousel({ items, interval = 5000, autoPlay = true }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef(null);
  const isPausedRef = useRef(false);
  const itemsLengthRef = useRef(items.length);

  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  const goTo = useCallback((index) => {
    setCurrentIndex(() => {
      const len = itemsLengthRef.current;
      if (len <= 1) return 0;
      const newIndex = (index % len + len) % len;
      return newIndex;
    });
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((_prev) => {
      const len = itemsLengthRef.current;
      if (len <= 1) return 0;
      return (_prev + 1) % len;
    });
  }, []);

  const prev = useCallback(() => {
    setCurrentIndex((_prev) => {
      const len = itemsLengthRef.current;
      if (len <= 1) return 0;
      return (_prev - 1 + len) % len;
    });
  }, []);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    if (autoPlay && itemsLengthRef.current > 1 && !intervalRef.current) {
      intervalRef.current = setInterval(next, interval);
    }
  }, [autoPlay, interval, next]);

  useEffect(() => {
    if (!autoPlay || itemsLengthRef.current <= 1) return;
    intervalRef.current = setInterval(next, interval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoPlay, interval, next]);

  useEffect(() => {
    setCurrentIndex((prev) => {
      const len = itemsLengthRef.current;
      if (len <= 1) return 0;
      if (prev >= len) return len - 1;
      return prev;
    });
  }, [items.length]);

  return { currentIndex, goTo, next, prev, pause, resume };
}

export function useStaggeredReveal(count, baseDelay = 100) {
  const [revealed, setRevealed] = useState(new Set());
  const [elementRef, isVisible] = useReveal();

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        for (let i = 0; i < count; i++) {
          setTimeout(() => setRevealed((prev) => new Set([...prev, i])), i * baseDelay);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, count, baseDelay]);

  return { elementRef, revealed };
}