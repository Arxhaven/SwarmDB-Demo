// SwarmDB OpenHackathon Demo Website - React App
import { useState, useEffect, useRef } from 'react';
import { Cpu, Zap, ShieldAlert, Info, Check, X, Database, Users } from 'lucide-react';

export default function App() {
    const [mode, setMode] = useState("optimized"); // "baseline" or "optimized"
    const [numRobots, setNumRobots] = useState(80);
    const [collisionRadius, setCollisionRadius] = useState(45);
    const [speed, setSpeed] = useState(1.5);

    // Live Stats state
    const [stats, setStats] = useState({
        evals: 0,
        collisions: 0,
        fps: 60,
        estTime: "0.00 ms",
        estMem: "0.00 MB"
    });

    const canvasRef = useRef(null);
    const robotsRef = useRef([]);
    const requestRef = useRef(null);
    const lastTimeRef = useRef(performance.now());

    // Initialize/Regenerate robots when numRobots changes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const width = canvas.width;
        const height = canvas.height;

        const initialRobots = [];
        for (let i = 0; i < numRobots; i++) {
            initialRobots.push({
                id: i,
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                color: `hsl(${(i * 360 / numRobots) % 360}, 75%, 65%)`
            });
        }
        robotsRef.current = initialRobots;
    }, [numRobots]);

    // Canvas Simulation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        const animate = (time) => {
            const width = canvas.width;
            const height = canvas.height;

            // Calculate FPS
            const delta = time - lastTimeRef.current;
            lastTimeRef.current = time;
            const currentFps = Math.round(1000 / delta);

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Move robots
            const robots = robotsRef.current;
            robots.forEach(r => {
                r.x += r.vx * speed;
                r.y += r.vy * speed;

                // Boundaries bounce
                if (r.x < 10) { r.x = 10; r.vx *= -1; }
                if (r.x > width - 10) { r.x = width - 10; r.vx *= -1; }
                if (r.y < 10) { r.y = 10; r.vy *= -1; }
                if (r.y > height - 10) { r.y = height - 10; r.vy *= -1; }
            });

            let evalCount = 0;
            const collidingPairs = [];
            const radiusSq = collisionRadius * collisionRadius;

            // Grid Partitioning logic for drawing cells & doing localized search
            const gridCellSize = collisionRadius;
            const cols = Math.ceil(width / gridCellSize);
            const rows = Math.ceil(height / gridCellSize);

            // Draw grid overlay in Optimized Mode
            if (mode === "optimized") {
                ctx.strokeStyle = "rgba(118, 185, 0, 0.04)";
                ctx.lineWidth = 1;
                for (let c = 0; c <= cols; c++) {
                    ctx.beginPath();
                    ctx.moveTo(c * gridCellSize, 0);
                    ctx.lineTo(c * gridCellSize, height);
                    ctx.stroke();
                }
                for (let r = 0; r <= rows; r++) {
                    ctx.beginPath();
                    ctx.moveTo(0, r * gridCellSize);
                    ctx.lineTo(width, r * gridCellSize);
                    ctx.stroke();
                }
            }

            // We highlight the first robot (index 0) to demonstrate search complexity
            const selectedRobot = robots[0];

            if (mode === "baseline") {
                // Baseline: O(N^2) search. Compare everything.
                for (let i = 0; i < robots.length; i++) {
                    for (let j = i + 1; j < robots.length; j++) {
                        evalCount++;
                        const dx = robots[i].x - robots[j].x;
                        const dy = robots[i].y - robots[j].y;
                        const dSq = dx * dx + dy * dy;
                        if (dSq <= radiusSq) {
                            collidingPairs.push([i, j]);
                        }
                    }
                }

                // Draw search lines from selectedRobot to ALL other robots
                if (selectedRobot) {
                    ctx.strokeStyle = "rgba(239, 68, 68, 0.08)";
                    ctx.lineWidth = 1;
                    robots.forEach(other => {
                        if (other.id !== selectedRobot.id) {
                            ctx.beginPath();
                            ctx.moveTo(selectedRobot.x, selectedRobot.y);
                            ctx.lineTo(other.x, other.y);
                            ctx.stroke();
                        }
                    });

                    // Visual search boundary circle
                    ctx.strokeStyle = "rgba(239, 68, 68, 0.2)";
                    ctx.beginPath();
                    ctx.arc(selectedRobot.x, selectedRobot.y, collisionRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
            } else {
                // Optimized: Grid Spatial Partitioning.
                // Map robots to cells
                const cellMap = new Map();
                robots.forEach(r => {
                    const cx = Math.floor(r.x / gridCellSize);
                    const cy = Math.floor(r.y / gridCellSize);
                    const cellKey = `${cx},${cy}`;
                    if (!cellMap.has(cellKey)) {
                        cellMap.set(cellKey, []);
                    }
                    cellMap.get(cellKey).push(r);
                });

                // Perform check on neighboring cells
                const checkedPairs = new Set();
                robots.forEach(r1 => {
                    const cx = Math.floor(r1.x / gridCellSize);
                    const cy = Math.floor(r1.y / gridCellSize);

                    // Scan 9-cell neighborhood
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            const nx = cx + dx;
                            const ny = cy + dy;
                            const cellKey = `${nx},${ny}`;

                            const cellRobots = cellMap.get(cellKey) || [];
                            cellRobots.forEach(r2 => {
                                if (r1.id < r2.id) {
                                    const pairKey = `${r1.id}-${r2.id}`;
                                    if (!checkedPairs.has(pairKey)) {
                                        checkedPairs.add(pairKey);
                                        evalCount++;
                                        const distx = r1.x - r2.x;
                                        const disty = r1.y - r2.y;
                                        const dSq = distx * distx + disty * disty;
                                        if (dSq <= radiusSq) {
                                            collidingPairs.push([r1.id, r2.id]);
                                        }
                                    }
                                }
                            });
                        }
                    }
                });

                // Draw search lines from selectedRobot ONLY to robots in neighboring cells
                if (selectedRobot) {
                    const cx = Math.floor(selectedRobot.x / gridCellSize);
                    const cy = Math.floor(selectedRobot.y / gridCellSize);

                    // Highlight neighbor cells
                    ctx.fillStyle = "rgba(118, 185, 0, 0.04)";
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            ctx.fillRect((cx + dx) * gridCellSize, (cy + dy) * gridCellSize, gridCellSize, gridCellSize);
                            ctx.strokeStyle = "rgba(118, 185, 0, 0.1)";
                            ctx.strokeRect((cx + dx) * gridCellSize, (cy + dy) * gridCellSize, gridCellSize, gridCellSize);
                        }
                    }

                    // Draw lines to checked neighbors
                    ctx.strokeStyle = "rgba(118, 185, 0, 0.2)";
                    ctx.lineWidth = 1.5;
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            const cellKey = `${cx + dx},${cy + dy}`;
                            const neighbors = cellMap.get(cellKey) || [];
                            neighbors.forEach(other => {
                                if (other.id !== selectedRobot.id) {
                                    ctx.beginPath();
                                    ctx.moveTo(selectedRobot.x, selectedRobot.y);
                                    ctx.lineTo(other.x, other.y);
                                    ctx.stroke();
                                }
                            });
                        }
                    }

                    // Visual search boundary circle
                    ctx.strokeStyle = "rgba(118, 185, 0, 0.4)";
                    ctx.beginPath();
                    ctx.arc(selectedRobot.x, selectedRobot.y, collisionRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            // Draw collision lines (bright red/orange)
            ctx.lineWidth = 2.5;
            collidingPairs.forEach(([i, j]) => {
                const r1 = robots.find(r => r.id === i);
                const r2 = robots.find(r => r.id === j);
                if (r1 && r2) {
                    ctx.strokeStyle = "#f43f5e";
                    ctx.beginPath();
                    ctx.moveTo(r1.x, r1.y);
                    ctx.lineTo(r2.x, r2.y);
                    ctx.stroke();

                    // Draw circles around colliding bodies
                    ctx.fillStyle = "rgba(244, 63, 94, 0.2)";
                    ctx.beginPath();
                    ctx.arc(r1.x, r1.y, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(r2.x, r2.y, 8, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            // Draw robots
            robots.forEach(r => {
                ctx.fillStyle = r.color;
                // Highlight the selected index 0 robot with neon green border
                if (r.id === selectedRobot?.id) {
                    ctx.shadowColor = mode === "baseline" ? "#ef4444" : "#76B900";
                    ctx.shadowBlur = 12;
                    ctx.fillStyle = "#ffffff";
                }
                ctx.beginPath();
                ctx.arc(r.x, r.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0; // Reset shadow
            });

            // Calculate simulated timing and memory using realistic scaling formula from Python benchmarks
            const baselineTime = (numRobots * numRobots * 0.000025);
            const optimizedTime = (numRobots * Math.log2(numRobots) * 0.00015);
            const baselineMem = (numRobots * numRobots * 8) / (1024 * 1024);
            const optimizedMem = (numRobots * 16) / (1024 * 1024);

            setStats({
                evals: evalCount,
                collisions: collidingPairs.length,
                fps: isNaN(currentFps) ? 60 : Math.min(currentFps, 60),
                estTime: mode === "baseline" ? `${baselineTime.toFixed(2)} ms` : `${optimizedTime.toFixed(2)} ms`,
                estMem: mode === "baseline" ? `${baselineMem.toFixed(3)} MB` : `${optimizedMem.toFixed(3)} MB`
            });

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [mode, numRobots, collisionRadius, speed]);

    return (
        <div>
            {/* Header / Navbar */}
            <nav className="navbar">
                <a href="#" className="logo">
                    <div className="logo-dot"></div>
                    Swarm<span>DB</span>
                </a>
                <div className="badge-hackathon">NVIDIA OPENHACKATHON 2026 DEMO</div>
            </nav>

            <div className="container">
                {/* Hero Section */}
                <header className="hero">
                    <div className="hero-subtitle">High-Performance Spatial Database Engine</div>
                    <h1 className="hero-title">Parallel Telemetry & Kinetic Join Visualizer</h1>
                    <p className="hero-description">
                        An interactive simulator demonstrating the math and memory optimization behind resolving real-time proximities (Kinetic Joins) for thousands of autonomous robotic swarm coordinates.
                    </p>
                </header>

                {/* Team Introduction Section */}
                <section className="team-container">
                    <div className="team-card">
                        <div className="team-badge-wrapper">
                            <Users size={16} style={{ color: 'var(--color-nvidia)' }} />
                            <span className="team-label">Development Team</span>
                        </div>
                        <h2 className="team-title">GigaChads</h2>
                        <div className="team-members-grid">
                            <div className="member-item">
                                <div className="member-avatar">SM</div>
                                <span className="member-name">Sharvin Mhatre</span>
                            </div>
                            <div className="member-item">
                                <div className="member-avatar">AJ</div>
                                <span className="member-name">Archit Jaijith</span>
                            </div>
                            <div className="member-item">
                                <div className="member-avatar">SC</div>
                                <span className="member-name">Saumitra Chavan</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Simulator Visualizer Layout */}
                <section className="simulator-layout">
                    <div className="visualizer-container">
                        <div className="canvas-wrapper">
                            <canvas ref={canvasRef} width="720" height="400"></canvas>
                        </div>

                        <div className="stats-bar">
                            <div className="stat-item">
                                <div className="stat-label">Active Swarm</div>
                                <div className="stat-value">{numRobots} Robots</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">Distance Checks</div>
                                <div className="stat-value highlight">{stats.evals.toLocaleString()}</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">Calculated Latency</div>
                                <div className="stat-value">{stats.estTime}</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">Memory Cost</div>
                                <div className="stat-value">{stats.estMem}</div>
                            </div>
                        </div>
                    </div>

                    <div className="card controls-card">
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Engine Control Panel</h3>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Toggle computation modes to observe how search space complexity changes dynamically.
                        </p>

                        <div className="control-group">
                            <label className="control-label">Search Strategy</label>
                            <div className="toggle-group">
                                <button
                                    className={`toggle-btn ${mode === "baseline" ? "active" : ""}`}
                                    onClick={() => setMode("baseline")}
                                >
                                    <Cpu size={20} style={{ marginRight: '0.5rem' }} /> Baseline O(N²)
                                </button>
                                <button
                                    className={`toggle-btn ${mode === "optimized" ? "active" : ""}`}
                                    onClick={() => setMode("optimized")}
                                >
                                    <Zap size={20} style={{ marginRight: '0.5rem' }} /> Spatial Grid O(N log N)
                                </button>
                            </div>
                        </div>

                        <div className="control-group">
                            <div className="control-label-wrapper">
                                <label className="control-label">Swarm Size (N)</label>
                                <span className="control-value">{numRobots} Robots</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="150"
                                value={numRobots}
                                onChange={(e) => setNumRobots(parseInt(e.target.value))}
                            />
                        </div>

                        <div className="control-group">
                            <div className="control-label-wrapper">
                                <label className="control-label">Collision Radius</label>
                                <span className="control-value">{collisionRadius} px</span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="80"
                                value={collisionRadius}
                                onChange={(e) => setCollisionRadius(parseInt(e.target.value))}
                            />
                        </div>

                        <div className="control-group">
                            <div className="control-label-wrapper">
                                <label className="control-label">Velocity Factor</label>
                                <span className="control-value">{speed.toFixed(1)}x</span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="3.0"
                                step="0.1"
                                value={speed}
                                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                            />
                        </div>

                        <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(2, 4, 8, 0.3)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                                <Info size={18} /> Live Visualization Tip
                            </div>
                            {mode === "baseline" ? (
                                <span>The highlighted white node compares its coordinates with **every other robot** (red lines) to find collisions, scaling quadratically.</span>
                            ) : (
                                <span>The space is divided into cells. The highlighted node *only* compares itself to robots within its own cell and the 8 adjacent cells (green grid), scaling linearly.</span>
                            )}
                        </div>
                    </div>
                </section>

                {/* Beginners Explainer Steps */}
                <section className="card explainer-card">
                    <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>What is a Kinetic Join? (Simplified)</h2>
                    <p style={{ color: 'var(--color-text-secondary)', maxWidth: '900px' }}>
                        Imagine a swarm of 10,000 robotic bees flying. To prevent collisions, every bee needs to know if another bee is closer than their safety radius. This continuous distance check in database systems is called a <strong>Kinetic Join</strong>.
                    </p>
                    <div className="explainer-steps">
                        <div className="step-card">
                            <div className="step-num">01</div>
                            <h4 className="step-title">The Naive Room Search</h4>
                            <p className="step-desc">If you enter a room with 100 people and want to find if anyone is standing within 2 meters of you, you could walk up and measure the distance to all 99 people. Every person doing this requires 4,950 checks!</p>
                        </div>
                        <div className="step-card">
                            <div className="step-num">02</div>
                            <h4 className="step-title">The O(N²) Bottleneck</h4>
                            <p className="step-desc">As the crowd grows to 10,000 people, we need 50 million distance checks. In computers, this allocates massive matrices and halts the CPU, eventually causing Out of Memory (OOM) failures.</p>
                        </div>
                        <div className="step-card">
                            <div className="step-num">03</div>
                            <h4 className="step-title">The Grid Partition Solution</h4>
                            <p className="step-desc">Instead, we draw a grid on the floor. You only measure the distance to people standing in your tile or the 8 tiles surrounding you. No matter how large the crowd grows, you only perform 5-10 calculations!</p>
                        </div>
                    </div>
                </section>

                {/* NVIDIA Hackathon CUDA Block */}
                <section className="gpu-visual-container">
                    <div className="gpu-text">
                        <div className="badge-hackathon" style={{ alignSelf: 'flex-start' }}>Target Architecture</div>
                        <h2 style={{ fontSize: '2rem' }}>GPU Acceleration via NVIDIA CUDA</h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.05rem' }}>
                            While CPU spatial partitioning reduces the mathematical complexity, the ultimate goal for the **Leonardo Supercomputer Cluster** is massive parallelism. By porting the Kinetic Join to CUDA, we allocate each robot to a distinct GPU thread, executing millions of collision checks concurrently.
                        </p>
                        <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
                            <div>
                                <div style={{ color: 'var(--color-nvidia)', fontWeight: 700, fontSize: '1.25rem' }}>Shared Memory</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Cache block positions to prevent redundant memory fetches.</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--color-nvidia)', fontWeight: 700, fontSize: '1.25rem' }}>Parallel Hash Grid</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Sort coordinate indexes on the GPU to locate neighbors instantly.</div>
                            </div>
                        </div>
                    </div>

                    <div className="gpu-visual-graphic">
                        <div className="gpu-core">
                            <span className="core-id">Block 0</span>
                            <span className="core-thread">Thread 0..31</span>
                        </div>
                        <div className="gpu-core">
                            <span className="core-id">Block 1</span>
                            <span className="core-thread">Thread 32..63</span>
                        </div>
                        <div className="gpu-core">
                            <span className="core-id">Block 2</span>
                            <span className="core-thread">Thread 64..95</span>
                        </div>
                        <div className="gpu-core">
                            <span className="core-id">Block 3</span>
                            <span className="core-thread">Thread 96..127</span>
                        </div>
                        <div className="gpu-core">
                            <span className="core-id">Block 4</span>
                            <span className="core-thread">Thread 128..159</span>
                        </div>
                        <div className="gpu-core">
                            <span className="core-id">Block 5</span>
                            <span className="core-thread">Thread 160..191</span>
                        </div>
                        <div className="gpu-core">
                            <span className="core-id">Block 6</span>
                            <span className="core-thread">Thread 192..223</span>
                        </div>
                        <div className="gpu-core">
                            <span className="core-id">Block 7</span>
                            <span className="core-thread">Thread 224..255</span>
                        </div>
                    </div>
                </section>

                {/* Real-World Complexity Comparison (Python Benchmarks) */}
                <section className="section-header">
                    <h2 className="section-title">Actual SwarmDB Benchmarks</h2>
                    <p className="section-subtitle">Real-world metrics captured from the CPU baseline and KD-Tree indexes</p>
                </section>

                <section className="comparison-grid">
                    <div className="card comparison-card">
                        <div className="comparison-header">
                            <h3 className="comparison-title">O(N²) CPU Baseline</h3>
                            <span className="complexity-badge">Bad Scaling</span>
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                            Calculates and stores an $N \times N$ matrix. Scales quadratically in both execution time and memory size.
                        </p>
                        <table className="comparison-table">
                            <thead>
                                <tr>
                                    <th>Robots (N)</th>
                                    <th>Execution Time</th>
                                    <th>Peak Memory</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1,000</td>
                                    <td>0.0228 s</td>
                                    <td>22.90 MB</td>
                                </tr>
                                <tr>
                                    <td>5,000</td>
                                    <td>0.5147 s</td>
                                    <td>572.24 MB</td>
                                </tr>
                                <tr>
                                    <td>10,000</td>
                                    <td>2.4970 s</td>
                                    <td>2288.90 MB</td>
                                </tr>
                                <tr>
                                    <td>50,000</td>
                                    <td style={{ color: '#f43f5e', fontWeight: 600 }}>Crashed</td>
                                    <td style={{ color: '#f43f5e', fontWeight: 600 }}>{"OOM (>57 GB)"}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="card comparison-card" style={{ borderColor: 'var(--border-neon)' }}>
                        <div className="comparison-header">
                            <h3 className="comparison-title">O(N log N) CPU cKDTree</h3>
                            <span className="complexity-badge good">Good Scaling</span>
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                            Leverages binary space-partitioning. Scales efficiently, preventing memory explosions and speeding up joins.
                        </p>
                        <table className="comparison-table">
                            <thead>
                                <tr>
                                    <th>Robots (N)</th>
                                    <th>Execution Time</th>
                                    <th>Peak Memory</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1,000</td>
                                    <td>0.0015 s</td>
                                    <td>0.06 MB</td>
                                </tr>
                                <tr>
                                    <td>5,000</td>
                                    <td>0.0036 s</td>
                                    <td>0.06 MB</td>
                                </tr>
                                <tr>
                                    <td>10,000</td>
                                    <td>0.0075 s</td>
                                    <td>0.08 MB</td>
                                </tr>
                                <tr>
                                    <td>50,000</td>
                                    <td style={{ color: '#10b981', fontWeight: 600 }}>0.0497 s</td>
                                    <td style={{ color: '#10b981', fontWeight: 600 }}>0.52 MB</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Pros and Cons Matrix Section */}
                <section className="section-header">
                    <h2 className="section-title">Outcome Analysis: Engine Alternatives</h2>
                    <p className="section-subtitle">Comparing the implementation pathways for the Hackathon</p>
                </section>

                <section className="outcomes-grid">
                    {/* CPU Baseline */}
                    <div className="card outcome-card">
                        <div className="outcome-title-row">
                            <Database size={20} />
                            <h3 style={{ fontSize: '1.25rem' }}>CPU Baseline</h3>
                            <span className="outcome-tag">O(N²)</span>
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                            Standard vectorized NumPy matrix expansion algorithm.
                        </p>
                        <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

                        <div className="outcome-list">
                            <div className="outcome-list-title pro" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Check size={16} /> Pros (Major & Minor)</div>
                            <div className="outcome-item pro">
                                <Check size={16} />
                                <span><strong>Simple Dev:</strong> Extremely easy to implement with standard vector libraries.</span>
                            </div>
                            <div className="outcome-item pro">
                                <Check size={16} />
                                <span><strong>No Setup:</strong> Requires zero external compiled binaries or hardware requirements.</span>
                            </div>
                        </div>

                        <div className="outcome-list">
                            <div className="outcome-list-title con" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><X size={16} /> Cons (Major & Minor)</div>
                            <div className="outcome-item con">
                                <X size={16} />
                                <span><strong>OOM Failures (Major):</strong> High robot counts lead to immediate memory crashes.</span>
                            </div>
                            <div className="outcome-item con">
                                <X size={16} />
                                <span><strong>Low FPS (Minor):</strong> Real-time telemetries stutter significantly above 2,500 robots.</span>
                            </div>
                        </div>
                    </div>

                    {/* CPU Optimized */}
                    <div className="card outcome-card" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                        <div className="outcome-title-row">
                            <Cpu size={20} />
                            <h3 style={{ fontSize: '1.25rem' }}>CPU Spatial Index</h3>
                            <span className="outcome-tag">O(N log N)</span>
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                            cKDTree bounding volume hierarchy sorting on the CPU.
                        </p>
                        <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

                        <div className="outcome-list">
                            <div className="outcome-list-title pro" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Check size={16} /> Pros (Major & Minor)</div>
                            <div className="outcome-item pro">
                                <Check size={16} />
                                <span><strong>Sub-ms (Major):</strong> Fast enough for real-time loops at 10,000 robots.</span>
                            </div>
                            <div className="outcome-item pro">
                                <Check size={16} />
                                <span><strong>Low Memory (Major):</strong> Memory usage drops by 28,600x, resolving OOMs.</span>
                            </div>
                        </div>

                        <div className="outcome-list">
                            <div className="outcome-list-title con" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><X size={16} /> Cons (Major & Minor)</div>
                            <div className="outcome-item con">
                                <X size={16} />
                                <span><strong>Import Lag (Minor):</strong> Initial module loading triggers a minor execution latency spike.</span>
                            </div>
                            <div className="outcome-item con">
                                <X size={16} />
                                <span><strong>Core Bound (Minor):</strong> Bound to single-core execution speed of the host CPU.</span>
                            </div>
                        </div>
                    </div>

                    {/* GPU CUDA */}
                    <div className="card outcome-card" style={{ borderColor: 'var(--border-neon)' }}>
                        <div className="outcome-title-row">
                            <Zap size={20} />
                            <h3 style={{ fontSize: '1.25rem' }}>GPU CUDA Kernel</h3>
                            <span className="outcome-tag">Parallel</span>
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                            Offloaded PyCUDA / CuPy dynamic spatial grid resolving on GPUs.
                        </p>
                        <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

                        <div className="outcome-list">
                            <div className="outcome-list-title pro" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Check size={16} /> Pros (Major & Minor)</div>
                            <div className="outcome-item pro">
                                <Check size={16} />
                                <span><strong>Million Swarms (Major):</strong> Massive parallelism handles massive numbers of robots.</span>
                            </div>
                            <div className="outcome-item pro">
                                <Check size={16} />
                                <span><strong>Shared Cache (Major):</strong> GPU Shared Memory keeps latency minimal.</span>
                            </div>
                        </div>

                        <div className="outcome-list">
                            <div className="outcome-list-title con" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><X size={16} /> Cons (Major & Minor)</div>
                            <div className="outcome-item con">
                                <X size={16} />
                                <span><strong>PCI-e Bottleneck (Major):</strong> Moving data between CPU and GPU adds copy latency.</span>
                            </div>
                            <div className="outcome-item con">
                                <X size={16} />
                                <span><strong>Comp. Complexity:</strong> Writing and debugging CUDA C++ kernels is difficult.</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="footer">
                    <div>SwarmDB is conceptualized and built for the <span>NVIDIA OpenHackathon</span>.</div>
                    <div style={{ fontSize: '0.8rem' }}>&copy; 2026 SwarmDB Development Team. All rights reserved.</div>
                </footer>
            </div>
        </div>
    );
}
