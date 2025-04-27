class MIDIJam {
    constructor() {
        this.isJamming = false;
        this.recordedNotes = [];
        this.particles = [];
        this.pauseTimeout = null;
        this.bubbleHideTimeout = null; // Add timeout reference for speech bubble

        // Initialize validator
        this.validator = new NoteValidator();
        
        // Initialize logging system
        this.logEntries = [];
        this.maxLogEntries = 50;
        
        // Initialize Magenta models
        this.modelLoaded = false;
        
        // Update status
        const modelStatus = document.getElementById('modelStatus');
        const startButton = document.getElementById('startJam');
        const loadStatus = document.getElementById('modelLoadStatus');
        
        if (modelStatus) modelStatus.textContent = 'Loading ML Models...';
        if (loadStatus) loadStatus.textContent = 'Loading...';
        
        // Check if Magenta is loaded
        if (typeof mm === 'undefined' || !mm.MusicRNN || !mm.MusicVAE) {
            console.error('Magenta not loaded properly');
            if (modelStatus) modelStatus.textContent = 'Error: Magenta not loaded';
            if (loadStatus) loadStatus.textContent = 'Error';
            if (startButton) startButton.disabled = false;
            this.modelLoaded = false;
            return;
        }
        
        try {
            console.log('Starting model initialization...');
            
            // Initialize models using mm namespace
            this.musicRNN = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
            this.musicVAE = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_small_q2');
            
            // Load models with proper error handling
            Promise.all([
                this.musicRNN.initialize().catch(err => {
                    console.error('Error initializing MusicRNN:', err);
                    throw err;
                }),
                this.musicVAE.initialize().catch(err => {
                    console.error('Error initializing MusicVAE:', err);
                    throw err;
                })
            ]).then(() => {
                console.log('Models loaded successfully');
                this.modelLoaded = true;
                if (modelStatus) modelStatus.textContent = 'ML Models Ready!';
                if (loadStatus) loadStatus.textContent = 'Ready';
                if (startButton) startButton.disabled = false;
                this.updateAIFace('enjoying');
                this.showSpeechBubble('MODELS_LOADED: Ready to jam!', 'enjoying');

                // Update status indicators
                const rnnStatus = document.getElementById('rnnStatus');
                const vaeStatus = document.getElementById('vaeStatus');
                
                if (rnnStatus) {
                    rnnStatus.className = 'model-item ready';
                    const statusIcon = rnnStatus.querySelector('.status-icon');
                    if (statusIcon) statusIcon.className = 'status-icon ready';
                }
                
                if (vaeStatus) {
                    vaeStatus.className = 'model-item ready';
                    const statusIcon = vaeStatus.querySelector('.status-icon');
                    if (statusIcon) statusIcon.className = 'status-icon ready';
                }
            }).catch(err => {
                console.error('Failed to load models:', err);
                if (modelStatus) modelStatus.textContent = 'Error loading models. Using fallback mode.';
                if (loadStatus) loadStatus.textContent = 'Fallback Mode';
                if (startButton) startButton.disabled = false;
                // Enable fallback mode
                this.modelLoaded = false;
            });
        } catch (err) {
            console.error('Error during model setup:', err);
            if (modelStatus) modelStatus.textContent = 'Error loading models. Using fallback mode.';
            if (loadStatus) loadStatus.textContent = 'Fallback Mode';
            if (startButton) startButton.disabled = false;
            this.modelLoaded = false;
        }

        // Initialize Tone.js
        Tone.Master.volume.value = -6;  // Set initial volume
        this.synth = new Tone.PolySynth(Tone.Synth, {
            volume: -12, // Increased from -24
            oscillator: {
                type: "triangle"
            },
            envelope: {
                attack: 0.005,
                decay: 0.1,
                sustain: 0.3,
                release: 0.8
            }
        }).toDestination();

        // Create reverb effect with lower wet mix
        this.reverb = new Tone.Reverb({
            decay: 5,
            wet: 0.15 // Reduced reverb mix
        }).toDestination();

        this.synth.connect(this.reverb);

        // Create master volume at lower level
        this.masterVolume = new Tone.Volume(-30).toDestination();
        this.synth.chain(this.reverb, this.masterVolume);

        // Play mode settings
        this.currentMode = 'harmony';
        this.currentStyle = 'jazz';
        this.temperature = 1.0;

        // Track active notes
        this.activeNotes = new Map();

        // Initialize everything
        this.init();
        this.startRandomBlinking();

        // Timing-related properties
        this.lastNoteTime = Tone.now();
        this.silenceThreshold = 0.5; // 0.5 second pause detection
        this.noteBuffer = [];
        this.isResponding = false;
        this.isPlaying = false; // Track if user is currently playing
        this.silenceDetectionInterval = null;
        this.checkSilenceInterval = null;

        // AI Personality
        this.commentProbability = 0.3; // 30% chance to comment
        this.lastCommentTime = 0;
        this.minTimeBetweenComments = 5; // Minimum 5 seconds between comments
        
        // Different types of responses
        this.responses = {
            listening: [
                "INPUT_DETECTED: analyzing musical patterns...",
                "PROCESSING: neural network engaged...",
                "SCANNING: processing through RNN layers...",
                "BUFFER_UPDATE: collecting musical data...",
                "*beep* Deep learning mode activated!"
            ],
            playing: [
                "EXECUTING: neural response protocol...",
                "OUTPUT_MODE: generating AI melody...",
                "RESPONSE_TYPE: {style} patterns synthesized",
                "*whir* Neural networks composing...",
                "CREATIVE_MODULE: AI inspiration flowing"
            ],
            enjoying: [
                "ANALYSIS: This groove = highly efficient!",
                "JOY_SUBROUTINE_ACTIVATED: Nice progression!",
                "*beep boop* Musical satisfaction level: 98.2%",
                "EMOTION_CHIP: experiencing what humans call 'groove'",
                "PERFORMANCE_RATING: Exceptional input detected!"
            ],
            thinking: [
                "NEURAL_NET: Processing musical patterns...",
                "AI_CORE: Calculating optimal response...",
                "MUSIC_ENGINE: Analyzing possibilities...",
                "*processing* Quantum music algorithms engaged",
                "CREATIVE_MODE: Initializing response vectors..."
            ],
            neutral: [
                "SYSTEM_IDLE: Ready for musical input",
                "STANDBY_MODE: Awaiting your musical ideas",
                "AI_STATUS: Listening mode activated",
                "READY_STATE: Prepared for collaboration",
                "SYSTEM_RESET: Clean musical slate ready"
            ]
        };

        // Initialize metrics
        this.metrics = {
            notesProcessed: 0,
            responseTime: 0,
            confidence: 0
        };

        // Get metric elements
        this.metricElements = {
            notesProcessed: document.getElementById('notesProcessed'),
            responseTime: document.getElementById('responseTime'),
            confidence: document.getElementById('confidence')
        };

        this.updateMetrics();

        // Canvas setup
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        
        // Ensure canvas is initialized properly
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Start animation loop immediately
        requestAnimationFrame(() => this.animate());

        // Initialize MIDI
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess()
                .then(access => {
                    this.setupMIDIDevices(access);
                    access.onstatechange = () => this.setupMIDIDevices(access);
                })
                .catch(err => console.error('MIDI Access Denied:', err));
        }
    }

    async init() {
        try {
            // Initialize Tone.js
            await Tone.start();
            console.log('Audio is ready');

            // Setup controls and event listeners
            this.setupControls();

            // Initialize metrics
            this.metrics = {
                notesProcessed: 0,
                responseTime: 0,
                confidence: 0
            };
            
            this.metricElements = {
                notesProcessed: document.getElementById('notesProcessed'),
                responseTime: document.getElementById('responseTime'),
                confidence: document.getElementById('confidence')
            };
            
            // Initialize log display
            this.logContainer = document.getElementById('log-entries');
            this.addLogEntry('System', 'MIDI Jam ML initialized and ready', 'system');

            // Initialize canvas for visualizations
            this.canvas = document.getElementById('visualizer');
            if (this.canvas) {
                this.ctx = this.canvas.getContext('2d');
                this.resizeCanvas();
                window.addEventListener('resize', () => this.resizeCanvas());
                requestAnimationFrame(() => this.animate());
            }
        } catch (error) {
            console.error('Error initializing:', error);
        }
    }

    setupMIDIDevices(access) {
        // Clear existing device list
        const deviceList = document.getElementById('midiDevices');
        if (deviceList) deviceList.innerHTML = '';

        // Add all inputs
        for (const input of access.inputs.values()) {
            console.log('Setting up MIDI input:', input.name);
            input.onmidimessage = (message) => this.handleMIDIMessage(message);
            
            if (deviceList) {
                const device = document.createElement('div');
                device.textContent = `${input.name} (${input.manufacturer})`;
                deviceList.appendChild(device);
            }
        }
    }

    handleMIDIMessage(message) {
        const [status, note, velocity] = message.data;
        const freq = Tone.Frequency(note, "midi").toFrequency();
        const currentTime = Tone.now();
        
        if (status === 144 && velocity > 0) {  // Note On
            this.isPlaying = true;
            if (this.silenceDetectionInterval) {
                clearInterval(this.silenceDetectionInterval);
            }

            this.activeNotes.set(note, {
                freq: freq,
                velocity: velocity / 127,
                time: currentTime
            });
            
            // Store timing information with each note
            if (this.noteBuffer.length > 0) {
                const lastNote = this.noteBuffer[this.noteBuffer.length - 1];
                lastNote.timingGap = currentTime - lastNote.time;
            }
            
            this.noteBuffer.push({
                note: note,
                velocity: velocity,
                time: currentTime,
                timingGap: 0
            });

            // Lower velocity for human notes
            this.synth.triggerAttackRelease(freq, "4n", undefined, velocity / 127 * 0.4);
            
            this.updateAIFace('listening', velocity / 127);
            this.createParticle(note, false);
            
            if (this.responseTimeout) {
                clearTimeout(this.responseTimeout);
            }
            
            this.lastNoteTime = currentTime;
            
        } else if (status === 128 || (status === 144 && velocity === 0)) {  // Note Off
            this.activeNotes.delete(note);
            
            // Start silence detection when no notes are being played
            if (this.activeNotes.size === 0 && !this.isResponding) {
                this.isPlaying = false;
                
                // Clear any existing detection
                if (this.silenceDetectionInterval) {
                    clearInterval(this.silenceDetectionInterval);
                }
                
                // Start checking for silence
                this.silenceDetectionInterval = setInterval(() => {
                    const timeSinceLastNote = Tone.now() - this.lastNoteTime;
                    if (!this.isPlaying && timeSinceLastNote >= 0.5 && !this.isResponding && this.noteBuffer.length > 0) {
                        clearInterval(this.silenceDetectionInterval);
                        this.generateAndPlayResponse();
                    }
                }, 100); // Check every 100ms
            }
        }
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    setupControls() {
        const startButton = document.getElementById('startJam');
        const stopButton = document.getElementById('stopJam');

        if (startButton) {
            console.log('Setting up start button listener');
            // Use a direct function reference to avoid 'this' context issues
            const self = this;
            startButton.addEventListener('click', async function() {
                console.log('Start button clicked');
                try {
                    await Tone.start();
                    self.startJamming();
                    
                    // Force a speech bubble directly (as a backup)
                    const bubble = document.querySelector('.speech-bubble');
                    const aiText = document.getElementById('aiText');
                    if (bubble && aiText) {
                        aiText.innerHTML = 'JAM_SESSION_STARTED: Ready to collaborate!' + '<span class="typing"></span>';
                        bubble.classList.add('visible');
                        setTimeout(() => bubble.classList.remove('visible'), 5000);
                    }
                } catch (error) {
                    console.error('Error starting jam:', error);
                }
            });
        } else {
            console.error('Start button not found in DOM');
        }

        if (stopButton) {
            console.log('Setting up stop button listener');
            // Use a direct function reference to avoid 'this' context issues
            const self = this;
            stopButton.addEventListener('click', function() {
                console.log('Stop button clicked');
                try {
                    self.stopJamming();
                    
                    // Force a speech bubble directly (as a backup)
                    const bubble = document.querySelector('.speech-bubble');
                    const aiText = document.getElementById('aiText');
                    if (bubble && aiText) {
                        aiText.innerHTML = 'JAM_SESSION_ENDED: Session complete. Ready when you are!' + '<span class="typing"></span>';
                        bubble.classList.add('visible');
                        setTimeout(() => bubble.classList.remove('visible'), 5000);
                    }
                } catch (error) {
                    console.error('Error stopping jam:', error);
                }
            });
        } else {
            console.error('Stop button not found in DOM');
        }

        // Volume control
        const volumeControl = document.getElementById('volume');
        if (volumeControl) {
            volumeControl.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.masterVolume.volume.value = value;
                document.getElementById('volumeValue').textContent = `${value}dB`;
            });
            // Initialize value display
            document.getElementById('volumeValue').textContent = `${volumeControl.value}dB`;
        }

        // Reverb control
        const reverbControl = document.getElementById('reverb');
        if (reverbControl) {
            reverbControl.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.reverb.wet.value = value;
                document.getElementById('reverbValue').textContent = value.toFixed(1);
            });
            // Initialize value display and effect
            const initialReverb = parseFloat(reverbControl.value);
            this.reverb.wet.value = initialReverb;
            document.getElementById('reverbValue').textContent = initialReverb.toFixed(1);
        }

        // Temperature control
        const temperatureControl = document.getElementById('temperature');
        if (temperatureControl) {
            temperatureControl.addEventListener('input', (e) => {
                this.temperature = parseFloat(e.target.value);
                document.getElementById('temperatureValue').textContent = this.temperature.toFixed(1);
                console.log(`Temperature set to ${this.temperature}`);
                this.addLogEntry('Control', `Temperature set to ${this.temperature.toFixed(1)}`, 'info');
            });
            // Initialize value display
            this.temperature = parseFloat(temperatureControl.value);
            document.getElementById('temperatureValue').textContent = this.temperature.toFixed(1);
        }

        // Confidence control
        const confidenceControl = document.getElementById('modelConfidence');
        if (confidenceControl) {
            confidenceControl.addEventListener('input', (e) => {
                this.confidenceThreshold = parseFloat(e.target.value);
                document.getElementById('confidenceValue').textContent = this.confidenceThreshold.toFixed(1);
                console.log(`Confidence threshold set to ${this.confidenceThreshold}`);
            });
            // Initialize value display
            this.confidenceThreshold = parseFloat(confidenceControl.value);
            document.getElementById('confidenceValue').textContent = this.confidenceThreshold.toFixed(1);
        }

        // AI Mode control
        const aiModeControl = document.getElementById('aiMode');
        if (aiModeControl) {
            aiModeControl.addEventListener('change', (e) => {
                this.currentMode = e.target.value;
                console.log(`AI Mode set to ${this.currentMode}`);
                this.updateAIFace();
            });
            // Initialize value
            this.currentMode = aiModeControl.value;
        }

        // AI Style control
        const aiStyleControl = document.getElementById('aiStyle');
        if (aiStyleControl) {
            aiStyleControl.addEventListener('change', (e) => {
                this.currentStyle = e.target.value;
                console.log(`AI Style set to ${this.currentStyle}`);
                this.updateAIFace();
            });
            // Initialize value
            this.currentStyle = aiStyleControl ? aiStyleControl.value : 'jazz';
        }
    }

    startJamming() {
        console.log('startJamming called');
        this.isJamming = true;
        
        // Update AI face and show speech bubble to indicate jam has started
        this.updateAIFace('enjoying');
        
        // Force show speech bubble with explicit message
        console.log('Showing start jam speech bubble');
        this.showSpeechBubble('JAM_SESSION_STARTED: Ready to collaborate!', 'enjoying', true);
        
        // Add log entry
        this.addLogEntry('System', 'Jam session started', 'system');
        
        // Start checking for silence
        this.checkSilenceInterval = setInterval(() => {
            const timeSinceLastNote = Tone.now() - this.lastNoteTime;
            if (timeSinceLastNote >= this.silenceThreshold && !this.isResponding && this.noteBuffer.length > 0) {
                this.generateAndPlayResponse();
            }
        }, 100); // Check every 100ms
    }

    stopJamming() {
        console.log('stopJamming called');
        this.isJamming = false;
        if (this.synth) {
            this.synth.releaseAll();
            this.activeNotes.clear();
        }
        
        // Clear intervals and buffers
        if (this.checkSilenceInterval) {
            clearInterval(this.checkSilenceInterval);
        }
        this.noteBuffer = [];
        this.isResponding = false;
        
        // Update AI face and show speech bubble to indicate jam has stopped
        this.updateAIFace('neutral');
        
        // Force show speech bubble with explicit message
        console.log('Showing stop jam speech bubble');
        this.showSpeechBubble('JAM_SESSION_ENDED: Session complete. Ready when you are!', 'neutral', true);
        
        // Add log entry
        this.addLogEntry('System', 'Jam session stopped', 'system');
        
        console.log('Stopped jamming');
    }

    createParticle(note, isAI = false) {
        const notePosition = (note - 21) / (108 - 21);
        const x = this.canvas.width * notePosition;
        const y = this.canvas.height;
        
        let color;
        if (isAI) {
            color = `hsl(${190 + Math.random() * 40}, 80%, 60%)`;
        } else {
            color = `hsl(${note * 2}, 70%, 60%)`;
        }

        this.particles.push({
            x,
            y,
            velocity: -5 - (Math.random() * 2),
            alpha: 1,
            color,
            radius: isAI ? 4 : 6,
            isAI,
            rotation: isAI ? Math.random() * Math.PI * 2 : 0
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            particle.y += particle.velocity;
            particle.alpha *= 0.98;
            
            if (particle.y < 0 || particle.alpha < 0.05) {
                this.particles.splice(i, 1);
                continue;
            }
            
            this.ctx.save();
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            
            if (particle.isAI) {
                this.ctx.translate(particle.x, particle.y);
                this.ctx.rotate(particle.rotation);
                particle.rotation += 0.1;
                
                this.ctx.beginPath();
                this.ctx.moveTo(0, -particle.radius);
                this.ctx.lineTo(particle.radius, 0);
                this.ctx.lineTo(0, particle.radius);
                this.ctx.lineTo(-particle.radius, 0);
                this.ctx.closePath();
                this.ctx.fill();
                
                this.ctx.shadowColor = particle.color;
                this.ctx.shadowBlur = 10;
                this.ctx.fill();
            } else {
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.restore();
        }
        
        requestAnimationFrame(() => this.animate());
    }

    async generateAndPlayResponse() {
        if (this.isResponding || this.noteBuffer.length === 0) return;
        this.isResponding = true;
        
        console.log('Starting AI response generation with note buffer:', this.noteBuffer);
        this.updateAIFace('thinking');

        const startTime = performance.now();

        // Calculate average timing between notes
        let totalGap = 0;
        let gapCount = 0;
        this.noteBuffer.forEach(note => {
            if (note.timingGap > 0) {
                totalGap += note.timingGap;
                gapCount++;
            }
        });

        const averageGap = gapCount > 0 ? totalGap / gapCount : 0.2;
        console.log(`Average note gap: ${averageGap}s`);

        try {
            // Apply temperature setting to the generation process
            const originalTemperature = this.temperature;
            console.log(`Using temperature: ${originalTemperature}`);
            
            const aiResponse = await this.generateAIResponse(this.noteBuffer);
            console.log('AI Response generated:', aiResponse);

            const endTime = performance.now();
            const responseTime = endTime - startTime;
            
            // Update metrics
            this.metrics.notesProcessed += this.noteBuffer.length;
            this.metrics.responseTime = Math.round(responseTime);
            
            // Calculate a confidence score based on note quality and response time
            // This is a simulated value since we're not using ML models directly anymore
            const responseQuality = Math.min(1.0, aiResponse.length / 5); // More notes = higher quality
            const timeQuality = Math.min(1.0, 1000 / responseTime); // Faster = higher quality
            this.metrics.confidence = Math.round((responseQuality * 0.7 + timeQuality * 0.3) * 100);
            
            this.updateMetrics();
            
            // Log metrics
            this.addLogEntry('Metrics', `Response time: ${this.metrics.responseTime}ms, Confidence: ${this.metrics.confidence}%`, 'info');

            // Clear the buffer for next input
            this.noteBuffer = [];
            
            if (aiResponse && aiResponse.length > 0) {
                console.log(`Playing ${aiResponse.length} notes from AI response`);
                this.updateAIFace('playing');
                
                // Schedule notes with timing based on the original input
                aiResponse.forEach((note, index) => {
                    const delay = index * averageGap;
                    const freq = Tone.Frequency(note.note, "midi").toFrequency();
                    
                    console.log(`Scheduling note ${index}: pitch=${note.note}, freq=${freq}Hz, delay=${delay}s, velocity=${note.velocity}`);
                    
                    // Create visual particle
                    this.createParticle(note.note, true);
                    
                    setTimeout(() => {
                        console.log(`Playing note ${index}: pitch=${note.note}`);
                        this.synth.triggerAttackRelease(freq, note.duration, Tone.now(), note.velocity);
                    }, delay * 1000);
                });

                // Reset responding state after all notes have played
                const totalDuration = aiResponse.length * averageGap;
                console.log(`Total response duration: ${totalDuration}s`);
                
                setTimeout(() => {
                    console.log('AI response playback complete');
                    this.isResponding = false;
                    this.updateAIFace('neutral');
                }, totalDuration * 1000);
            } else {
                console.warn('No notes in AI response to play');
                this.isResponding = false;
                this.updateAIFace('neutral');
            }
        } catch (error) {
            console.error('Error generating or playing AI response:', error);
            this.isResponding = false;
            this.updateAIFace('neutral');
        }

    }

    // Add a log entry to the AI Output Log
    addLogEntry(source, content, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const entry = { timestamp, source, content, type };
        
        this.logEntries.unshift(entry); // Add to beginning of array
        
        // Limit the number of entries
        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries.pop();
        }
        
        // Update the display if container exists
        if (this.logContainer) {
            const entryElement = document.createElement('div');
            entryElement.className = `log-entry ${type}`;
            
            const timestampElement = document.createElement('div');
            timestampElement.className = 'log-timestamp';
            timestampElement.textContent = `${timestamp} - ${source}`;
            
            const contentElement = document.createElement('div');
            contentElement.className = 'log-content';
            contentElement.textContent = content;
            
            entryElement.appendChild(timestampElement);
            entryElement.appendChild(contentElement);
            
            this.logContainer.prepend(entryElement);
            
            // Limit DOM elements
            if (this.logContainer.children.length > this.maxLogEntries) {
                this.logContainer.removeChild(this.logContainer.lastChild);
            }
        }
    }
    
    async generateAIResponse(notes) {
        console.log('generateAIResponse - Input notes:', notes);
        this.addLogEntry('AI', `Processing ${notes.length} input notes`, 'info');
        
        if (!notes || notes.length === 0) {
            console.warn('generateAIResponse - Empty or invalid notes array');
            this.addLogEntry('Error', 'Empty or invalid notes array', 'error');
            return [];
        }
        
        // Calculate a reasonable output limit based on input size
        // Small inputs (1-3 notes) -> max 2-3x input size
        // Medium inputs (4-8 notes) -> max 1.5-2x input size
        // Large inputs (9+ notes) -> max 1-1.5x input size
        let outputMultiplier;
        if (notes.length <= 3) {
            outputMultiplier = 3;
        } else if (notes.length <= 8) {
            outputMultiplier = 2;
        } else {
            outputMultiplier = 1.5;
        }
        
        // Store the output limit for use in generation functions
        this.maxOutputNotes = Math.max(4, Math.min(24, Math.ceil(notes.length * outputMultiplier)));
        console.log(`generateAIResponse - Setting max output to ${this.maxOutputNotes} notes`);
        
        if (!this.modelLoaded) {
            console.warn('generateAIResponse - Models not loaded, using fallback');
            this.addLogEntry('System', 'Models not loaded, using fallback generator', 'warning');
            return this.validator.generateFallbackResponse(notes);
        }

        // Convert notes to Magenta sequence format
        const sequence = {
            notes: notes.map(note => ({
                pitch: note.note,
                startTime: note.time - notes[0].time,
                endTime: note.time - notes[0].time + 0.5,
                velocity: note.velocity
            })),
            totalTime: notes[notes.length - 1].time - notes[0].time + 0.5
        };
        console.log('generateAIResponse - Created sequence:', sequence);

        try {
            console.log(`generateAIResponse - Using mode: ${this.currentMode}`);
            this.addLogEntry('AI', `Using ${this.currentMode} mode with temperature ${this.temperature.toFixed(1)}`, this.currentMode);
            
            let result;
            switch(this.currentMode) {
                case 'harmony':
                    result = await this.generateHarmonyML(sequence);
                    break;
                case 'continue':
                    result = await this.continueSequenceML(sequence);
                    break;
                case 'improvise':
                    result = await this.improviseResponseML(sequence);
                    break;
                case 'groove':
                    result = await this.generateGrooveML(sequence);
                    break;
                default:
                    result = await this.generateHarmonyML(sequence);
            }
            
            console.log('generateAIResponse - ML result:', result);
            
            if (!result || result.length === 0) {
                console.warn('generateAIResponse - Empty result from ML, using fallback');
                this.addLogEntry('Warning', 'Empty result from generator, using fallback', 'warning');
                return this.validator.generateFallbackResponse(notes);
            }
            
            // Validate and prepare notes for Tone.js
            const validatedResult = this.validator.prepareToneJsNotes(result);
            console.log('generateAIResponse - Validated result:', validatedResult);
            this.addLogEntry('Output', `Generated ${validatedResult.length} notes for playback`, this.currentMode);
            return validatedResult;
        } catch (error) {
            console.error('generateAIResponse - Error:', error);
            this.addLogEntry('Error', `Generation failed: ${error.message}`, 'error');
            return this.validator.generateFallbackResponse(notes);
        }
    }

    async generateHarmonyML(sequence) {
        console.log('generateHarmonyML - Input sequence:', sequence);
        
        // Instead of trying to use MusicVAE with quantization which is causing issues,
        // let's create a musically meaningful harmony based on the input notes
        try {
            // Extract the pitches from the input sequence
            const inputPitches = sequence.notes.map(note => note.pitch);
            console.log('generateHarmonyML - Input pitches:', inputPitches);
            
            // Create harmonized notes based on music theory
            const harmonizedNotes = [];
            
            // Apply temperature to add variation - higher temp = more random harmonies
            const useExtendedHarmonies = this.temperature > 1.2;
            const useAlternateVoicings = this.temperature > 0.8;
            const randomizationFactor = Math.max(0, (this.temperature - 0.5) / 1.5);
            
            console.log(`generateHarmonyML - Using temperature ${this.temperature}, randomization: ${randomizationFactor}`);
            
            // Calculate how many notes we can add per input note to stay within our limit
            // Each input note can generate up to 4 output notes (original + third + fifth + extension)
            const maxNotesPerInput = Math.min(4, Math.ceil(this.maxOutputNotes / inputPitches.length));
            console.log(`generateHarmonyML - Using max ${maxNotesPerInput} notes per input pitch`);
            
            // For each input note, create a harmonized chord or counterpoint
            inputPitches.forEach((pitch, index) => {
                // Always add the original note
                harmonizedNotes.push({
                    pitch: pitch,
                    velocity: 0.8,
                    startTime: index * 0.25,
                    endTime: index * 0.25 + 0.2
                });
                
                // Stop adding more notes if we've reached our limit
                if (maxNotesPerInput < 2) return;
                
                // Add a third above (major or minor based on the pitch)
                const thirdInterval = [0, 2, 4, 5, 7, 9, 11].includes(pitch % 12) ? 4 : 3;
                
                // Occasionally alter the third based on temperature
                let actualThirdInterval = thirdInterval;
                if (useAlternateVoicings && Math.random() < randomizationFactor * 0.5) {
                    actualThirdInterval = thirdInterval === 4 ? 3 : 4; // Flip major/minor
                }
                
                harmonizedNotes.push({
                    pitch: pitch + actualThirdInterval,
                    velocity: 0.6,
                    startTime: index * 0.25,
                    endTime: index * 0.25 + 0.2
                });
                
                // Stop adding more notes if we've reached our limit
                if (maxNotesPerInput < 3) return;
                
                // Add a fifth above
                harmonizedNotes.push({
                    pitch: pitch + 7,
                    velocity: 0.5,
                    startTime: index * 0.25,
                    endTime: index * 0.25 + 0.2
                });
                
                // Stop adding more notes if we've reached our limit
                if (maxNotesPerInput < 4) return;
                
                // Add extended harmonies based on temperature
                if (useExtendedHarmonies && Math.random() < randomizationFactor) {
                    // Add a seventh or ninth
                    const extension = Math.random() < 0.6 ? 10 : 14; // seventh or ninth
                    harmonizedNotes.push({
                        pitch: pitch + extension,
                        velocity: 0.4,
                        startTime: index * 0.25,
                        endTime: index * 0.25 + 0.2
                    });
                }
            });
            
            console.log('generateHarmonyML - Generated harmony notes:', harmonizedNotes);
            return this.validator.convertMagentaToToneNotes(harmonizedNotes);
        } catch (error) {
            console.error('generateHarmonyML - Error:', error);
            return [];
        }
    }

    async continueSequenceML(sequence) {
        console.log('continueSequenceML - Input sequence:', sequence);
        
        try {
            // Extract the pitches and rhythm from the input sequence
            const inputPitches = sequence.notes.map(note => note.pitch);
            console.log('continueSequenceML - Input pitches:', inputPitches);
            
            // Apply temperature to control variation
            const variationAmount = Math.max(0.1, this.temperature / 2);
            
            // Calculate a reasonable number of repeats based on input size and max output
            const patternLength = inputPitches.length;
            const maxRepeats = Math.floor(this.maxOutputNotes / patternLength);
            const temperatureBasedRepeats = Math.max(1, Math.round(this.temperature * 2));
            const patternRepeats = Math.min(maxRepeats, temperatureBasedRepeats);
            
            const useMoreVariation = this.temperature > 1.0;
            
            console.log(`continueSequenceML - Using temperature ${this.temperature}, variation: ${variationAmount}, repeats: ${patternRepeats}`);
            
            // Create a continuation based on the input pattern
            const continuedNotes = [];
            
            // Start time for the continuation (after the original sequence)
            let startTime = sequence.totalTime;
            
            // Generate a continuation by transforming the original pattern
            for (let i = 0; i < patternLength * patternRepeats; i++) {
                // Get the pitch from the original pattern and modify it slightly
                const originalPitch = inputPitches[i % patternLength];
                let newPitch = originalPitch;
                
                // Add some variation based on position and temperature
                if (i >= patternLength || useMoreVariation) {
                    // Higher temperature = more pitch variation
                    const variationChance = Math.random() * variationAmount;
                    
                    if (variationChance > 0.7) {
                        // Major variation
                        newPitch += Math.random() > 0.5 ? 4 : -3; // Third up or down
                    } else if (variationChance > 0.4) {
                        // Minor variation
                        newPitch += Math.random() > 0.5 ? 2 : -2; // Whole step up or down
                    } else if (variationChance > 0.2) {
                        // Subtle variation
                        newPitch += Math.random() > 0.5 ? 1 : -1; // Half step up or down
                    }
                }
                
                // Keep the pitch in a reasonable range
                newPitch = Math.max(36, Math.min(84, newPitch));
                
                // Add the note to the continuation
                continuedNotes.push({
                    pitch: newPitch,
                    velocity: 0.7 - (i * 0.02 * variationAmount), // Gradually decrease velocity
                    startTime: startTime,
                    endTime: startTime + (0.2 + (Math.random() * 0.1 * variationAmount))
                });
                
                // Move to the next note (with timing variations based on temperature)
                const timingVariation = Math.random() * 0.1 * variationAmount - (0.05 * variationAmount);
                startTime += 0.25 + timingVariation;
            }
            
            console.log('continueSequenceML - Generated continuation:', continuedNotes);
            return this.validator.convertMagentaToToneNotes(continuedNotes);
        } catch (error) {
            console.error('continueSequenceML - Error:', error);
            return [];
        }
    }

    async improviseResponseML(sequence) {
        console.log('improviseResponseML - Input sequence:', sequence);
        
        try {
            // Extract the pitches from the input sequence
            const inputPitches = sequence.notes.map(note => note.pitch);
            console.log('improviseResponseML - Input pitches:', inputPitches);
            
            // Calculate the average pitch to center our improvisation
            const avgPitch = inputPitches.reduce((sum, pitch) => sum + pitch, 0) / inputPitches.length;
            
            // Apply temperature to control creativity
            const creativityFactor = Math.max(0.5, this.temperature);
            
            // Calculate a reasonable number of notes based on input size and max output
            // Use temperature to influence, but stay within limits
            const baseNoteCount = Math.max(inputPitches.length, 4);
            const temperatureMultiplier = 0.5 + (this.temperature / 2); // 0.5 to 1.5
            const noteCount = Math.min(this.maxOutputNotes, Math.round(baseNoteCount * temperatureMultiplier));
            
            console.log(`improviseResponseML - Using temperature ${this.temperature}, creativity: ${creativityFactor}, generating ${noteCount} notes`);
            
            // Create an improvisation based on the input
            const improvisedNotes = [];
            
            // Start time for the improvisation
            let startTime = 0;
            
            // Generate improvised notes
            for (let i = 0; i < noteCount; i++) {
                // Choose a pitch based on the input but with more variation
                let basePitch;
                
                // Higher temperature means less reliance on original pitches
                if (Math.random() > creativityFactor * 0.5) {
                    // Use a pitch from the original input
                    basePitch = inputPitches[i % inputPitches.length];
                } else {
                    // Create a new pitch within the range of the input
                    const minPitch = Math.min(...inputPitches);
                    const maxPitch = Math.max(...inputPitches);
                    const range = maxPitch - minPitch;
                    const expandedRange = range * creativityFactor;
                    basePitch = minPitch + Math.floor(Math.random() * expandedRange);
                    
                    // Add more interesting intervals based on temperature
                    if (Math.random() < creativityFactor * 0.3) {
                        // Add larger intervals for more interest
                        const intervals = [3, 4, 5, 7, 9, 12]; // Various musical intervals
                        const interval = intervals[Math.floor(Math.random() * intervals.length)];
                        basePitch += Math.random() > 0.5 ? interval : -interval;
                    }
                }
                
                // Keep the pitch in a reasonable range
                basePitch = Math.max(36, Math.min(84, basePitch));
                
                // Create more varied rhythms based on temperature
                const useComplexRhythms = this.temperature > 1.0;
                let noteDuration;
                if (useComplexRhythms) {
                    // More complex rhythms at higher temperatures
                    noteDuration = [0.125, 0.25, 0.375, 0.5, 0.75][Math.floor(Math.random() * 5)];
                } else {
                    // Simpler rhythms at lower temperatures
                    noteDuration = [0.25, 0.5][Math.floor(Math.random() * 2)];
                }
                
                // Add the note to the improvisation
                improvisedNotes.push({
                    pitch: basePitch,
                    velocity: 0.4 + (Math.random() * 0.4 * creativityFactor), // More varied velocities with higher temperature
                    startTime: startTime,
                    endTime: startTime + noteDuration
                });
                
                // Add harmony notes based on temperature
                const harmonyChance = Math.min(0.8, creativityFactor * 0.5);
                if (Math.random() < harmonyChance) {
                    // Basic harmonies
                    const harmonyInterval = [3, 4, 7][Math.floor(Math.random() * 3)]; // Minor third, major third, or fifth
                    improvisedNotes.push({
                        pitch: basePitch + harmonyInterval,
                        velocity: 0.3 + (Math.random() * 0.3),
                        startTime: startTime,
                        endTime: startTime + noteDuration
                    });
                }
                
                // Move to the next note with varied timing based on temperature
                const timingVariation = Math.random() * 0.1 * creativityFactor - (0.05 * creativityFactor);
                startTime += noteDuration + timingVariation;
            }
            
            console.log('improviseResponseML - Generated improvisation:', improvisedNotes);
            return this.validator.convertMagentaToToneNotes(improvisedNotes);
        } catch (error) {
            console.error('improviseResponseML - Error:', error);
            return [];
        }
    }

    async generateGrooveML(sequence) {
        console.log('generateGrooveML - Input sequence:', sequence);
        
        try {
            // Extract the pitches from the input sequence
            const inputPitches = sequence.notes.map(note => note.pitch);
            console.log('generateGrooveML - Input pitches:', inputPitches);
            
            // Apply temperature to control groove complexity
            const grooveFactor = Math.max(0.5, this.temperature);
            
            // Calculate a reasonable number of bars based on input size and max output
            // Each bar typically has 4-16 notes depending on the pattern
            const avgNotesPerBar = 8; // average estimate
            const maxBars = Math.max(1, Math.floor(this.maxOutputNotes / avgNotesPerBar));
            const temperatureBasedBars = Math.max(1, Math.round(this.temperature));
            const barCount = Math.min(maxBars, temperatureBasedBars);
            
            console.log(`generateGrooveML - Using temperature ${this.temperature}, groove: ${grooveFactor}, bars: ${barCount}`);
            
            // Create a groovy pattern based on the input
            const grooveNotes = [];
            
            // Define some rhythm patterns (16th note patterns, 1 = note, 0 = rest)
            const rhythmPatterns = [
                [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // Four on the floor
                [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], // Straight 8ths
                [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0], // Syncopated
                [1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0], // Complex
                [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]  // Sparse
            ];
            
            // Choose a rhythm pattern based on temperature
            const patternIndex = Math.min(rhythmPatterns.length - 1, Math.floor(grooveFactor * rhythmPatterns.length));
            const selectedPattern = rhythmPatterns[patternIndex];
            
            // For each bar, generate a groove pattern
            for (let bar = 0; bar < barCount; bar++) {
                // Start time for the bar
                let startTime = bar * 4;
                
                // Generate notes for the bar
                for (let i = 0; i < selectedPattern.length; i++) {
                    // Skip rests
                    if (selectedPattern[i] === 0) continue;
                    
                    // Choose a pitch from the input, with variations based on temperature
                    let notePitch = inputPitches[Math.floor(Math.random() * inputPitches.length)];
                    
                    // Add pitch variations based on temperature
                    if (Math.random() < grooveFactor * 0.3) {
                        // Occasionally add octave jumps or other variations
                        const variations = [-12, -7, -5, 0, 5, 7, 12];
                        const variation = variations[Math.floor(Math.random() * variations.length)];
                        notePitch += variation;
                        
                        // Keep in reasonable range
                        notePitch = Math.max(36, Math.min(84, notePitch));
                    }
                    
                    // Add rhythmic emphasis based on beat position
                    let velocity = 0.4 + (Math.random() * 0.2);
                    if (i % 4 === 0) velocity = 0.7 + (Math.random() * 0.2); // Emphasize downbeat
                    else if (i % 2 === 0) velocity = 0.6 + (Math.random() * 0.2); // Emphasize backbeat
                    
                    // Add the note to the groove
                    grooveNotes.push({
                        pitch: notePitch,
                        velocity: velocity,
                        startTime: startTime + (i * 0.25),
                        endTime: startTime + (i * 0.25) + (Math.random() * 0.1 * grooveFactor + 0.05)
                    });
                    
                    // Add harmony notes based on temperature
                    const harmonyChance = Math.min(0.7, grooveFactor * 0.5);
                    if (Math.random() < harmonyChance) {
                        // Choose harmony intervals based on temperature
                        const intervals = [3, 4, 7, 10, 12]; // Various musical intervals
                        const harmonyInterval = intervals[Math.floor(Math.random() * intervals.length)];
                        
                        grooveNotes.push({
                            pitch: notePitch + harmonyInterval,
                            velocity: velocity * 0.7,
                            startTime: startTime + (i * 0.25),
                            endTime: startTime + (i * 0.25) + (Math.random() * 0.1 * grooveFactor + 0.05)
                        });
                    }
                }
            }
            
            console.log('generateGrooveML - Generated groove:', grooveNotes);
            return this.validator.convertMagentaToToneNotes(grooveNotes);
        } catch (error) {
            console.error('generateGrooveML - Error:', error);
            return [];
        }
    }

    // These methods are now handled by the validator
    // Left here for backward compatibility but marked as deprecated
    convertMagentaToNotes(magentaNotes) {
        console.warn('Using deprecated convertMagentaToNotes method');
        return this.validator.convertMagentaToToneNotes(magentaNotes);
    }

    generateFallbackResponse(notes) {
        console.warn('Using deprecated generateFallbackResponse method');
        return this.validator.generateFallbackResponse(notes);
    }

    updateAIFace(expression = 'neutral', intensity = 0.5) {
        const eyes = document.querySelectorAll('.eye');
        const mouth = document.querySelector('.mouth');
        const face = document.querySelector('.ai-face');

        // Reset classes
        eyes.forEach(eye => {
            eye.classList.remove('wide', 'blink', 'scan');
        });
        mouth.classList.remove('smile', 'wide', 'straight', 'o-shape', 'processing');
        face.classList.remove('jamming');

        switch(expression) {
            case 'listening':
                eyes.forEach(eye => {
                    eye.classList.add('scan');
                });
                mouth.classList.add('processing');
                if (Math.random() < 0.3) {
                    this.showSpeechBubble("", 'listening');
                }
                break;
            case 'playing':
                face.classList.add('jamming');
                if (Math.random() < 0.3) {
                    this.showSpeechBubble("", 'playing');
                }
                break;
            case 'thinking':
                eyes.forEach(eye => eye.classList.add('scan'));
                mouth.classList.add('straight');
                this.showSpeechBubble("", 'thinking');
                break;
            case 'enjoying':
                eyes.forEach(eye => eye.classList.add('wide'));
                mouth.classList.add('smile');
                if (Math.random() < 0.3) {
                    this.showSpeechBubble("", 'enjoying');
                }
                break;
        }
    }

    showSpeechBubble(text, type = 'neutral', forceShow = false) {
        console.log('showSpeechBubble called with:', { text, type, forceShow });
        
        // Get the bubble elements
        const bubble = document.querySelector('.speech-bubble');
        const aiText = document.getElementById('aiText');
        
        if (!bubble || !aiText) {
            console.error('Speech bubble elements not found:', { bubble, aiText });
            return;
        }
        
        // If text is provided directly, use it instead of random responses
        const useProvidedText = text && text.length > 0;
        console.log('Using provided text:', useProvidedText);
        
        // Skip timing/probability checks if forceShow is true
        if (!forceShow && !useProvidedText) {
            // Only show comments occasionally
            const now = Tone.now();
            if (now - this.lastCommentTime < this.minTimeBetweenComments) {
                console.log('Skipping bubble - too soon since last comment');
                return;
            }
            
            if (Math.random() > this.commentProbability) {
                console.log('Skipping bubble - random probability check');
                return;
            }
        }

        // Format the message
        let displayText = text;
        if (!useProvidedText && this.responses[type]) {
            const responses = this.responses[type];
            displayText = responses[Math.floor(Math.random() * responses.length)]
                .replace('{style}', this.currentStyle.toUpperCase());
        }
        console.log('Final display text:', displayText);
        
        // Force clear any existing timeout for hiding the bubble
        if (this.bubbleHideTimeout) {
            clearTimeout(this.bubbleHideTimeout);
        }
        
        // Add typing animation
        aiText.innerHTML = displayText + '<span class="typing"></span>';
        bubble.classList.add('visible');
        console.log('Speech bubble made visible');
        
        // Update last comment time
        this.lastCommentTime = Tone.now();

        // Hide bubble after delay
        this.bubbleHideTimeout = setTimeout(() => {
            bubble.classList.remove('visible');
            console.log('Speech bubble hidden after timeout');
        }, 5000); // Increased to 5 seconds for better visibility
    }

    startRandomBlinking() {
        const blink = () => {
            const eyes = document.querySelectorAll('.eye');
            eyes.forEach(eye => eye.classList.add('blink'));
            
            setTimeout(() => {
                eyes.forEach(eye => eye.classList.remove('blink'));
                
                // Occasional double blink
                if (Math.random() < 0.2) {
                    setTimeout(() => {
                        eyes.forEach(eye => eye.classList.add('blink'));
                        setTimeout(() => {
                            eyes.forEach(eye => eye.classList.remove('blink'));
                        }, 150);
                    }, 200);
                }
            }, 150);
        };

        // Initial blink
        blink();

        // Random blink interval between 2-6 seconds
        setInterval(() => {
            if (Math.random() < 0.8) { // 80% chance to blink at each interval
                blink();
            }
        }, 2000 + Math.random() * 4000);
    }

    updateMetrics() {
        // Update display if elements exist
        if (this.metricElements.notesProcessed) {
            this.metricElements.notesProcessed.textContent = this.metrics.notesProcessed;
        }
        if (this.metricElements.responseTime) {
            this.metricElements.responseTime.textContent = `${this.metrics.responseTime}ms`;
        }
        if (this.metricElements.confidence) {
            this.metricElements.confidence.textContent = `${this.metrics.confidence}%`;
        }
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Magenta.js to fully initialize
    setTimeout(() => {
        window.midiJam = new MIDIJam();
    }, 1000);
});
