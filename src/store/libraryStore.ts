import { create } from 'zustand';

export type TypeFilter = 'all' | 'pinned' | 'note' | 'file' | 'link';
export type SortMode = 'savedAt' | 'lastOpenedAt' | 'title';

interface LibraryState {
  activeTypeFilter: TypeFilter;
  activeTagFilter: string | null;
  sortMode: SortMode;
  searchQuery: string;
  isSearchActive: boolean;

  setTypeFilter: (filter: TypeFilter) => void;
  setTagFilter: (tagId: string | null) => void;
  setSortMode: (mode: SortMode) => void;
  setSearchQuery: (query: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
  clearFilters: () => void;
}

const getInitialSession = <T>(key: string, fallback: T): T => {
  try {
    const val = sessionStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
};

const setSession = (key: string, val: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore session storage errors
  }
};

export const useLibraryStore = create<LibraryState>((set) => ({
  activeTypeFilter: getInitialSession<TypeFilter>('lib_typeFilter', 'all'),
  activeTagFilter: getInitialSession<string | null>('lib_tagFilter', null),
  sortMode: getInitialSession<SortMode>('lib_sortMode', 'savedAt'),
  searchQuery: '',
  isSearchActive: false,

  setTypeFilter: (filter) => {
    setSession('lib_typeFilter', filter);
    set({ activeTypeFilter: filter });
  },

  setTagFilter: (tagId) => {
    setSession('lib_tagFilter', tagId);
    set({ activeTagFilter: tagId });
  },

  setSortMode: (mode) => {
    setSession('lib_sortMode', mode);
    set({ sortMode: mode });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  openSearch: () => {
    set({ isSearchActive: true });
  },

  closeSearch: () => {
    set({ isSearchActive: false, searchQuery: '' });
  },

  clearFilters: () => {
    setSession('lib_typeFilter', 'all');
    setSession('lib_tagFilter', null);
    set({
      activeTypeFilter: 'all',
      activeTagFilter: null,
      searchQuery: '',
    });
  },
}));
