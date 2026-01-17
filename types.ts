
export interface AudioFile {
  id: string;
  name: string;
  size: string;
  type: string;
  file: File;
  relativePath?: string;
}

export interface AppState {
  isLoaded: boolean;
  folderName: string | null;
  mode: 'file' | 'mic' | 'idle';
}
