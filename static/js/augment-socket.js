/**
 * CODESTORM - Socket.IO Integration for Augment-like Interface
 * This module handles Socket.IO connections and events for the Augment-like interface.
 */

class AugmentSocket {
    constructor(options = {}) {
        this.options = {
            debug: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            ...options
        };

        this.socket = null;
        this.isConnected = false;
        this.listeners = {};
        this.pendingCommands = [];

        // Initialize Socket.IO if autoConnect is true
        if (this.options.autoConnect) {
            this.connect();
        }
    }

    /**
     * Connect to the Socket.IO server
     * @returns {Promise} Promise that resolves when connected
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.log('Connecting to Socket.IO server...');

                // Initialize Socket.IO - use direct connection to origin
                this.socket = io(window.location.origin, {
                    transports: ['websocket', 'polling'],
                    reconnection: this.options.reconnection,
                    reconnectionAttempts: this.options.reconnectionAttempts,
                    reconnectionDelay: this.options.reconnectionDelay,
                    forceNew: true
                });

                // Set up event handlers
                this.socket.on('connect', () => {
                    this.isConnected = true;
                    this.log('Connected to Socket.IO server');

                    // Process any pending commands
                    this.processPendingCommands();

                    resolve(this.socket);
                });

                this.socket.on('disconnect', () => {
                    this.isConnected = false;
                    this.log('Disconnected from Socket.IO server');
                });

                this.socket.on('connect_error', (error) => {
                    this.log('Socket.IO connection error:', error);
                    reject(error);
                });

                this.socket.on('error', (error) => {
                    this.log('Socket.IO error:', error);
                });

                // Make socket available globally for debugging
                window.socket = this.socket;

            } catch (error) {
                this.log('Error initializing Socket.IO:', error);
                reject(error);
            }
        });
    }

    /**
     * Disconnect from the Socket.IO server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.isConnected = false;
            this.log('Manually disconnected from Socket.IO server');
        }
    }

    /**
     * Send a command to the server
     * @param {string} command - Command to send
     * @param {object} options - Additional options
     * @returns {Promise} Promise that resolves with the command result
     */
    sendCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            const commandData = {
                command: command,
                user_id: options.user_id || 'default',
                ...options
            };

            if (!this.isConnected) {
                this.log('Not connected, adding command to pending queue:', command);
                this.pendingCommands.push({
                    data: commandData,
                    resolve,
                    reject
                });
                return;
            }

            this.log('Sending command:', command);

            // Create a one-time listener for the command result
            const responseHandler = (data) => {
                this.log('Command result received:', data);
                this.socket.off('command_result', responseHandler);

                if (data.success) {
                    resolve(data);
                } else {
                    reject(new Error(data.error || 'Command execution failed'));
                }
            };

            // Register the listener
            this.socket.on('command_result', responseHandler);

            // Send the command
            this.socket.emit('bash_command', commandData);

            // Set a timeout
            setTimeout(() => {
                this.socket.off('command_result', responseHandler);
                reject(new Error('Command execution timed out'));
            }, options.timeout || 10000);
        });
    }

    /**
     * Process natural language instruction
     * @param {string} text - Natural language instruction
     * @param {object} options - Additional options
     * @returns {Promise} Promise that resolves with the processing result
     */
    processNaturalLanguage(text, options = {}) {
        return new Promise((resolve, reject) => {
            const data = {
                text: text,
                model: options.model || 'gemini',
                user_id: options.user_id || 'default',
                ...options
            };

            if (!this.isConnected) {
                this.log('Not connected, cannot process natural language:', text);
                reject(new Error('Not connected to Socket.IO server'));
                return;
            }

            this.log('Processing natural language:', text);

            // Create a one-time listener for the response
            const responseHandler = (data) => {
                this.log('Natural language response received:', data);
                this.socket.off('assistant_response', responseHandler);

                if (data.success) {
                    resolve(data);
                } else {
                    reject(new Error(data.error || 'Natural language processing failed'));
                }
            };

            // Register the listener
            this.socket.on('assistant_response', responseHandler);

            // Send the request
            this.socket.emit('natural_language', data);

            // Set a timeout
            setTimeout(() => {
                this.socket.off('assistant_response', responseHandler);
                reject(new Error('Natural language processing timed out'));
            }, options.timeout || 30000);
        });
    }

    /**
     * Process pending commands
     */
    processPendingCommands() {
        if (this.pendingCommands.length === 0) return;

        this.log(`Processing ${this.pendingCommands.length} pending commands`);

        // Process each pending command
        this.pendingCommands.forEach(({ data, resolve, reject }) => {
            this.sendCommand(data.command, data)
                .then(resolve)
                .catch(reject);
        });

        // Clear the pending commands
        this.pendingCommands = [];
    }

    /**
     * Log a message if debug is enabled
     * @param {...any} args - Arguments to log
     */
    log(...args) {
        if (this.options.debug) {
            console.log('[AugmentSocket]', ...args);
        }
    }
}

// Make available globally
window.AugmentSocket = AugmentSocket;
