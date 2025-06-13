import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Heart } from 'lucide-react';

interface Note {
  id: string;
  lane: number;
  y: number;
  hit: boolean;
  missed: boolean;
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

  const gameRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const gameStartTimeRef = useRef<number>(0);

  const LANES = 4;
  const NOTE_SPEED = 300; // Increased speed for visibility
  const HIT_LINE_Y = 520;
  const HIT_TOLERANCE = 50;
  const GAME_HEIGHT = 600;

  // Simplified note pattern for testing
  const notePattern = [
    { time: 1000, lane: 0 },
    { time: 2000, lane: 1 },
    { time: 3000, lane: 2 },
    { time: 4000, lane: 3 },
    { time: 5000, lane: 0 },
    { time: 6000, lane: 1 },
    { time: 7000, lane: 2 },
    { time: 8000, lane: 3 },
    { time: 9000, lane: 0 },
    { time: 10000, lane: 1 },
  ];

  const spawnNote = useCallback((lane: number) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random()}`,
      lane,
      y: -50,
      hit: false,
      missed: false,
    };
    setNotes(prev => {
      console.log('Spawning note in lane:', lane, 'Total notes:', prev.length + 1);
      return [...prev, newNote];
    });
    setTotalNotes(prev => prev + 1);
  }, []);

  const createParticles = useCallback((x: number, y: number) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 10; i++) {
      newParticles.push({
        id: `particle-${Date.now()}-${i}`,
        x,
        y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
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
        updatedNotes[noteIndex].hit = true;
        const hitDistance = Math.abs(updatedNotes[noteIndex].y - HIT_LINE_Y);
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
        setTimeout(() => setShowHitEffect(null), 200);

        const laneX = (lane * (100 / LANES)) + (100 / LANES / 2);
        createParticles((laneX / 100) * (gameRef.current?.clientWidth || 400), HIT_LINE_Y);

        return updatedNotes.filter(note => note.id !== updatedNotes[noteIndex].id);
      }
      return updatedNotes;
    });
  }, [combo, LANES, HIT_LINE_Y, HIT_TOLERANCE, createParticles]);

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
      if (Math.abs(elapsedTime - pattern.time) < 50) { // 50ms tolerance for spawning
        // Check if we haven't spawned this note yet
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
            };
            console.log('Spawning note at time:', elapsedTime, 'lane:', pattern.lane);
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
        y: note.y + (NOTE_SPEED * 16) / 1000 // Assuming 60fps
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
    
    // Spawn a test note immediately to verify rendering
    setTimeout(() => {
      spawnNote(0);
      spawnNote(2);
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
            Notes: {notes.length}
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
                className="flex-1 border-r border-white/20 last:border-r-0 relative cursor-pointer hover:bg-white/5"
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleLaneTouch(index);
                }}
                onClick={() => handleLaneTouch(index)}
              >
                {showHitEffect === index && (
                  <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-white/50 rounded-full animate-ping" />
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
                  ? 'bg-green-400 scale-125' 
                  : note.missed 
                    ? 'bg-red-400 opacity-50' 
                    : 'bg-gradient-to-b from-pink-400 to-purple-500 border-2 border-white/30'
              }`}
              style={{
                left: `${(note.lane * (100 / LANES)) + (100 / LANES / 2)}%`,
                top: note.y,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="absolute inset-0 bg-white/20 rounded-lg" />
              <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">
                {note.lane + 1}
              </div>
            </div>
          ))}

          {/* Particles */}
          {particles.map(particle => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 bg-white rounded-full z-30"
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

        {/* Stats */}
        <div className="mt-6 text-center">
          <div className="text-white/70 text-sm">
            Max Combo: {maxCombo} | Notes Hit: {hitNotes}/{totalNotes}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RhythmGame;