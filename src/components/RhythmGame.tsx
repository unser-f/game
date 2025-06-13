import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Heart, Volume2 } from 'lucide-react';

interface Note {
  id: string;
  lane: number;
  y: number;
  hit: boolean;
  missed: boolean;
  frequency: number; // Add frequency for audio
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

const RhythmGame: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [totalNotes, setTotalNotes] = useState(0);
  const [hitNotes, setHitNotes] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const [showHitEffect, setShowHitEffect] = useState<number | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const gameRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const gameStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const LANES = 4;
  const NOTE_SPEED = 300;
  const HIT_LINE_Y = 520;
  const HIT_TOLERANCE = 50;
  const GAME_HEIGHT = 600;

  // Musical frequencies for "Can't Help Falling in Love" melody
  // Using C major scale: C4, D4, E4, F4, G4, A4, B4, C5
  const frequencies = {
    C4: 261.63,
    D4: 293.66,
    E4: 329.63,
    F4: 349.23,
    G4: 392.00,
    A4: 440.00,
    B4: 493.88,
    C5: 523.25
  };

  // Melody pattern for "Can't Help Falling in Love"
  // Simplified version of the main melody
  const notePattern = [
    { time: 1000, lane: 0, frequency: frequencies.C4 }, // "Wise"
    { time: 2000, lane: 1, frequency: frequencies.E4 }, // "men"
    { time: 3000, lane: 2, frequency: frequencies.G4 }, // "say"
    { time: 4000, lane: 3, frequency: frequencies.C5 }, // "only"
    { time: 5000, lane: 0, frequency: frequencies.B4 }, // "fools"
    { time: 6000, lane: 1, frequency: frequencies.A4 }, // "rush"
    { time: 7000, lane: 2, frequency: frequencies.G4 }, // "in"
    { time: 8000, lane: 3, frequency: frequencies.F4 }, // "but"
    { time: 9000, lane: 0, frequency: frequencies.E4 }, // "I"
    { time: 10000, lane: 1, frequency: frequencies.D4 }, // "can't"
    { time: 11000, lane: 2, frequency: frequencies.C4 }, // "help"
    { time: 12000, lane: 3, frequency: frequencies.G4 }, // "falling"
    { time: 13000, lane: 0, frequency: frequencies.C5 }, // "in"
    { time: 14000, lane: 1, frequency: frequencies.G4 }, // "love"
    { time: 15000, lane: 2, frequency: frequencies.E4 }, // "with"
    { time: 16000, lane: 3, frequency: frequencies.C4 }, // "you"
  ];

  // Initialize audio context
  useEffect(() => {
    if (audioEnabled && !audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Web Audio API not supported:', error);
        setAudioEnabled(false);
      }
    }
  }, [audioEnabled]);

  // Play musical note
  const playNote = useCallback((frequency: number, duration: number = 0.5) => {
    if (!audioEnabled || !audioContextRef.current) return;

    try {
      const audioContext = audioContextRef.current;
      
      // Resume audio context if suspended (required for user interaction)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Create oscillator for the main tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Set frequency and waveform
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine'; // Smooth, pleasant tone
      
      // Create envelope (attack, decay, sustain, release)
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05); // Attack
      gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.1); // Decay
      gainNode.gain.setValueAtTime(0.2, now + duration - 0.1); // Sustain
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Release
      
      // Start and stop
      oscillator.start(now);
      oscillator.stop(now + duration);

      // Add some harmonic richness with a subtle second oscillator
      const harmonic = audioContext.createOscillator();
      const harmonicGain = audioContext.createGain();
      
      harmonic.connect(harmonicGain);
      harmonicGain.connect(audioContext.destination);
      
      harmonic.frequency.setValueAtTime(frequency * 2, now); // Octave higher
      harmonic.type = 'sine';
      
      harmonicGain.gain.setValueAtTime(0, now);
      harmonicGain.gain.linearRampToValueAtTime(0.05, now + 0.05);
      harmonicGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      
      harmonic.start(now);
      harmonic.stop(now + duration);
      
    } catch (error) {
      console.warn('Error playing note:', error);
    }
  }, [audioEnabled]);

  const spawnNote = useCallback((lane: number, frequency: number) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random()}`,
      lane,
      y: -50,
      hit: false,
      missed: false,
      frequency,
    };
    setNotes(prev => {
      console.log('Spawning note in lane:', lane, 'frequency:', frequency, 'Total notes:', prev.length + 1);
      return [...prev, newNote];
    });
    setTotalNotes(prev => prev + 1);
  }, []);

  const createParticles = useCallback((x: number, y: number) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 15; i++) {
      newParticles.push({
        id: `particle-${Date.now()}-${i}`,
        x,
        y,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300,
        life: 1,
        maxLife: 1,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const hitNote = useCallback((lane: number) => {
    setNotes(prev => {
      const updatedNotes = [...prev];
      const noteIndex = updatedNotes.findIndex(
        note => note.lane === lane && 
        !note.hit && 
        !note.missed && 
        Math.abs(note.y - HIT_LINE_Y) <= HIT_TOLERANCE
      );

      if (noteIndex >= 0) {
        const hitNote = updatedNotes[noteIndex];
        updatedNotes[noteIndex].hit = true;
        
        // Play the musical note!
        playNote(hitNote.frequency, 0.6);
        
        const hitDistance = Math.abs(hitNote.y - HIT_LINE_Y);
        let points = 100;
        
        if (hitDistance <= 20) points = 300;
        else if (hitDistance <= 35) points = 200;
        else points = 100;

        setScore(prev => prev + points * (combo + 1));
        setCombo(prev => {
          const newCombo = prev + 1;
          setMaxCombo(max => Math.max(max, newCombo));
          return newCombo;
        });
        setHitNotes(prev => prev + 1);
        setShowHitEffect(lane);
        setTimeout(() => setShowHitEffect(null), 300);

        const laneX = (lane * (100 / LANES)) + (100 / LANES / 2);
        createParticles((laneX / 100) * (gameRef.current?.clientWidth || 400), HIT_LINE_Y);

        return updatedNotes.filter(note => note.id !== hitNote.id);
      }
      return updatedNotes;
    });
  }, [combo, LANES, HIT_LINE_Y, HIT_TOLERANCE, createParticles, playNote]);

  const handleLaneTouch = useCallback((lane: number) => {
    hitNote(lane);
  }, [hitNote]);

  const gameLoop = useCallback((currentTime: number) => {
    if (!isPlaying) {
      animationRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const elapsedTime = currentTime - gameStartTimeRef.current;
    setGameTime(elapsedTime);

    // Spawn notes based on pattern
    notePattern.forEach((pattern) => {
      if (Math.abs(elapsedTime - pattern.time) < 50) {
        setNotes(prev => {
          const alreadyExists = prev.some(note => 
            Math.abs(note.y - (-50)) < 10 && note.lane === pattern.lane
          );
          if (!alreadyExists) {
            const newNote: Note = {
              id: `note-${pattern.time}-${pattern.lane}`,
              lane: pattern.lane,
              y: -50,
              hit: false,
              missed: false,
              frequency: pattern.frequency,
            };
            console.log('Spawning note at time:', elapsedTime, 'lane:', pattern.lane, 'frequency:', pattern.frequency);
            setTotalNotes(prev => prev + 1);
            return [...prev, newNote];
          }
          return prev;
        });
      }
    });

    // Update note positions
    setNotes(prev => {
      const updatedNotes = prev.map(note => ({
        ...note,
        y: note.y + (NOTE_SPEED * 16) / 1000
      }));

      return updatedNotes.map(note => {
        if (!note.hit && !note.missed && note.y > HIT_LINE_Y + HIT_TOLERANCE) {
          setCombo(0);
          return { ...note, missed: true };
        }
        return note;
      }).filter(note => note.y < GAME_HEIGHT + 50);
    });

    // Update particles
    setParticles(prev => {
      return prev.map(particle => ({
        ...particle,
        x: particle.x + (particle.vx * 16) / 1000,
        y: particle.y + (particle.vy * 16) / 1000,
        life: particle.life - 16 / 1000,
      })).filter(particle => particle.life > 0);
    });

    // Update accuracy
    if (totalNotes > 0) {
      setAccuracy(Math.round((hitNotes / totalNotes) * 100));
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, totalNotes, hitNotes, NOTE_SPEED, HIT_LINE_Y, HIT_TOLERANCE, GAME_HEIGHT, notePattern]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameLoop]);

  const startGame = () => {
    console.log('Starting game...');
    setIsPlaying(true);
    setGameTime(0);
    gameStartTimeRef.current = performance.now();
    
    // Initialize audio context on user interaction
    if (audioEnabled && audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    // Spawn test notes immediately
    setTimeout(() => {
      spawnNote(0, frequencies.C4);
      spawnNote(2, frequencies.G4);
    }, 100);
  };

  const pauseGame = () => {
    setIsPlaying(false);
  };

  const resetGame = () => {
    console.log('Resetting game...');
    setIsPlaying(false);
    setNotes([]);
    setParticles([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setAccuracy(100);
    setTotalNotes(0);
    setHitNotes(0);
    setGameTime(0);
    gameStartTimeRef.current = 0;
  };

  const toggleAudio = () => {
    setAudioEnabled(prev => !prev);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-screen">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Heart className="w-8 h-8 text-pink-400" />
            <h1 className="text-2xl font-bold text-white">Can't Help Falling</h1>
            <Heart className="w-8 h-8 text-pink-400" />
          </div>
          <p className="text-pink-200">in Love with You</p>
          <p className="text-pink-300/70 text-sm mt-1">Hit the notes to play the melody!</p>
        </div>

        {/* Audio Toggle */}
        <div className="flex justify-center mb-4">
          <button
            onClick={toggleAudio}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
              audioEnabled 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            Audio: {audioEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Score Display */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-yellow-400 text-lg font-bold">{score.toLocaleString()}</div>
              <div className="text-white/70 text-sm">Score</div>
            </div>
            <div>
              <div className="text-orange-400 text-lg font-bold">{combo}</div>
              <div className="text-white/70 text-sm">Combo</div>
            </div>
            <div>
              <div className="text-green-400 text-lg font-bold">{accuracy}%</div>
              <div className="text-white/70 text-sm">Accuracy</div>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="bg-black/20 backdrop-blur-sm rounded-lg p-2 mb-4 text-center">
          <div className="text-white/70 text-xs">
            Playing: {isPlaying ? 'Yes' : 'No'} | 
            Time: {(gameTime / 1000).toFixed(1)}s | 
            Notes: {notes.length} |
            Audio: {audioEnabled ? 'ON' : 'OFF'}
          </div>
        </div>

        {/* Game Area */}
        <div 
          ref={gameRef}
          className="relative bg-black/20 backdrop-blur-sm rounded-lg overflow-hidden border-2 border-white/20"
          style={{ height: GAME_HEIGHT }}
        >
          {/* Lanes */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: LANES }).map((_, index) => (
              <div
                key={index}
                className="flex-1 border-r border-white/20 last:border-r-0 relative cursor-pointer hover:bg-white/5 transition-colors"
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleLaneTouch(index);
                }}
                onClick={() => handleLaneTouch(index)}
              >
                {showHitEffect === index && (
                  <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full animate-ping opacity-75" />
                )}
              </div>
            ))}
          </div>

          {/* Hit Line */}
          <div 
            className="absolute left-0 right-0 h-2 bg-gradient-to-r from-pink-500 to-purple-500 shadow-lg shadow-pink-500/50 z-10"
            style={{ top: HIT_LINE_Y }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-purple-400 animate-pulse" />
          </div>

          {/* Notes */}
          {notes.map(note => (
            <div
              key={note.id}
              className={`absolute w-16 h-12 rounded-lg shadow-lg transition-all duration-75 z-20 ${
                note.hit 
                  ? 'bg-gradient-to-b from-green-400 to-green-600 scale-125 shadow-green-400/50' 
                  : note.missed 
                    ? 'bg-gradient-to-b from-red-400 to-red-600 opacity-50' 
                    : 'bg-gradient-to-b from-pink-400 to-purple-500 border-2 border-white/30 shadow-pink-400/30'
              }`}
              style={{
                left: `${(note.lane * (100 / LANES)) + (100 / LANES / 2)}%`,
                top: note.y,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="absolute inset-0 bg-white/20 rounded-lg" />
              <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">
                ♪
              </div>
            </div>
          ))}

          {/* Particles */}
          {particles.map(particle => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full z-30"
              style={{
                left: particle.x,
                top: particle.y,
                opacity: particle.life / particle.maxLife,
              }}
            />
          ))}

          {/* Lane indicators at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-16 flex z-10">
            {Array.from({ length: LANES }).map((_, index) => (
              <div
                key={index}
                className="flex-1 border-r border-white/20 last:border-r-0 flex items-center justify-center"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                  <div className="text-white font-bold text-sm">{index + 1}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={startGame}
            disabled={isPlaying}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <Play className="w-5 h-5" />
            Start
          </button>
          <button
            onClick={pauseGame}
            disabled={!isPlaying}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <Pause className="w-5 h-5" />
            Pause
          </button>
          <button
            onClick={resetGame}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-6 text-center">
          <div className="text-white/70 text-sm mb-2">
            Max Combo: {maxCombo} | Notes Hit: {hitNotes}/{totalNotes}
          </div>
          <div className="text-pink-200/70 text-xs">
            Click or tap the lanes when notes reach the glowing line to play the melody!
          </div>
        </div>
      </div>
    </div>
  );
};

export default RhythmGame;