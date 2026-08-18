'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Meeting } from '../types/meeting.types';

const MAX_RECENT_SEARCHES = 8;

export type MeetingSearchScope = 'all' | 'title' | 'note' | 'transcript' | 'result';

export const MEETING_SEARCH_SCOPE_OPTIONS: Array<{
  value: MeetingSearchScope;
  label: string;
}> = [
  { value: 'all', label: '전체' },
  { value: 'title', label: '제목' },
  { value: 'note', label: '노트' },
  { value: 'transcript', label: '전사' },
  { value: 'result', label: '회의록' },
];

type PushToast = (options: {
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'info';
}) => void;

interface UseMeetingListSearchParams {
  meetings: Meeting[];
  showTrash: boolean;
  fetchMeetings: (options?: { silent?: boolean }) => Promise<void>;
  searchMeetings: (query: string, scope?: string) => Promise<void>;
  pushToast: PushToast;
}

function normalizeKeyword(keyword: string) {
  return keyword.trim();
}

export function useMeetingListSearch({
  meetings,
  showTrash,
  fetchMeetings,
  searchMeetings,
  pushToast,
}: UseMeetingListSearchParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<MeetingSearchScope>('all');
  const [isSearchApplied, setIsSearchApplied] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeDescendantIndex, setActiveDescendantIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>(
    'transnote_recent_meeting_searches',
    [],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;

      event.preventDefault();
      inputRef.current?.focus();
      setIsSuggestionOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setActiveDescendantIndex(-1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [isSuggestionOpen]);

  const searchCandidates = useMemo(() => {
    if (showTrash) {
      return recentSearches;
    }

    const titleCandidates = meetings
      .map((meeting) => normalizeKeyword(meeting.title || ''))
      .filter(Boolean);

    return [...new Set([...recentSearches, ...titleCandidates])];
  }, [meetings, recentSearches, showTrash]);

  const suggestions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return searchCandidates.slice(0, 6);
    }

    return searchCandidates
      .filter((candidate) => candidate.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [searchCandidates, searchQuery]);

  const storeRecentSearch = (keyword: string) => {
    setRecentSearches((prev) => {
      const normalized = normalizeKeyword(keyword);
      if (!normalized) return prev;

      const deduped = prev.filter((item) => item !== normalized);
      return [normalized, ...deduped].slice(0, MAX_RECENT_SEARCHES);
    });
  };

  const resetSearchState = () => {
    setSearchQuery('');
    setIsSearchApplied(false);
    setIsSuggestionOpen(false);
  };

  const runSearch = (keyword: string, scopeOverride?: MeetingSearchScope) => {
    if (showTrash) {
      return;
    }

    const normalized = normalizeKeyword(keyword);
    const effectiveScope = scopeOverride ?? searchScope;

    if (!normalized) {
      resetSearchState();
      void fetchMeetings();
      return;
    }

    setSearchQuery(normalized);
    setIsSearchApplied(true);
    storeRecentSearch(normalized);
    setIsSuggestionOpen(false);
    void searchMeetings(normalized, effectiveScope);
  };

  const changeSearchScope = (scope: MeetingSearchScope) => {
    setSearchScope(scope);
    // 검색이 적용된 상태에서 범위를 바꾸면 즉시 재검색
    if (isSearchApplied && searchQuery.trim()) {
      runSearch(searchQuery, scope);
    }
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    runSearch(searchQuery);
  };

  const handleSearchFocus = () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
    }
    setIsSuggestionOpen(true);
  };

  const handleSearchBlur = () => {
    blurTimerRef.current = window.setTimeout(() => {
      setIsSuggestionOpen(false);
    }, 140);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestionOpen || suggestions.length === 0) {
      if (event.key === 'Escape') {
        setIsSuggestionOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        setActiveDescendantIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        setActiveDescendantIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
        break;
      }
      case 'Enter': {
        if (activeDescendantIndex >= 0 && activeDescendantIndex < suggestions.length) {
          event.preventDefault();
          runSearch(suggestions[activeDescendantIndex]);
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        setIsSuggestionOpen(false);
        setActiveDescendantIndex(-1);
        break;
      }
    }
  };

  const clearSearch = () => {
    resetSearchState();
    if (showTrash) {
      return;
    }
    void fetchMeetings();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    pushToast({ title: '최근 검색어를 비웠습니다', variant: 'info' });
  };

  return {
    inputRef,
    searchQuery,
    setSearchQuery,
    searchScope,
    changeSearchScope,
    isSearchApplied,
    isSuggestionOpen,
    activeDescendantIndex,
    recentSearches,
    suggestions,
    resetSearchState,
    runSearch,
    handleSearchSubmit,
    handleSearchFocus,
    handleSearchBlur,
    handleSearchKeyDown,
    clearSearch,
    clearRecentSearches,
  };
}
