# 🔒 Federated Learning Demo

Privacy-preserving next-word prediction using Federated Learning. Demonstrates how 3 users with different interests (sports, baking, computer science) train personalized models without sharing raw data.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://kiranshibuthomas.github.io/federated-learning-demo/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Overview

This project demonstrates **Federated Learning** - a privacy-preserving machine learning technique where models are trained locally on user devices, and only model updates (not raw data) are shared with a central server. This is the same technology used by Google Gboard with over 1 billion users.

### Key Features

- ✅ **3 Separate User Models** - Sports enthusiast, Baking expert, Software developer
- ✅ **Real-time Predictions** - Next-word suggestions as you type
- ✅ **Privacy Preserved** - Raw data never leaves the device
- ✅ **Federated Averaging** - Models learn from each other without sharing data
- ✅ **Live Training Monitor** - See the process in real-time
- ✅ **Clean UI** - Google Search inspired interface

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/kiranshibuthomas/federated-learning-demo.git
   cd federated-learning-demo
   ```

2. **Open in browser**
   ```bash
   # Simply open index.html in your browser
   # No build process or dependencies needed!
   ```

3. **Start training**
   - Click "Start Federated Training"
   - Wait 2-3 seconds
   - Start typing in any chat box!

## 📂 Project Structure

```
federated-learning-demo/
├── index.html              # Main demo interface
├── monitor.html            # Live training monitor
├── visualization.html      # Behind-the-scenes explanation
├── styles.css              # Clean, minimal styling
├── app.js                  # Main application logic
├── model.js                # N-gram language model
├── federatedLearning.js    # FedAvg algorithm
├── vocabulary.js           # Training data (140+ sentences per user)
└── README.md              # This file
```

## 🎓 How It Works

### 1. Local Training
Each user trains their own model on private data:
- **Alex (Sports)**: 140+ sports-related sentences
- **Bailey (Baking)**: 140+ baking-related sentences
- **Chris (CS)**: 140+ programming-related sentences

### 2. Federated Averaging
Server aggregates model patterns (not data):
```javascript
// What gets shared (safe):
{
  "the game": {"was": 5, "is": 3, "will": 2},
  "accuracy": 0.75
}

// What stays private:
"the game was amazing yesterday"
```

### 3. Model Distribution
Global model sent back to all users, who then fine-tune locally.

### 4. Result
- Each user keeps personalized predictions
- Models improved by learning from others
- **Zero raw data shared** ✅

## 🔍 Live Monitor

Open `monitor.html` to see:
- Real-time training logs with timestamps
- Model weights and data structures
- Data flow visualization
- All 4 training phases live

## 📊 Technical Details

- **Model**: N-gram language model (trigram + bigram + word frequency)
- **Vocabulary**: ~200 words per user
- **Training Data**: 140+ sentences per user
- **Accuracy**: 65-80% after training
- **Privacy**: 100% - no data transmitted
- **Technology**: Vanilla JavaScript (no frameworks!)

## 🎯 Use Cases

Perfect for:
- 📚 Educational demonstrations
- 🎤 Seminar presentations
- 🔬 Research projects
- 💡 Understanding federated learning
- 🔐 Privacy-preserving ML concepts

## 🌟 Features

### Main Demo (`index.html`)
- 3 user chat interfaces
- Real-time next-word predictions
- Confidence-scored suggestions
- Training controls and stats

### Live Monitor (`monitor.html`)
- Real-time training logs
- Model weights visualization
- Data flow animation
- Phase-by-phase breakdown

### Visualization (`visualization.html`)
- Architecture diagrams
- Privacy breakdown
- Algorithm explanation
- Real-world applications

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

Based on the Federated Learning framework introduced by Google Research and the FedAvg algorithm by McMahan et al. (2017).

## 📧 Contact

Created for educational purposes. For questions or feedback, please open an issue.

---

⭐ Star this repo if you find it helpful!
