/**
 * Note Validator and Converter
 * 
 * This module provides a validation and conversion layer between 
 * Magenta ML-generated outputs and Tone.js compatible note formats.
 * It handles quantization for ML models while ensuring the output
 * can be properly played by Tone.js.
 */

class NoteValidator {
    constructor() {
        this.defaultDuration = 0.5;
        this.defaultVelocity = 0.7;
    }

    /**
     * Prepares a sequence for Magenta ML models by adding quantization info
     * @param {Object} sequence - The original note sequence
     * @returns {Object} - A quantized copy of the sequence
     */
    prepareQuantizedSequence(sequence) {
        // Create a deep copy to avoid modifying the original
        const quantizedSequence = JSON.parse(JSON.stringify(sequence));
        
        // Add quantization info required by Magenta models
        quantizedSequence.quantizationInfo = {
            stepsPerQuarter: 4
        };
        
        // Add tempo information
        quantizedSequence.tempos = [{
            time: 0,
            qpm: 120
        }];
        
        return quantizedSequence;
    }

    /**
     * Converts Magenta note sequences to Tone.js compatible format
     * @param {Array} magentaNotes - Notes from Magenta ML model
     * @returns {Array} - Tone.js compatible notes
     */
    convertMagentaToToneNotes(magentaNotes) {
        if (!magentaNotes || !Array.isArray(magentaNotes)) {
            console.warn('Invalid Magenta notes received:', magentaNotes);
            return [];
        }

        console.log('Converting Magenta notes:', magentaNotes);
        
        if (magentaNotes.length === 0) {
            console.warn('Received empty Magenta notes array');
            return [];
        }

        try {
            const result = magentaNotes.map(note => ({
                note: this.validatePitch(note.pitch),
                velocity: this.validateVelocity(note.velocity),
                duration: this.validateDuration(note.endTime, note.startTime)
            }));
            console.log('Converted to Tone.js format:', result);
            return result;
        } catch (error) {
            console.error('Error converting Magenta notes to Tone.js format:', error);
            return [];
        }
    }

    /**
     * Validates and ensures a pitch value is within MIDI range
     * @param {number} pitch - MIDI pitch value
     * @returns {number} - Valid MIDI pitch
     */
    validatePitch(pitch) {
        // Ensure pitch is a number
        if (typeof pitch !== 'number' || isNaN(pitch)) {
            console.warn(`Invalid pitch value: ${pitch}, using default C4 (60)`);
            return 60; // Default to middle C
        }
        
        // Ensure pitch is within MIDI range (0-127)
        return Math.max(0, Math.min(127, Math.round(pitch)));
    }

    /**
     * Validates and normalizes velocity values
     * @param {number} velocity - Note velocity
     * @returns {number} - Normalized velocity (0-1)
     */
    validateVelocity(velocity) {
        if (typeof velocity !== 'number' || isNaN(velocity)) {
            console.warn(`Invalid velocity value: ${velocity}, using default ${this.defaultVelocity}`);
            return this.defaultVelocity;
        }
        
        // If velocity is already in 0-1 range
        if (velocity >= 0 && velocity <= 1) {
            return velocity;
        }
        
        // If velocity is in MIDI range (0-127), normalize to 0-1
        if (velocity >= 0 && velocity <= 127) {
            return velocity / 127;
        }
        
        // For any other values, clamp to 0-1 range
        return Math.max(0, Math.min(1, velocity));
    }

    /**
     * Validates and calculates note duration
     * @param {number} endTime - Note end time
     * @param {number} startTime - Note start time
     * @returns {number} - Duration in seconds
     */
    validateDuration(endTime, startTime) {
        if (typeof endTime !== 'number' || typeof startTime !== 'number' || 
            isNaN(endTime) || isNaN(startTime)) {
            console.warn(`Invalid duration values: ${startTime} to ${endTime}, using default ${this.defaultDuration}`);
            return this.defaultDuration;
        }
        
        const duration = endTime - startTime;
        
        // Ensure duration is positive and reasonable
        if (duration <= 0 || duration > 10) {
            console.warn(`Unusual duration: ${duration}, using default ${this.defaultDuration}`);
            return this.defaultDuration;
        }
        
        return duration;
    }

    /**
     * Generates a fallback response when ML models fail
     * @param {Array} inputNotes - Original input notes
     * @returns {Array} - Tone.js compatible notes
     */
    generateFallbackResponse(inputNotes) {
        console.log('Using fallback response generation');
        
        if (!inputNotes || !Array.isArray(inputNotes)) {
            console.warn('Invalid input notes for fallback:', inputNotes);
            return [];
        }
        
        return inputNotes.map(note => ({
            note: this.validatePitch(note.note + 4), // Add a major third
            velocity: this.validateVelocity(note.velocity * 0.8),
            duration: this.defaultDuration
        }));
    }

    /**
     * Validates and prepares notes for Tone.js playback
     * @param {Array} notes - Notes to validate
     * @returns {Array} - Validated notes ready for Tone.js
     */
    prepareToneJsNotes(notes) {
        console.log('Preparing notes for Tone.js:', notes);
        
        if (!notes) {
            console.warn('Notes array is null or undefined');
            return [];
        }
        
        if (!Array.isArray(notes)) {
            console.warn('Notes is not an array:', typeof notes);
            // Try to handle non-array input gracefully
            if (typeof notes === 'object' && notes !== null) {
                // If it's a single note object, wrap it in an array
                notes = [notes];
            } else {
                return [];
            }
        }
        
        if (notes.length === 0) {
            console.warn('Empty notes array for Tone.js preparation');
            return [];
        }
        
        try {
            const result = notes.map(note => {
                // Check if this is a valid note object
                if (!note || typeof note !== 'object') {
                    console.warn('Invalid note object:', note);
                    return null;
                }
                
                // Handle different note formats
                const pitch = note.note !== undefined ? note.note : 
                             note.pitch !== undefined ? note.pitch : 60;
                             
                const velocity = note.velocity !== undefined ? note.velocity : 0.7;
                
                const duration = note.duration !== undefined ? note.duration :
                                 (note.endTime !== undefined && note.startTime !== undefined) ? 
                                 note.endTime - note.startTime : 0.5;
                
                return {
                    note: this.validatePitch(pitch),
                    velocity: this.validateVelocity(velocity),
                    duration: this.validateDuration(duration, 0)
                };
            }).filter(note => note !== null); // Remove any null entries
            
            console.log('Prepared notes for Tone.js:', result);
            return result;
        } catch (error) {
            console.error('Error preparing notes for Tone.js:', error);
            return [];
        }
    }
}

// Export the validator
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NoteValidator;
} else {
    // For browser environments
    window.NoteValidator = NoteValidator;
}
