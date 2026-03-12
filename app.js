// Main application logic

class FederatedKeyboardApp {
    constructor() {
        this.server = new FederatedLearningServer();
        this.clients = {};
        this.isTraining = false;
        this.autoTrainingInterval = null;
        this.initialized = false;
        this.predictionTimeouts = {}; // For debouncing predictions
        
        this.setupEventListeners();
        this.setupInputHandlers();
        this.updateStatus('Ready! Click "Start Federated Training" to begin.');
    }
    
    async initializeClients() {
        if (this.initialized) {
            return; // Already initialized
        }
        
        console.log('Initializing federated learning clients...');
        this.updateStatus('Initializing models... Please wait.');
        
        // Create clients for each user profile
        const profiles = ['sports', 'baking', 'cs'];
        
        for (const profile of profiles) {
            const client = new FederatedClient(
                profile,
                VOCABULARY[profile],
                TRAINING_DATA[profile]
            );
            
            await client.initialize();
            this.clients[profile] = client;
            this.server.registerClient(profile, client.getModel());
        }
        
        this.initialized = true;
        console.log('All clients initialized');
        this.updateUI();
    }
    
    setupEventListeners() {
        // Start training button
        document.getElementById('startTraining').addEventListener('click', async () => {
            await this.startFederatedTraining();
        });
        
        // Reset button
        document.getElementById('resetModels').addEventListener('click', async () => {
            await this.resetModels();
        });
    }
    
    setupInputHandlers() {
        const profiles = ['sports', 'baking', 'cs'];
        
        profiles.forEach(profile => {
            const input = document.getElementById(`${profile}-input`);
            const messagesDiv = document.getElementById(`${profile}-messages`);
            
            // Real-time prediction on input (every keystroke)
            input.addEventListener('input', async (e) => {
                await this.handleInput(profile, e.target.value);
            });
            
            // Also trigger on keyup for better responsiveness
            input.addEventListener('keyup', async (e) => {
                // Don't trigger on Enter key
                if (e.key !== 'Enter') {
                    await this.handleInput(profile, e.target.value);
                }
            });
            
            // Send message on Enter
            input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    this.addMessage(profile, e.target.value);
                    e.target.value = '';
                    this.clearPredictions(profile);
                }
            });
        });
    }
    
    async handleInput(profile, text) {
        // Clear any pending prediction timeout
        if (this.predictionTimeouts[profile]) {
            clearTimeout(this.predictionTimeouts[profile]);
        }
        
        // Always try to show predictions if initialized
        if (!this.initialized) {
            this.clearPredictions(profile);
            return;
        }
        
        // Don't show predictions during training
        if (this.isTraining) {
            this.clearPredictions(profile);
            return;
        }
        
        // Debounce predictions (wait 100ms after last keystroke)
        this.predictionTimeouts[profile] = setTimeout(async () => {
            try {
                const predictions = await this.clients[profile].predict(text, 5);
                this.displayPredictions(profile, predictions);
            } catch (error) {
                console.error(`Prediction error for ${profile}:`, error);
                this.clearPredictions(profile);
            }
        }, 100);
    }
    
    displayPredictions(profile, predictions) {
        const predictionsDiv = document.getElementById(`${profile}-predictions`);
        predictionsDiv.innerHTML = '';
        
        if (!predictions || predictions.length === 0) {
            return;
        }
        
        predictions.forEach(pred => {
            const chip = document.createElement('div');
            chip.className = 'prediction-chip';
            
            // Add confidence-based styling
            if (pred.confidence > 0.3) {
                chip.classList.add('confidence-high');
            } else if (pred.confidence > 0.15) {
                chip.classList.add('confidence-medium');
            } else {
                chip.classList.add('confidence-low');
            }
            
            chip.textContent = `${pred.word} (${(pred.confidence * 100).toFixed(1)}%)`;
            
            // Click to insert word
            chip.addEventListener('click', () => {
                const input = document.getElementById(`${profile}-input`);
                input.value += (input.value.endsWith(' ') ? '' : ' ') + pred.word + ' ';
                input.focus();
                this.handleInput(profile, input.value);
            });
            
            predictionsDiv.appendChild(chip);
        });
    }
    
    clearPredictions(profile) {
        const predictionsDiv = document.getElementById(`${profile}-predictions`);
        predictionsDiv.innerHTML = '';
    }
    
    addMessage(profile, text) {
        const messagesDiv = document.getElementById(`${profile}-messages`);
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = text;
        
        messageDiv.appendChild(messageText);
        messagesDiv.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    async startFederatedTraining() {
        if (this.isTraining) {
            console.log('Training already in progress');
            return;
        }
        
        // Initialize models if not already done
        if (!this.initialized) {
            await this.initializeClients();
        }
        
        this.isTraining = true;
        const startButton = document.getElementById('startTraining');
        startButton.disabled = true;
        startButton.textContent = 'Training in Progress...';
        
        this.updateStatus('Training local models...');
        
        try {
            // Phase 1: Local training for each client (instant with n-grams)
            const trainingPromises = Object.keys(this.clients).map(async (profile) => {
                this.updateStatus(`Training ${profile} model...`);
                const result = await this.clients[profile].localTraining(1);
                this.updateClientStats(profile, result);
                return result;
            });
            
            await Promise.all(trainingPromises);
            
            // Phase 2: Federated averaging
            this.updateStatus('Performing federated averaging...');
            await new Promise(resolve => setTimeout(resolve, 800)); // Visual delay
            
            const success = await this.server.performFederatedRound();
            
            if (success) {
                this.updateStatus('Federated training completed successfully!');
                
                // Phase 3: Fine-tune with global model
                this.updateStatus('Fine-tuning with global model...');
                await new Promise(resolve => setTimeout(resolve, 500)); // Visual delay
                
                const fineTunePromises = Object.keys(this.clients).map(async (profile) => {
                    const result = await this.clients[profile].localTraining(1);
                    this.updateClientStats(profile, result);
                    return result;
                });
                
                await Promise.all(fineTunePromises);
                
                this.updateStatus('All training completed! Try typing in the chat boxes.');
            } else {
                this.updateStatus('Training failed. Please try again.');
            }
            
            this.updateUI();
            
        } catch (error) {
            console.error('Training error:', error);
            this.updateStatus('Training error occurred. Check console.');
        } finally {
            this.isTraining = false;
            startButton.disabled = false;
            startButton.textContent = 'Start Federated Training';
        }
    }
    
    updateClientStats(profile, result) {
        const accuracySpan = document.getElementById(`${profile}-accuracy`);
        const lossSpan = document.getElementById(`${profile}-loss`);
        
        if (accuracySpan) {
            accuracySpan.textContent = `${(result.accuracy * 100).toFixed(1)}%`;
        }
        
        if (lossSpan) {
            lossSpan.textContent = result.loss.toFixed(4);
        }
    }
    
    updateUI() {
        const stats = this.server.getStats();
        
        // Update global stats
        document.getElementById('trainingRounds').textContent = stats.trainingRounds;
        document.getElementById('totalUpdates').textContent = stats.totalUpdates;
        
        // Calculate average accuracy
        let totalAccuracy = 0;
        let count = 0;
        
        Object.keys(this.clients).forEach(profile => {
            const clientStats = this.clients[profile].getStats();
            if (clientStats.accuracy > 0) {
                totalAccuracy += clientStats.accuracy;
                count++;
            }
        });
        
        const avgAccuracy = count > 0 ? (totalAccuracy / count * 100).toFixed(1) : 0;
        document.getElementById('globalAccuracy').textContent = `${avgAccuracy}%`;
    }
    
    updateStatus(message) {
        const statusDiv = document.getElementById('trainingStatus');
        statusDiv.textContent = message;
        console.log(message);
    }
    
    async resetModels() {
        if (this.isTraining) {
            alert('Cannot reset while training is in progress');
            return;
        }
        
        if (!confirm('Are you sure you want to reset all models? This will clear all training progress.')) {
            return;
        }
        
        this.updateStatus('Resetting all models...');
        
        // Dispose existing models
        if (this.initialized) {
            Object.keys(this.clients).forEach(profile => {
                const model = this.clients[profile].getModel();
                if (model && model.model) {
                    model.model.dispose();
                }
            });
        }
        
        // Reinitialize
        this.clients = {};
        this.server = new FederatedLearningServer();
        this.initialized = false;
        
        // Clear messages
        ['sports', 'baking', 'cs'].forEach(profile => {
            document.getElementById(`${profile}-messages`).innerHTML = '';
            document.getElementById(`${profile}-input`).value = '';
            document.getElementById(`${profile}-accuracy`).textContent = '0%';
            document.getElementById(`${profile}-loss`).textContent = '-';
            this.clearPredictions(profile);
        });
        
        // Reset global stats
        document.getElementById('globalAccuracy').textContent = '0%';
        document.getElementById('trainingRounds').textContent = '0';
        document.getElementById('totalUpdates').textContent = '0';
        
        this.updateStatus('All models reset. Click "Start Federated Training" to begin.');
    }
}

// Initialize app when DOM is loaded
let app;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Federated Learning Keyboard Demo...');
    
    try {
        // Initialize app (models will be created on demand)
        app = new FederatedKeyboardApp();
        
        console.log('Application ready! Click "Start Federated Training" to begin.');
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize application. Please refresh the page.');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    // No cleanup needed for n-gram models
});
