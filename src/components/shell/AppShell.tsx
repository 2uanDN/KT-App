import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { SaveButton } from './SaveButton';
import { UndoToast } from '../feedback/UndoToast';
import { OfflineIndicator } from './OfflineIndicator';
import { searchService } from '../../services/SearchService';
import { seedInitialDataIfEmpty } from '../../db/seed';

export const AppShell: React.FC = () => {
  useEffect(() => {
    // Seed and warm up search index on app launch
    seedInitialDataIfEmpty().then(() => {
      searchService.initialize();
    });
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#F3F3F3] flex justify-center text-[#1B1B1B] font-sans antialiased">
      {/* 480px Mobile Blueprint Constraint Container */}
      <div className="relative w-full max-w-[480px] min-h-screen bg-[#FFFFFF] border-x border-[#3D4A5C] shadow-2xl flex flex-col pb-16">
        <OfflineIndicator />
        <main className="flex-1 flex flex-col bg-[#FFFFFF]">
          <Outlet />
        </main>
        <SaveButton />
        <BottomNav />
        <UndoToast />
      </div>
    </div>
  );
};
