// Federated Learning implementation with FedAvg algorithm

class FederatedLearningServer {
    constructor() {
        this.clients = new Map();
        this.globalModel = null;
        this.trainingRounds = 0;
        this.totalUpdates = 0;
    }
    
    registerClient(clientId, model) {
        this.clients.set(clientId, {
            model: model,
            lastUpdate: null,
            trainingHistory: []
        });
        console.log(`Client ${clientId} registered`);
    }
    
    async federatedAveraging() {
        // FedAvg: Merge n-gram models from all clients
        if (this.clients.size === 0) {
            console.warn('No clients registered for federated averaging');
            return null;
        }
        
        const mergedWeights = {
            ngramModel: {},
            bigramModel: {},
            wordFrequency: {},
            accuracy: 0,
            loss: 0
        };
        
        let clientCount = 0;
        
        // Collect and merge weights from all clients
        for (const [clientId, client] of this.clients) {
            const weights = client.model.getWeights();
            if (weights) {
                clientCount++;
                
                // Merge ngram models
                for (const [context, nextWords] of Object.entries(weights.ngramModel || {})) {
                    if (!mergedWeights.ngramModel[context]) {
                        mergedWeights.ngramModel[context] = {};
                    }
                    for (const [word, count] of Object.entries(nextWords)) {
                        mergedWeights.ngramModel[context][word] = 
                            (mergedWeights.ngramModel[context][word] || 0) + count;
                    }
                }
                
                // Merge bigram models
                for (const [word, nextWords] of Object.entries(weights.bigramModel || {})) {
                    if (!mergedWeights.bigramModel[word]) {
                        mergedWeights.bigramModel[word] = {};
                    }
                    for (const [nextWord, count] of Object.entries(nextWords)) {
                        mergedWeights.bigramModel[word][nextWord] = 
                            (mergedWeights.bigramModel[word][nextWord] || 0) + count;
                    }
                }
                
                // Merge word frequencies
                for (const [word, count] of Object.entries(weights.wordFrequency || {})) {
                    mergedWeights.wordFrequency[word] = 
                        (mergedWeights.wordFrequency[word] || 0) + count;
                }
                
                // Average accuracy and loss
                mergedWeights.accuracy += weights.accuracy || 0;
                mergedWeights.loss += weights.loss || 0;
            }
        }
        
        if (clientCount === 0) {
            console.warn('No valid weights collected from clients');
            return null;
        }
        
        // Average accuracy and loss
        mergedWeights.accuracy /= clientCount;
        mergedWeights.loss /= clientCount;
        
        this.trainingRounds++;
        this.totalUpdates += clientCount;
        
        console.log(`Federated averaging completed. Round: ${this.trainingRounds}`);
        return mergedWeights;
    }
    
    async distributeGlobalModel(globalWeights) {
        // Distribute the global model to all clients
        if (!globalWeights) {
            console.warn('No global weights to distribute');
            return;
        }
        
        for (const [clientId, client] of this.clients) {
            try {
                await client.model.setWeights(globalWeights);
                client.lastUpdate = new Date();
                console.log(`Global model distributed to ${clientId}`);
            } catch (error) {
                console.error(`Error distributing to ${clientId}:`, error);
            }
        }
    }
    
    async performFederatedRound() {
        // Complete federated learning round
        console.log('Starting federated learning round...');
        
        // Step 1: Aggregate client models
        const globalWeights = await this.federatedAveraging();
        
        if (!globalWeights) {
            console.error('Failed to create global model');
            return false;
        }
        
        // Step 2: Distribute global model back to clients
        await this.distributeGlobalModel(globalWeights);
        
        console.log('Federated learning round completed');
        return true;
    }
    
    getStats() {
        return {
            trainingRounds: this.trainingRounds,
            totalUpdates: this.totalUpdates,
            clientCount: this.clients.size
        };
    }
}

class FederatedClient {
    constructor(clientId, vocabulary, trainingData) {
        this.clientId = clientId;
        this.model = new LanguageModel(clientId, vocabulary);
        this.trainingData = trainingData;
        this.localAccuracy = 0;
        this.localLoss = 0;
        this.trainingHistory = [];
    }
    
    async initialize() {
        await this.model.buildModel();
        console.log(`Client ${this.clientId} initialized`);
    }
    
    async localTraining(epochs = 1) {
        console.log(`${this.clientId}: Starting local training...`);
        
        try {
            const result = await this.model.train(this.trainingData, epochs, 16);
            this.localAccuracy = result.accuracy;
            this.localLoss = result.loss;
            
            this.trainingHistory.push({
                timestamp: new Date(),
                accuracy: result.accuracy,
                loss: result.loss
            });
            
            console.log(`${this.clientId}: Training completed - Acc: ${(result.accuracy * 100).toFixed(2)}%, Loss: ${result.loss.toFixed(4)}`);
            return result;
        } catch (error) {
            console.error(`${this.clientId}: Training error:`, error);
            throw error;
        }
    }
    
    async predict(inputText, topK = 5) {
        return await this.model.predict(inputText, topK);
    }
    
    getModel() {
        return this.model;
    }
    
    getStats() {
        return {
            clientId: this.clientId,
            accuracy: this.localAccuracy,
            loss: this.localLoss,
            trainingHistory: this.trainingHistory
        };
    }
}

// Differential privacy (optional enhancement)
class DifferentialPrivacy {
    static addNoise(weights, epsilon = 1.0) {
        // Add noise to n-gram counts for differential privacy
        const noisyWeights = {
            ngramModel: {},
            bigramModel: {},
            wordFrequency: {},
            accuracy: weights.accuracy,
            loss: weights.loss
        };
        
        // Add Laplace noise to ngram counts
        for (const [context, nextWords] of Object.entries(weights.ngramModel || {})) {
            noisyWeights.ngramModel[context] = {};
            for (const [word, count] of Object.entries(nextWords)) {
                const noise = this.laplaceNoise(1 / epsilon);
                noisyWeights.ngramModel[context][word] = Math.max(0, count + noise);
            }
        }
        
        return noisyWeights;
    }
    
    static laplaceNoise(scale) {
        // Generate Laplace noise
        const u = Math.random() - 0.5;
        return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FederatedLearningServer, FederatedClient, DifferentialPrivacy };
}
