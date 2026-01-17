
import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.js';
import { AudioFile } from '../types';

interface MainPlayerProps { 
  track: AudioFile | null; 
  micStream: MediaStream | null; 
  onNext: () => void; 
  onPrev: () => void; 
}

const FREQ_MAX = 12000;

const generateBirdSongColormap = () => {
  const colormap: number[][] = [];
  const keyPoints = [
    { pos: 0.0, color: [0, 0, 0, 1] },       
    { pos: 0.15, color: [20, 0, 60, 1] },    
    { pos: 0.4, color: [140, 0, 160, 1] },   
    { pos: 0.7, color: [255, 100, 0, 1] },   
    { pos: 1.0, color: [255, 255, 255, 1] } 
  ];
  for (let i = 0; i < 256; i++) {
    const ratio = i / 255;
    let start = keyPoints[0], end = keyPoints[keyPoints.length - 1];
    for (let j = 0; j < keyPoints.length - 1; j++) { 
      if (ratio >= keyPoints[j].pos && ratio <= keyPoints[j + 1].pos) { 
        start = keyPoints[j]; 
        end = keyPoints[j + 1]; 
        break; 
      } 
    }
    const range = end.pos - start.pos, rangeRatio = range === 0 ? 0 : (ratio - start.pos) / range;
    const r = Math.round(start.color[0] + (end.color[0] - start.color[0]) * rangeRatio), 
          g = Math.round(start.color[1] + (end.color[1] - start.color[1]) * rangeRatio), 
          b = Math.round(start.color[2] + (end.color[2] - start.color[2]) * rangeRatio);
    colormap.push([r, g, b]);
  }
  return colormap;
};

const MainPlayer: React.FC<MainPlayerProps> = ({ track, micStream, onNext, onPrev }) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const spectrogramRef = useRef<HTMLDivElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [micGain, setMicGain] = useState(1.5);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibFreq, setCalibFreq] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [signalLevel, setSignalLevel] = useState(0);

  useEffect(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);

  const initWaveSurfer = useCallback(() => {
    if (!waveformRef.current || !spectrogramRef.current || micStream) return;
    if (wavesurfer.current) { 
      wavesurfer.current.destroy(); 
      wavesurfer.current = null; 
    }
    
    spectrogramRef.current.innerHTML = '';
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#1d4ed8',
      progressColor: '#60a5fa',
      cursorColor: '#3b82f6', // Bright blue cursor
      cursorWidth: 2,         // Clearly visible
      barWidth: 3,
      barGap: 3,
      barRadius: 2,
      height: 140,
      interact: true,
      audioContext: audioCtxRef.current || undefined,
      plugins: [
        Spectrogram.create({
          container: spectrogramRef.current,
          labels: false,
          height: 320,
          splitChannels: false,
          frequencyMin: 0,
          frequencyMax: FREQ_MAX,
          colorMap: generateBirdSongColormap().map(([r,g,b]) => [r/255, g/255, b/255, 1]),
        }),
      ],
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => onNext());
    wavesurfer.current = ws;
  }, [onNext, micStream]);

  useEffect(() => { 
    if (!micStream) initWaveSurfer(); 
    return () => wavesurfer.current?.destroy(); 
  }, [initWaveSurfer, micStream]);

  useEffect(() => {
    if (micStream || !track || !wavesurfer.current) return;
    
    setIsBuffering(true);
    setError(null);

    const url = URL.createObjectURL(track.file);
    wavesurfer.current.load(url);
    wavesurfer.current.once('ready', () => { 
        wavesurfer.current?.play(); 
        setIsBuffering(false); 
        URL.revokeObjectURL(url); 
    });
    wavesurfer.current.once('error', (e: any) => { 
        setError(e?.message || 'Failed to decode audio file'); 
        setIsBuffering(false); 
        URL.revokeObjectURL(url); 
    });
  }, [track, micStream]);

  const runLiveCalibration = async () => {
    const ctx = audioCtxRef.current;
    if (!ctx || isCalibrating || !analyzerRef.current) return;

    if (ctx.state === 'suspended') await ctx.resume();
    setIsCalibrating(true);
    setCalibFreq(10);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    gain.gain.value = 0.15; 
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(analyzerRef.current); 
    
    const startTime = ctx.currentTime + 0.1;
    const stepDuration = 0.05;
    let stepCount = 0;
    
    for (let freq = 10; freq <= FREQ_MAX; freq += 200) {
      const time = startTime + (stepCount * stepDuration);
      osc.frequency.setValueAtTime(freq, time);
      stepCount++;
    }
    
    const endTime = startTime + (stepCount * stepDuration);
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const currentFreq = 10 + (currentStep * 200);
      if (currentFreq > FREQ_MAX) clearInterval(interval);
      else setCalibFreq(currentFreq);
    }, stepDuration * 1000);

    osc.start(startTime);
    osc.stop(endTime);
    
    setTimeout(() => {
      setIsCalibrating(false);
      setCalibFreq(0);
      clearInterval(interval);
    }, (endTime - startTime) * 1000 + 100);
  };

  useEffect(() => {
    if (!micStream || !liveCanvasRef.current) return;
    
    const audioCtx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = audioCtx;
    
    const source = audioCtx.createMediaStreamSource(micStream);
    const gainNode = audioCtx.createGain();
    const analyzer = audioCtx.createAnalyser();
    analyzerRef.current = analyzer;
    analyzer.fftSize = 2048; 
    const bufferLength = analyzer.frequencyBinCount, dataArray = new Uint8Array(bufferLength);
    gainNode.gain.value = micGain;
    source.connect(gainNode); 
    gainNode.connect(analyzer);
    
    const canvas = liveCanvasRef.current, ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const colormap = generateBirdSongColormap();
    let animationFrameId: number;

    const renderLive = () => {
      analyzer.getByteFrequencyData(dataArray);
      const imageData = ctx.getImageData(1, 0, canvas.width - 1, canvas.height);
      ctx.putImageData(imageData, 0, 0);
      const x = canvas.width - 1;
      ctx.fillStyle = '#000000'; ctx.fillRect(x, 0, 1, canvas.height);
      let sum = 0; for (let i = 0; i < 50; i++) sum += dataArray[i];
      setSignalLevel(sum / 50);
      const nyquist = audioCtx.sampleRate / 2, maxFreqIndex = Math.floor((FREQ_MAX / nyquist) * bufferLength);
      for (let i = 0; i < maxFreqIndex; i++) {
        const value = dataArray[i];
        if (value > 0) {
          const [r, g, b] = colormap[value];
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          const y = canvas.height - (i / maxFreqIndex) * canvas.height;
          const height = canvas.height / maxFreqIndex + 1;
          ctx.fillRect(x, y - height, 1, height);
        }
      }
      animationFrameId = requestAnimationFrame(renderLive);
    };
    renderLive();
    return () => { cancelAnimationFrame(animationFrameId); analyzerRef.current = null; };
  }, [micStream, micGain]);

  const takeSnapshot = () => {
    const targetCanvas = micStream ? liveCanvasRef.current : spectrogramRef.current?.querySelector('canvas');
    if (!targetCanvas) return;
    const link = document.createElement('a');
    link.download = `spectrogram-${track?.name || 'live'}-${Date.now()}.png`;
    link.href = (targetCanvas as HTMLCanvasElement).toDataURL('image/png');
    link.click();
  };

  const freqLabels = [
    { label: '12 kHz', top: '2%' },
    { label: '10 kHz', top: '16.6%' },
    { label: '8 kHz', top: '33.3%' },
    { label: '6 kHz', top: '50%' },
    { label: '4 kHz', top: '66.6%' },
    { label: '2 kHz', top: '83.3%' },
    { label: '400 Hz', top: '96%' }
  ];

  return (
    <div className="flex-1 flex flex-col bg-gray-950 overflow-y-auto p-6 md:p-10 custom-scrollbar">
      <style>{`
        .wavesurfer-spectrogram, .wavesurfer-spectrogram canvas, .wavesurfer-spectrogram > div, .wavesurfer-spectrogram > section {
          background: transparent !important;
          background-color: transparent !important;
          position: relative !important;
          display: block !important;
        }
        .spectrogram-parent-container {
          background-color: #000000 !important;
          position: relative;
          display: flex;
          overflow: visible;
        }
        #live-waterfall { background: #000000 !important; display: block; image-rendering: crisp-edges; flex: 1; }
        .freq-gutter {
          width: 80px;
          min-width: 80px;
          background-color: #030303;
          border-right: 1px solid #1f2937;
          position: relative;
          flex-shrink: 0;
          z-index: 20;
        }
        .analysis-area {
          flex: 1;
          position: relative;
          background-color: #000;
          z-index: 10;
        }
      `}</style>
      
      {!track && !micStream ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center opacity-40">
            <svg className="w-32 h-32 mx-auto mb-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-2xl font-light tracking-widest uppercase text-gray-400">Select Input to Visualize</p>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 truncate">{micStream ? 'Live Field Analysis' : track?.name}</h1>
              <div className="flex items-center space-x-4">
                <span className={`px-2 py-0.5 border rounded text-[10px] font-bold uppercase tracking-wider ${micStream ? 'bg-red-900/30 text-red-400 border-red-800/50 animate-pulse' : 'bg-blue-900/30 text-blue-400 border-blue-800/50'}`}>
                  {micStream ? 'Live Monitor Active' : 'Analysis Engine Ready'}
                </span>
                {!micStream && <span className="text-gray-500 text-xs font-mono">{track?.relativePath}</span>}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {micStream && (
                <button 
                  onClick={runLiveCalibration}
                  disabled={isCalibrating}
                  className={`flex items-center space-x-2 px-4 py-2 border rounded-xl transition-all uppercase tracking-widest text-[10px] font-black shadow-2xl shadow-black ${
                    isCalibrating 
                    ? 'bg-blue-600 border-blue-400 text-white animate-pulse' 
                    : 'bg-gray-900 hover:bg-gray-800 border-gray-700 text-gray-400 hover:text-blue-400 hover:border-blue-900'
                  }`}
                >
                  <svg className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>{isCalibrating ? 'Scanning...' : 'Verify Scale'}</span>
                </button>
              )}
              <button onClick={takeSnapshot} className="flex items-center space-x-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl transition-all group shadow-2xl shadow-black">
                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-xs font-bold text-gray-400 group-hover:text-white uppercase tracking-tighter">Export Snapshot</span>
              </button>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-3xl p-6 md:p-8 shadow-3xl border border-gray-800 space-y-8">
            {!micStream && <div ref={waveformRef} className="w-full"></div>}
            
            <div className={`pt-6 ${!micStream ? 'border-t border-gray-800' : ''}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="space-y-1">
                  <h3 className="text-xs uppercase tracking-[0.2em] text-gray-500 font-black">{micStream ? 'Waterfall Spectrogram' : 'Static Spectrogram'}</h3>
                  <p className="text-[10px] text-gray-700 font-mono italic">{micStream ? 'Real-time analysis @ 48kHz' : 'Bio-acoustic scale 0 — 12 kHz'}</p>
                </div>
              </div>
              
              <div className="spectrogram-parent-container w-full rounded-3xl border-4 border-gray-800/50 shadow-2xl overflow-hidden bg-black">
                {/* Fixed gutter for frequency labels - NO OVERLAP with analysis area */}
                <div className="freq-gutter">
                  {freqLabels.map((f, i) => (
                    <div key={i} className="absolute left-0 w-full flex items-center pr-2" style={{ top: f.top, transform: 'translateY(-50%)' }}>
                      <span className="flex-1 text-[10px] font-black text-gray-300 font-mono tracking-tighter text-right">
                        {f.label}
                      </span>
                      <div className="w-2 h-[1.5px] bg-gray-500 ml-2" />
                    </div>
                  ))}
                </div>

                <div className="analysis-area">
                  {micStream ? (
                    <canvas id="live-waterfall" ref={liveCanvasRef} width={1200} height={320} className="w-full h-[320px]" />
                  ) : (
                    <div ref={spectrogramRef} className="w-full bg-black h-[320px]" />
                  )}
                  
                  {/* Subtle Grid overlay shifted to analysis area */}
                  <div className="absolute inset-0 pointer-events-none opacity-[0.05]">
                    {[1, 2, 3, 4, 5].map((i) => ( <div key={i} className="absolute w-full h-[1px] bg-white" style={{ top: `${i * 20}%` }} /> ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between text-[10px] font-mono pl-20">
                <div className="text-gray-400">
                  {isBuffering ? 'DECODING MP3 DATA...' : isCalibrating ? `SCALE VERIFICATION: ${calibFreq} Hz (Audible Signal)` : error ? `ERROR: ${error}` : 'SYSTEM READY'}
                </div>
                <div className="text-gray-500">{micStream ? `GAIN: ${micGain.toFixed(1)}x` : `VOL: ${Math.round(volume * 100)}%`}</div>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-gray-800">
              {!micStream ? (
                <div className="flex items-center space-x-6">
                  <button onClick={onPrev} className="text-gray-500 hover:text-white transition-colors">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                  </button>
                  <button onClick={() => wavesurfer.current?.playPause()} className="p-5 bg-blue-600 hover:bg-blue-500 rounded-full transition-all transform hover:scale-105 shadow-lg shadow-blue-600/20">
                    {isPlaying ? ( <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> ) : ( <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> )}
                  </button>
                  <button onClick={onNext} className="text-gray-500 hover:text-white transition-colors">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-4 bg-red-900/10 px-6 py-3 rounded-2xl border border-red-900/30">
                  <div className={`w-3 h-3 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)] ${isCalibrating ? 'animate-ping' : 'animate-pulse'}`} />
                  <span className="text-sm font-black text-red-400 uppercase tracking-widest">{isCalibrating ? 'Calibrating...' : 'Mic Active'}</span>
                </div>
              )}
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-4 bg-gray-950 px-6 py-3 rounded-full border border-gray-800">
                  <span className="text-[10px] font-black text-gray-500 uppercase">{micStream ? 'Mic Gain' : 'Volume'}</span>
                  <input type="range" min="0" max={micStream ? '5' : '1'} step="0.01" value={micStream ? micGain : volume} onChange={(e) => { const v = parseFloat(e.target.value); if (micStream) setMicGain(v); else { setVolume(v); wavesurfer.current?.setVolume(v); } }} className="w-24 md:w-32 accent-blue-500 cursor-pointer h-1 bg-gray-800 rounded-lg appearance-none" />
                  <span className="text-[10px] font-mono text-blue-500 w-10 text-right">{micStream ? `${micGain.toFixed(1)}x` : `${Math.round(volume * 100)}%`}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainPlayer;
