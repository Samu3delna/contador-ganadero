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

  const goTo = useCallback((index) => {
    setCurrentIndex((prev) => (index + items.length) % items.length);
  }, [items.length]);

  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const prev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  useEffect(() => {
    if (!autoPlay || items.length <= 1) return;
    intervalRef.current = setInterval(next, interval);
    return () => clearInterval(intervalRef.current);
  }, [autoPlay, interval, items.length, next]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      if (autoPlay && items.length > 1) {
        intervalRef.current = setInterval(next, interval);
      }
    }
  }, [currentIndex, autoPlay, interval, items.length, next]);

  return { currentIndex, goTo, next, prev };
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