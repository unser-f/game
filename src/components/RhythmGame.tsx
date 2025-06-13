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
  const lastTimeRef = useRef<number>(0);
  const spawnedNotesRef = useRef<Set<number>>(new Set());

  const LANES = 4;
  const NOTE_SPEED = 200;
  const HIT_LINE_Y = 520;
  const HIT_TOLERANCE = 50;
  const GAME_HEIGHT = 600;

  const notePattern = [
    { time: 500, lane: 0 },
    { time: 1000, lane: 2 },
    { time: 1500, lane: 1 },
    { time: 2000, lane: 3 },
    { time: 2500, lane: 0 },
    { time: 2800, lane: 1 },
    { time: 3200, lane: 2 },
    { time: 3600, lane: 3 },
    { time: 4000, lane: 1 },
    { time: 4400, lane: 0 },
    { time: 4600, lane: 2 },
    { time: 5000, lane: 3 },
    { time: 5400, lane: 1 },
    { time: 5800, lane: 0 },
    { time: 6200, lane: 2 },
    { time: 6600, lane: 3 },
    { time: 7000, lane: 1 },
    { time: 7200, lane: 0 },
    { time: 7500, lane: 2 },
    { time: 7800, lane: 3 },
    { time: 8200, lane: 1 },
    { time: 8600, lane: 0 },
    { time: 9000, lane: 2 },
    { time: 9400, lane: 3 },
    { time: 9800, lane: 1 },
    { time: 10200, lane: 0 },
    { time: 10600, lane: 2 },
    { time: 11000, lane: 3 },
    { time: 11400, lane: 1 },
    { time: 11800, lane: 0 },
    { time: 12200, lane: 2 },
    { time: 12600, lane: 3 },
  ];

  const spawnNote = useCallback((lane: number) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random()}`,
      lane,
      y: -50,
      hit: false,
      missed: false,
    };
    setNotes(prev => [...prev, newNote]);
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
    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    if (isPlaying) {
      setGameTime(prev => {
        const newTime = prev + deltaTime;
        
        // Check for notes to spawn
        notePattern.forEach((pattern, index) => {
          if (pattern.time <= newTime && !spawnedNotesRef.current.has(index)) {
            spawnNote(pattern.lane);
            spawnedNotesRef.current.add(index);
          }
        });

        return newTime;
      });

      // Update note positions
      setNotes(prev => {
        const updatedNotes = prev.map(note => ({
          ...note,
          y: note.y + (NOTE_SPEED * deltaTime) / 1000
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
          x: particle.x + (particle.vx * deltaTime) / 1000,
          y: particle.y + (particle.vy * deltaTime) / 1000,
          life: particle.life - deltaTime / 1000,
        })).filter(particle => particle.life > 0);
      });

      // Update accuracy
      if (totalNotes > 0) {
        setAccuracy(Math.round((hitNotes / totalNotes) * 100));
      }
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, totalNotes, hitNotes, spawnNote, NOTE_SPEED, HIT_LINE_Y, HIT_TOLERANCE, GAME_HEIGHT, notePattern]);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameLoop]);

  const startGame = () => {
    setIsPlaying(true);
    setGameTime(0);
    spawnedNotesRef.current.clear();
    lastTimeRef.current = performance.now();
  };

  const pauseGame = () => {
    setIsPlaying(false);
  };

  const resetGame = () => {
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
    spawnedNotesRef.current.clear();
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

        {/* Game Area */}
        <div 
          ref={gameRef}
          className="relative bg-black/20 backdrop-blur-sm rounded-lg overflow-hidden"
          style={{ height: GAME_HEIGHT }}
        >
          {/* Lanes */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: LANES }).map((_, index) => (
              <div
                key={index}
                className="flex-1 border-r border-white/20 last:border-r-0 relative cursor-pointer"
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
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-purple-500 shadow-lg shadow-pink-500/50"
            style={{ top: HIT_LINE_Y }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-purple-400 animate-pulse" />
          </div>

          {/* Notes */}
          {notes.map(note => (
            <div
              key={note.id}
              className={`absolute w-12 h-8 rounded-lg shadow-lg transition-all duration-75 ${
                note.hit 
                  ? 'bg-green-400 scale-125' 
                  : note.missed 
                    ? 'bg-red-400 opacity-50' 
                    : 'bg-gradient-to-b from-pink-400 to-purple-500'
              }`}
              style={{
                left: `${(note.lane * (100 / LANES)) + (100 / LANES / 2) - 6}%`,
                top: note.y,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="absolute inset-0 bg-white/20 rounded-lg" />
            </div>
          ))}

          {/* Particles */}
          {particles.map(particle => (
            <div
              key={particle.id}
              className="absolute w-2 h-2 bg-white rounded-full"
              style={{
                left: particle.x,
                top: particle.y,
                opacity: particle.life / particle.maxLife,
              }}
            />
          ))}

          {/* Lane indicators at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-16 flex">
            {Array.from({ length: LANES }).map((_, index) => (
              <div
                key={index}
                className="flex-1 border-r border-white/20 last:border-r-0 flex items-center justify-center"
              >
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-white/40" />
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
          {isPlaying && (
            <div className="text-white/50 text-xs mt-1">
              Game Time: {(gameTime / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RhythmGame;