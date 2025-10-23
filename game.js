// Music Theory Flashcards Game
// Main game logic with MIDI support and VexFlow rendering

class MusicTheoryGame {
    constructor() {
        this.studentName = '';
        this.difficulty = 5;
        this.timeLimit = 180; // 3 minutes in seconds
        this.timeRemaining = this.timeLimit;
        this.score = 0;
        this.totalQuestions = 0;
        this.currentStreak = 0;
        this.bestStreak = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.timerInterval = null;
        this.currentQuestion = null;
        this.midiAccess = null;
        this.midiInputs = [];
        this.waitingForMidi = false;

        // Music theory data
        this.notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        this.accidentals = ['', '#', 'b'];
        this.intervals = [
            { name: 'Unison', semitones: 0 },
            { name: 'Minor 2nd', semitones: 1 },
            { name: 'Major 2nd', semitones: 2 },
            { name: 'Minor 3rd', semitones: 3 },
            { name: 'Major 3rd', semitones: 4 },
            { name: 'Perfect 4th', semitones: 5 },
            { name: 'Tritone', semitones: 6 },
            { name: 'Perfect 5th', semitones: 7 },
            { name: 'Minor 6th', semitones: 8 },
            { name: 'Major 6th', semitones: 9 },
            { name: 'Minor 7th', semitones: 10 },
            { name: 'Major 7th', semitones: 11 },
            { name: 'Octave', semitones: 12 }
        ];

        this.keySignatures = [
            { name: 'C Major / A minor', sharps: 0, flats: 0 },
            { name: 'G Major / E minor', sharps: 1, flats: 0 },
            { name: 'D Major / B minor', sharps: 2, flats: 0 },
            { name: 'A Major / F# minor', sharps: 3, flats: 0 },
            { name: 'E Major / C# minor', sharps: 4, flats: 0 },
            { name: 'B Major / G# minor', sharps: 5, flats: 0 },
            { name: 'F# Major / D# minor', sharps: 6, flats: 0 },
            { name: 'F Major / D minor', sharps: 0, flats: 1 },
            { name: 'Bb Major / G minor', sharps: 0, flats: 2 },
            { name: 'Eb Major / C minor', sharps: 0, flats: 3 },
            { name: 'Ab Major / F minor', sharps: 0, flats: 4 },
            { name: 'Db Major / Bb minor', sharps: 0, flats: 5 },
            { name: 'Gb Major / Eb minor', sharps: 0, flats: 6 }
        ];

        this.chordTypes = [
            { name: 'Major', notes: [0, 4, 7] },
            { name: 'Minor', notes: [0, 3, 7] },
            { name: 'Diminished', notes: [0, 3, 6] },
            { name: 'Augmented', notes: [0, 4, 8] },
            { name: 'Major 7th', notes: [0, 4, 7, 11] },
            { name: 'Minor 7th', notes: [0, 3, 7, 10] },
            { name: 'Dominant 7th', notes: [0, 4, 7, 10] }
        ];

        this.init();
    }

    init() {
        this.initMIDI();
        this.setupEventListeners();
        this.updateDifficultyDisplay();
    }

    setupEventListeners() {
        document.getElementById('difficulty').addEventListener('input', (e) => {
            this.difficulty = parseInt(e.target.value);
            this.updateDifficultyDisplay();
        });

        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.startGame());
        document.getElementById('changeDifficultyBtn').addEventListener('click', () => this.showSetup());
    }

    async initMIDI() {
        if (navigator.requestMIDIAccess) {
            try {
                this.midiAccess = await navigator.requestMIDIAccess();
                this.midiAccess.onstatechange = () => this.updateMIDIStatus();
                this.updateMIDIStatus();
            } catch (error) {
                console.log('MIDI not available:', error);
                this.updateMIDIStatus();
            }
        } else {
            this.updateMIDIStatus();
        }
    }

    updateMIDIStatus() {
        const statusEl = document.getElementById('midiStatus');
        if (this.midiAccess) {
            const inputs = Array.from(this.midiAccess.inputs.values());
            if (inputs.length > 0) {
                statusEl.textContent = `Connected: ${inputs[0].name}`;
                statusEl.classList.add('connected');
                this.midiInputs = inputs;
                this.setupMIDIListeners();
            } else {
                statusEl.textContent = 'Not Connected';
                statusEl.classList.remove('connected');
            }
        } else {
            statusEl.textContent = 'Not Supported';
            statusEl.classList.remove('connected');
        }
    }

    setupMIDIListeners() {
        this.midiInputs.forEach(input => {
            input.onmidimessage = (event) => this.handleMIDIMessage(event);
        });
    }

    handleMIDIMessage(event) {
        const [status, note, velocity] = event.data;
        // Note on message (144-159) with velocity > 0
        if (status >= 144 && status <= 159 && velocity > 0) {
            if (this.waitingForMidi && this.currentQuestion) {
                this.checkMIDIAnswer(note);
            }
        }
    }

    updateDifficultyDisplay() {
        document.getElementById('difficultyValue').textContent = this.difficulty;
        const descriptions = {
            1: 'Beginner - Basic treble clef notes',
            2: 'Beginner - Treble clef with ledger lines',
            3: 'Beginner - Basic bass clef notes',
            4: 'Beginner - Both clefs, simple intervals',
            5: 'Elementary - Extended range, major/minor triads',
            6: 'Elementary - Common key signatures, simple chords',
            7: 'Elementary - All natural notes, major intervals',
            8: 'Elementary - Sharps and flats, minor intervals',
            9: 'Elementary - Major and minor triads',
            10: 'Elementary - Perfect intervals, basic 7th chords',
            11: 'Intermediate - All key signatures, complex intervals',
            12: 'Intermediate - Diminished and augmented triads',
            13: 'Intermediate - All 7th chords',
            14: 'Intermediate - Enharmonic equivalents',
            15: 'Intermediate - Complex rhythms and patterns',
            16: 'Advanced - Extended chords, modal scales',
            17: 'Advanced - Complex jazz harmonies',
            18: 'Advanced - Atonal and chromatic patterns',
            19: 'Advanced - Advanced theory concepts',
            20: 'Advanced - Professional level challenges'
        };
        document.getElementById('difficultyDescription').textContent =
            descriptions[this.difficulty] || 'Custom difficulty';
    }

    startGame() {
        // Capture student name
        const nameInput = document.getElementById('studentName').value.trim();
        this.studentName = nameInput || 'Student';

        this.score = 0;
        this.totalQuestions = 0;
        this.currentStreak = 0;
        this.bestStreak = 0;
        this.timeRemaining = this.timeLimit;
        this.isPlaying = true;
        this.isPaused = false;

        document.getElementById('gameSetup').classList.add('hidden');
        document.getElementById('resultsScreen').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');

        // Display welcome message
        this.showWelcomeMessage();

        this.updateDisplay();
        this.startTimer();
        this.nextQuestion();
    }

    showWelcomeMessage() {
        const welcomeEl = document.getElementById('welcomeMessage');
        const greetings = [
            `Welcome, ${this.studentName}! Let's warm up!`,
            `Good luck, ${this.studentName}!`,
            `Ready to practice, ${this.studentName}?`,
            `Let's do this, ${this.studentName}!`,
            `Time to shine, ${this.studentName}!`
        ];
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
        welcomeEl.textContent = randomGreeting;
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                this.timeRemaining--;
                this.updateTimerDisplay();

                if (this.timeRemaining <= 0) {
                    this.endGame();
                }
            }
        }, 1000);
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('pauseBtn').textContent = this.isPaused ? 'Resume' : 'Pause';
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        document.getElementById('timer').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    updateDisplay() {
        document.getElementById('score').textContent =
            `${this.score} / ${this.totalQuestions}`;
        document.getElementById('streak').textContent = this.currentStreak;
        this.updateTimerDisplay();
    }

    nextQuestion() {
        this.totalQuestions++;
        this.currentQuestion = this.generateQuestion();
        this.displayQuestion();
    }

    generateQuestion() {
        const questionTypes = this.getAvailableQuestionTypes();
        const type = questionTypes[Math.floor(Math.random() * questionTypes.length)];

        switch (type) {
            case 'noteIdentification':
                return this.generateNoteQuestion();
            case 'interval':
                return this.generateIntervalQuestion();
            case 'chord':
                return this.generateChordQuestion();
            case 'keySignature':
                return this.generateKeySignatureQuestion();
            case 'scaleDegree':
                return this.generateScaleDegreeQuestion();
            default:
                return this.generateNoteQuestion();
        }
    }

    getAvailableQuestionTypes() {
        const types = ['noteIdentification'];

        if (this.difficulty >= 4) types.push('interval');
        if (this.difficulty >= 5) types.push('chord');
        if (this.difficulty >= 6) types.push('keySignature');
        if (this.difficulty >= 8) types.push('scaleDegree');

        return types;
    }

    generateNoteQuestion() {
        const clef = this.difficulty < 3 ? 'treble' :
                     this.difficulty === 3 ? 'bass' :
                     Math.random() < 0.5 ? 'treble' : 'bass';

        let octave, noteRange;
        if (clef === 'treble') {
            octave = this.difficulty <= 2 ? 4 : (this.difficulty <= 7 ? [4, 5] : [3, 4, 5]);
            noteRange = this.difficulty <= 1 ? ['C', 'D', 'E', 'F', 'G'] : this.notes;
        } else {
            octave = this.difficulty <= 3 ? 3 : (this.difficulty <= 7 ? [2, 3] : [2, 3, 4]);
            noteRange = this.difficulty <= 3 ? ['C', 'D', 'E', 'F', 'G'] : this.notes;
        }

        const note = noteRange[Math.floor(Math.random() * noteRange.length)];
        const useAccidental = this.difficulty >= 8 && Math.random() < 0.3;
        const accidental = useAccidental ? (Math.random() < 0.5 ? '#' : 'b') : '';

        const selectedOctave = Array.isArray(octave) ?
            octave[Math.floor(Math.random() * octave.length)] : octave;

        const correctAnswer = note + accidental;
        const wrongAnswers = this.generateWrongNotes(correctAnswer, 3);

        return {
            type: 'noteIdentification',
            questionText: 'What note is shown?',
            clef: clef,
            note: note + accidental + '/' + selectedOctave,
            correctAnswer: correctAnswer,
            answers: this.shuffleArray([correctAnswer, ...wrongAnswers]),
            midiNote: this.noteToMidi(note + accidental, selectedOctave)
        };
    }

    generateIntervalQuestion() {
        const maxInterval = this.difficulty <= 7 ? 7 :
                          this.difficulty <= 10 ? 10 : 12;
        const availableIntervals = this.intervals.slice(0, maxInterval + 1);
        const interval = availableIntervals[Math.floor(Math.random() * availableIntervals.length)];

        const rootNote = this.notes[Math.floor(Math.random() * this.notes.length)];
        const octave = 4;

        const wrongAnswers = this.generateWrongIntervals(interval.name, 3);

        return {
            type: 'interval',
            questionText: 'What interval is shown?',
            clef: 'treble',
            interval: interval,
            rootNote: rootNote + '/' + octave,
            correctAnswer: interval.name,
            answers: this.shuffleArray([interval.name, ...wrongAnswers])
        };
    }

    generateChordQuestion() {
        let availableChords = this.chordTypes.slice(0, 2); // Major, Minor

        if (this.difficulty >= 9) availableChords = this.chordTypes.slice(0, 4);
        if (this.difficulty >= 13) availableChords = this.chordTypes;

        const chord = availableChords[Math.floor(Math.random() * availableChords.length)];
        const rootNote = this.notes[Math.floor(Math.random() * this.notes.length)];
        const octave = 4;

        const wrongAnswers = this.generateWrongChords(chord.name, 3);

        return {
            type: 'chord',
            questionText: 'What type of chord is shown?',
            clef: 'treble',
            chord: chord,
            rootNote: rootNote + '/' + octave,
            correctAnswer: chord.name,
            answers: this.shuffleArray([chord.name, ...wrongAnswers])
        };
    }

    generateKeySignatureQuestion() {
        const maxKeys = this.difficulty <= 6 ? 3 :
                       this.difficulty <= 10 ? 7 : 13;
        const availableKeys = this.keySignatures.slice(0, maxKeys);
        const key = availableKeys[Math.floor(Math.random() * availableKeys.length)];

        const wrongAnswers = this.generateWrongKeys(key.name, 3);

        return {
            type: 'keySignature',
            questionText: 'What key signature is shown?',
            clef: 'treble',
            keySignature: key,
            correctAnswer: key.name,
            answers: this.shuffleArray([key.name, ...wrongAnswers])
        };
    }

    generateScaleDegreeQuestion() {
        const degrees = ['1st (Tonic)', '2nd (Supertonic)', '3rd (Mediant)',
                        '4th (Subdominant)', '5th (Dominant)', '6th (Submediant)', '7th (Leading Tone)'];
        const degree = Math.floor(Math.random() * 7) + 1;
        const key = 'C Major';

        const wrongAnswers = degrees.filter((_, i) => i + 1 !== degree)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

        return {
            type: 'scaleDegree',
            questionText: `What scale degree is this in ${key}?`,
            clef: 'treble',
            degree: degree,
            key: key,
            correctAnswer: degrees[degree - 1],
            answers: this.shuffleArray([degrees[degree - 1], ...wrongAnswers])
        };
    }

    generateWrongNotes(correct, count) {
        const allNotes = [];
        this.notes.forEach(note => {
            allNotes.push(note);
            if (this.difficulty >= 8) {
                allNotes.push(note + '#');
                allNotes.push(note + 'b');
            }
        });

        return allNotes
            .filter(n => n !== correct)
            .sort(() => Math.random() - 0.5)
            .slice(0, count);
    }

    generateWrongIntervals(correct, count) {
        return this.intervals
            .map(i => i.name)
            .filter(n => n !== correct)
            .sort(() => Math.random() - 0.5)
            .slice(0, count);
    }

    generateWrongChords(correct, count) {
        return this.chordTypes
            .map(c => c.name)
            .filter(n => n !== correct)
            .sort(() => Math.random() - 0.5)
            .slice(0, count);
    }

    generateWrongKeys(correct, count) {
        return this.keySignatures
            .map(k => k.name)
            .filter(n => n !== correct)
            .sort(() => Math.random() - 0.5)
            .slice(0, count);
    }

    shuffleArray(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    displayQuestion() {
        document.getElementById('questionNum').textContent = this.totalQuestions;
        document.getElementById('questionType').textContent = this.getQuestionTypeLabel();
        document.getElementById('questionText').textContent = this.currentQuestion.questionText;
        document.getElementById('feedback').classList.add('hidden');

        this.renderNotation();
        this.displayAnswerButtons();

        const progress = ((this.timeLimit - this.timeRemaining) / this.timeLimit) * 100;
        document.getElementById('progressFill').style.width = progress + '%';
    }

    getQuestionTypeLabel() {
        const labels = {
            'noteIdentification': 'Note Identification',
            'interval': 'Interval Recognition',
            'chord': 'Chord Identification',
            'keySignature': 'Key Signature',
            'scaleDegree': 'Scale Degree'
        };
        return labels[this.currentQuestion.type] || 'Music Theory';
    }

    renderNotation() {
        const container = document.getElementById('notationContainer');
        container.innerHTML = '';

        const VF = Vex.Flow;
        const div = document.createElement('div');
        container.appendChild(div);

        const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
        renderer.resize(500, 200);
        const context = renderer.getContext();

        const stave = new VF.Stave(10, 40, 400);

        // Add clef
        if (this.currentQuestion.clef === 'treble') {
            stave.addClef('treble');
        } else if (this.currentQuestion.clef === 'bass') {
            stave.addClef('bass');
        }

        // Add key signature for key signature questions
        if (this.currentQuestion.type === 'keySignature') {
            const key = this.currentQuestion.keySignature;
            if (key.sharps > 0) {
                stave.addKeySignature(this.getKeySignatureString(key.sharps, 'sharps'));
            } else if (key.flats > 0) {
                stave.addKeySignature(this.getKeySignatureString(key.flats, 'flats'));
            }
        }

        stave.setContext(context).draw();

        const notes = [];

        if (this.currentQuestion.type === 'noteIdentification') {
            notes.push(new VF.StaveNote({
                keys: [this.currentQuestion.note],
                duration: 'w'
            }));
        } else if (this.currentQuestion.type === 'interval') {
            const rootNote = this.currentQuestion.rootNote;
            const targetNote = this.getIntervalNote(rootNote, this.currentQuestion.interval.semitones);
            notes.push(new VF.StaveNote({
                keys: [rootNote, targetNote],
                duration: 'w'
            }));
        } else if (this.currentQuestion.type === 'chord') {
            const chordNotes = this.getChordNotes(
                this.currentQuestion.rootNote,
                this.currentQuestion.chord.notes
            );
            notes.push(new VF.StaveNote({
                keys: chordNotes,
                duration: 'w'
            }));
        } else if (this.currentQuestion.type === 'scaleDegree') {
            const scaleNote = this.getScaleDegreeNote(this.currentQuestion.degree);
            notes.push(new VF.StaveNote({
                keys: [scaleNote],
                duration: 'w'
            }));
        }

        // Handle accidentals
        notes.forEach(note => {
            note.getKeys().forEach((key, index) => {
                if (key.includes('#')) {
                    note.addModifier(new VF.Accidental('#'), index);
                } else if (key.includes('b')) {
                    note.addModifier(new VF.Accidental('b'), index);
                }
            });
        });

        if (notes.length > 0) {
            const voice = new VF.Voice({ num_beats: 4, beat_value: 4 });
            voice.addTickables(notes);

            new VF.Formatter()
                .joinVoices([voice])
                .format([voice], 350);

            voice.draw(context, stave);
        }
    }

    getKeySignatureString(count, type) {
        const sharpOrder = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'];
        const flatOrder = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'];

        if (type === 'sharps') {
            return sharpOrder.slice(0, count).join('');
        } else {
            return flatOrder.slice(0, count).join('');
        }
    }

    getIntervalNote(rootNote, semitones) {
        const [note, octave] = rootNote.split('/');
        const noteIndex = this.noteToMidi(note, parseInt(octave));
        const targetMidi = noteIndex + semitones;
        return this.midiToNote(targetMidi);
    }

    getChordNotes(rootNote, intervals) {
        const [note, octave] = rootNote.split('/');
        const rootMidi = this.noteToMidi(note, parseInt(octave));

        return intervals.map(interval => {
            const targetMidi = rootMidi + interval;
            return this.midiToNote(targetMidi);
        });
    }

    getScaleDegreeNote(degree) {
        const cMajorScale = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        return cMajorScale[degree - 1] + '/4';
    }

    noteToMidi(note, octave) {
        const noteMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        let baseMidi = noteMap[note[0]];

        if (note.includes('#')) baseMidi += 1;
        if (note.includes('b')) baseMidi -= 1;

        return baseMidi + (octave + 1) * 12;
    }

    midiToNote(midiNote) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = noteNames[midiNote % 12];
        return noteName + '/' + octave;
    }

    displayAnswerButtons() {
        const container = document.getElementById('answerButtons');
        container.innerHTML = '';

        this.currentQuestion.answers.forEach(answer => {
            const button = document.createElement('button');
            button.className = 'answer-btn';
            button.textContent = answer;
            button.onclick = () => this.checkAnswer(answer);
            container.appendChild(button);
        });

        // Show MIDI hint if available
        const midiHint = document.getElementById('midiHint');
        if (this.midiInputs.length > 0 && this.currentQuestion.type === 'noteIdentification') {
            midiHint.classList.remove('hidden');
            this.waitingForMidi = true;
        } else {
            midiHint.classList.add('hidden');
            this.waitingForMidi = false;
        }
    }

    checkAnswer(answer) {
        this.waitingForMidi = false;
        const correct = answer === this.currentQuestion.correctAnswer;

        this.showFeedback(correct, answer);

        if (correct) {
            this.score++;
            this.currentStreak++;
            this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
        } else {
            this.currentStreak = 0;
        }

        this.updateDisplay();

        // Disable buttons
        const buttons = document.querySelectorAll('.answer-btn');
        buttons.forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === this.currentQuestion.correctAnswer) {
                btn.classList.add('correct');
            } else if (btn.textContent === answer && !correct) {
                btn.classList.add('incorrect');
            }
        });

        setTimeout(() => this.nextQuestion(), 1500);
    }

    checkMIDIAnswer(midiNote) {
        if (!this.waitingForMidi || !this.currentQuestion.midiNote) return;

        const correctNote = this.currentQuestion.midiNote % 12;
        const playedNote = midiNote % 12;

        const correct = correctNote === playedNote;
        this.checkAnswer(this.currentQuestion.correctAnswer);
    }

    showFeedback(correct, answer) {
        const feedback = document.getElementById('feedback');
        feedback.classList.remove('hidden', 'correct', 'incorrect');

        if (correct) {
            feedback.classList.add('correct');
            const correctMessages = [
                `Correct, ${this.studentName}! Well done!`,
                `Excellent work, ${this.studentName}!`,
                `Perfect, ${this.studentName}!`,
                `Great job, ${this.studentName}!`,
                `You got it, ${this.studentName}!`
            ];
            const randomMessage = correctMessages[Math.floor(Math.random() * correctMessages.length)];
            feedback.querySelector('.feedback-message').textContent = randomMessage;
        } else {
            feedback.classList.add('incorrect');
            feedback.querySelector('.feedback-message').textContent =
                `Not quite, ${this.studentName}. The answer is ${this.currentQuestion.correctAnswer}`;
        }
    }

    endGame() {
        clearInterval(this.timerInterval);
        this.isPlaying = false;

        const percentage = this.totalQuestions > 0 ?
            Math.round((this.score / this.totalQuestions) * 100) : 0;

        document.getElementById('gameArea').classList.add('hidden');
        document.getElementById('resultsScreen').classList.remove('hidden');

        // Personalize results title
        document.getElementById('resultsTitle').textContent = `Great Work, ${this.studentName}!`;

        document.getElementById('finalScore').textContent = percentage + '%';
        document.getElementById('finalQuestions').textContent =
            `${this.score} / ${this.totalQuestions}`;
        document.getElementById('finalStreak').textContent = this.bestStreak;

        const message = this.getResultsMessage(percentage);
        document.getElementById('resultsMessage').textContent = message;
    }

    getResultsMessage(percentage) {
        if (percentage >= 90) return `Outstanding, ${this.studentName}! You're a music theory master!`;
        if (percentage >= 80) return `Excellent work, ${this.studentName}! Keep it up!`;
        if (percentage >= 70) return `Great job, ${this.studentName}! You're making good progress!`;
        if (percentage >= 60) return `Good effort, ${this.studentName}! Keep practicing!`;
        if (percentage >= 50) return `Not bad, ${this.studentName}! Try reviewing the concepts.`;
        return `Keep practicing, ${this.studentName}! You'll improve with time!`;
    }

    showSetup() {
        document.getElementById('resultsScreen').classList.add('hidden');
        document.getElementById('gameSetup').classList.remove('hidden');
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new MusicTheoryGame();
});
