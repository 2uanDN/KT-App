import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { LibraryScreen } from './screens/LibraryScreen';
import { SearchScreen } from './screens/SearchScreen';
import { CollectionsScreen } from './screens/CollectionsScreen';
import { CollectionDetailScreen } from './screens/CollectionDetailScreen';
import { InboxScreen } from './screens/InboxScreen';
import { TagsScreen } from './screens/TagsScreen';
import { TagDetailScreen } from './screens/TagDetailScreen';
import { ItemDetailScreen } from './screens/ItemDetailScreen';
import { EditScreen } from './screens/EditScreen';
import { SaveScreen } from './screens/SaveScreen';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <LibraryScreen />,
      },
      {
        path: 'search',
        element: <SearchScreen />,
      },
      {
        path: 'collections',
        element: <CollectionsScreen />,
      },
      {
        path: 'collections/:id',
        element: <CollectionDetailScreen />,
      },
      {
        path: 'inbox',
        element: <InboxScreen />,
      },
      {
        path: 'tags',
        element: <TagsScreen />,
      },
      {
        path: 'tags/:id',
        element: <TagDetailScreen />,
      },
      {
        path: 'items/:id',
        element: <ItemDetailScreen />,
      },
      {
        path: 'items/:id/edit',
        element: <EditScreen />,
      },
      {
        path: 'save',
        element: <SaveScreen />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
