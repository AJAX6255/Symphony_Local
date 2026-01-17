
import { AudioFile } from '../types';

export const processLocalFiles = (fileList: FileList): AudioFile[] => {
  const audioFiles: AudioFile[] = [];
  
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    // Filter for MP3 files
    if (file.name.toLowerCase().endsWith('.mp3') || file.type === 'audio/mpeg') {
      audioFiles.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size.toString(),
        type: file.type || 'audio/mpeg',
        file: file,
        relativePath: (file as any).webkitRelativePath || file.name
      });
    }
  }
  
  // Sort alphabetically by name
  return audioFiles.sort((a, b) => a.name.localeCompare(b.name));
};
