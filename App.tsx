
import React, { useState, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import MainPlayer from './components/MainPlayer';
import { processLocalFiles } from './services/localService';
import { AudioFile } from './types';
import { APP_NAME } from './constants';

const App: React.FC = () => {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [currentTrack, setCurrentTrack] = useState<AudioFile | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const firstFile = selectedFiles[0];
      const folder = (firstFile as any).webkitRelativePath?.split('/')[0] || 'Local Folder';
      setFolderName(folder);
      
      const processed = processLocalFiles(selectedFiles);
      if (processed.length === 0) {
        throw new Error("No MP3 files were found in the selected folder.");
      }
      setFiles(processed);
      setMicStream(null);
      setHasStarted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to process files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMic = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setMicStream(stream);
      setFolderName('System Microphone');
      setFiles([]);
      setHasStarted(true);
    } catch (err: any) {
      setError("Microphone access denied or not supported.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenLocalFolder = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const resetLibrary = () => {
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
    }
    setFiles([]);
    setCurrentTrack(null);
    setMicStream(null);
    setFolderName(null);
    setHasStarted(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNextTrack = useCallback(() => {
    if (!currentTrack || files.length === 0) return;
    const currentIndex = files.findIndex((f) => f.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % files.length;
    setCurrentTrack(files[nextIndex]);
  }, [currentTrack, files]);

  const handlePrevTrack = useCallback(() => {
    if (!currentTrack || files.length === 0) return;
    const currentIndex = files.findIndex((f) => f.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + files.length) % files.length;
    setCurrentTrack(files[prevIndex]);
  }, [currentTrack, files]);

  if (!hasStarted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 p-6 overflow-hidden">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          {...({ webkitdirectory: "", directory: "" } as any)}
        />

        <div className="max-w-3xl w-full text-center space-y-12">
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 tracking-tighter">
              {APP_NAME}
            </h1>
            <p className="text-gray-400 text-lg md:text-xl font-light tracking-widest uppercase">
              Pro-Grade Avian Bioacoustics Analyzer
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900/40 p-10 rounded-[2.5rem] border border-gray-800 shadow-2xl backdrop-blur-xl group hover:border-blue-500/50 transition-all">
              <button
                onClick={handleOpenLocalFolder}
                disabled={isLoading}
                className="w-full flex flex-col items-center space-y-4 py-8 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xl disabled:opacity-50"
              >
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="text-xl font-bold">Local Files</span>
              </button>
              <p className="text-gray-500 mt-4 text-xs uppercase tracking-widest">Analyze MP3 Library</p>
            </div>

            <div className="bg-gray-900/40 p-10 rounded-[2.5rem] border border-gray-800 shadow-2xl backdrop-blur-xl group hover:border-red-500/50 transition-all">
              <button
                onClick={handleStartMic}
                disabled={isLoading}
                className="w-full flex flex-col items-center space-y-4 py-8 rounded-2xl bg-gray-800 hover:bg-red-600 text-white transition-all shadow-xl disabled:opacity-50"
              >
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-xl font-bold">Live Monitor</span>
              </button>
              <p className="text-gray-500 mt-4 text-xs uppercase tracking-widest">Real-time Mic Analysis</p>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-2xl text-red-400 text-sm animate-pulse">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white select-none">
      {files.length > 0 && (
        <Sidebar 
          files={files} 
          currentTrack={currentTrack} 
          onSelectTrack={setCurrentTrack}
          isLoading={isLoading}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-gray-900 flex items-center justify-between px-8 bg-gray-950/80 backdrop-blur-2xl z-10">
          <div className="flex items-center space-x-4">
            <div className={`w-10 h-10 ${micStream ? 'bg-red-600 animate-pulse' : 'bg-blue-600'} rounded-xl flex items-center justify-center font-black text-xl shadow-lg`}>
              {micStream ? 'M' : 'S'}
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                {micStream ? 'Input Source' : 'Library Folder'}
              </h3>
              <p className="text-sm font-bold text-gray-200">{folderName}</p>
            </div>
          </div>
          <button 
            onClick={resetLibrary}
            className="px-6 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-full text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all"
          >
            Switch Mode
          </button>
        </header>
        
        <main className="flex-1 overflow-hidden">
          <MainPlayer 
            track={currentTrack} 
            micStream={micStream}
            onNext={handleNextTrack}
            onPrev={handlePrevTrack}
          />
        </main>
      </div>
    </div>
  );
};

export default App;
