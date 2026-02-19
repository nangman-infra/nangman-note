'use client';

import { Calendar, Tag, Trash2, Plus } from 'lucide-react';
import Link from 'next/link';

export function Sidebar() {
  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold">TransNote</h1>
        <p className="text-xs text-gray-500">실시간 전사 + AI 회의록</p>
      </div>

      <nav className="flex-1 space-y-1">
        <SidebarItem icon={<Calendar className="w-4 h-4" />} label="오늘" />
        <SidebarItem icon={<Calendar className="w-4 h-4" />} label="최근" />
        <SidebarItem icon={<Calendar className="w-4 h-4" />} label="전체" />
        
        <div className="pt-4 mt-4 border-t">
          <p className="text-xs font-medium text-gray-500 mb-2">태그</p>
          <SidebarItem icon={<Tag className="w-4 h-4" />} label="회의록" />
          <SidebarItem icon={<Tag className="w-4 h-4" />} label="강의" />
          <SidebarItem icon={<Tag className="w-4 h-4" />} label="세미나" />
        </div>

        <div className="pt-4 mt-4 border-t">
          <SidebarItem icon={<Trash2 className="w-4 h-4" />} label="휴지통" />
        </div>
      </nav>

      <Link
        href="/meeting/new"
        className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        새 회의
      </Link>
    </div>
  );
}

function SidebarItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
      {icon}
      <span>{label}</span>
    </button>
  );
}
