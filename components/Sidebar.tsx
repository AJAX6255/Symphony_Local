
import React, { useState } from 'react';
import { AudioFile } from '../types';

interface SidebarProps {
  files: AudioFile[];
  currentTrack: AudioFile | null;
  onSelectTrack: (file: AudioFile) => void;
  isLoading: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ files, currentTrack, onSelectTrack, isLoading }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 h-full border-r border-gray-800 flex flex-col bg-gray-900 shadow-2xl">
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-100">Library</h2>
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full font-mono">
            {files.length} Files
          </span>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Filter bird songs..."
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col justify-center items-center h-40 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Scanning folder...</p>
          </div>
        ) : filteredFiles.length > 0 ? (
          <ul className="py-2">
            {filteredFiles.map((file) => (
              <li
                key={file.id}
                onClick={() => onSelectTrack(file)}
                className={`group px-5 py-3 cursor-pointer transition-all border-l-4 ${
                  currentTrack?.id === file.id 
                    ? 'bg-blue-600/10 border-blue-500 text-blue-100' 
                    : 'border-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <div className="text-sm font-medium truncate flex items-center">
                  <svg className={`w-3 h-3 mr-2 ${currentTrack?.id === file.id ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                  {file.name}
                </div>
                <div className="text-[10px] opacity-40 mt-1 uppercase tracking-tighter ml-5">
                  {(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-10 text-center">
            <div className="text-gray-700 mb-2">No matches found</div>
            <p className="text-xs text-gray-600">Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
