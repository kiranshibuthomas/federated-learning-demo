# 🏗️ Architecture Diagrams

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Federated Learning System                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Client 1   │      │   Client 2   │      │   Client 3   │
│   (Sports)   │      │   (Baking)   │      │     (CS)     │
│      ⚽       │      │      🧁       │      │      💻       │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │ Local Training      │ Local Training      │ Local Training
       │ (Private Data)      │ (Private Data)      │ (Private Data)
       │                     │                     │
       ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Local Model  │      │ Local Model  │      │ Local Model  │
│   Weights    │      │   Weights    │      │   Weights    │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  Federated Server    │
                  │  (Aggregation Only)  │
                  │                      │
                  │  ⚙️ FedAvg Algorithm │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   Global Model       │
                  │   (Aggregated)       │
                  └──────────┬───────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Client 1   │      │   Client 2   │      │   Client 3   │
│  (Updated)   │      │  (Updated)   │      │  (Updated)   │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    What Stays Local                          │
├─────────────────────────────────────────────────────────────┤
│  • Raw text data                                            │
│  • Training sentences                                       │
│  • User typing history                                      │
│  • Personal information                                     │
│  • Search queries                                           │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ NEVER TRANSMITTED
                            │
┌─────────────────────────────────────────────────────────────┐
│                    What Gets Shared                          │
├─────────────────────────────────────────────────────────────┤
│  • Model weights (~2MB)                                     │
│  • Training metrics (accuracy, loss)                        │
│  • Model architecture                                       │
└─────────────────────────────────────────────────────────────┘
```

## LSTM Model Architecture

```
Input: "the game was amazing yesterday"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Embedding                                          │
│  Input:  [batch, 5] (word indices)                          │
│  Output: [batch, 5, 128] (dense vectors)                    │
│  Params: vocab_size × 128 ≈ 25,600                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: LSTM (256 units)                                   │
│  Input:  [batch, 5, 128]                                    │
│  Output: [batch, 5, 256]                                    │
│  Params: 4 × (128+256+1) × 256 ≈ 394,240                   │
│  Dropout: 0.3 (input + recurrent)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: LSTM (128 units)                                   │
│  Input:  [batch, 5, 256]                                    │
│  Output: [batch, 128]                                       │
│  Params: 4 × (256+128+1) × 128 ≈ 197,120                   │
│  Dropout: 0.3 (input + recurrent)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Dropout (0.4)                                      │
│  Input:  [batch, 128]                                       │
│  Output: [batch, 128]                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: Dense (128 units, ReLU)                           │
│  Input:  [batch, 128]                                       │
│  Output: [batch, 128]                                       │
│  Params: 128 × 128 + 128 = 16,512                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 6: Output (vocab_size, Softmax)                      │
│  Input:  [batch, 128]                                       │
│  Output: [batch, vocab_size] (probabilities)               │
│  Params: 128 × vocab_size + vocab_size ≈ 25,800           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
              Prediction: "yesterday"
              Confidence: 0.35 (35%)
```

## Federated Learning Cycle

```
Round 1: Initial Training
═══════════════════════════════════════════════════════════════

Step 1: Local Training
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Sports  │  │ Baking  │  │   CS    │
│ Client  │  │ Client  │  │ Client  │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     │ Train on   │ Train on   │ Train on
     │ 30 sports  │ 30 baking  │ 30 CS
     │ sentences  │ sentences  │ sentences
     │            │            │
     ▼            ▼            ▼
  Acc: 65%    Acc: 70%    Acc: 68%

Step 2: Weight Collection
     │            │            │
     │ Weights    │ Weights    │ Weights
     │ (~2MB)     │ (~2MB)     │ (~2MB)
     │            │            │
     └────────────┼────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ Federated      │
         │ Server         │
         │                │
         │ FedAvg:        │
         │ w_global =     │
         │ Σ(w_i × n_i)/n │
         └────────┬───────┘
                  │
                  ▼
         Global Model Created
         Avg Accuracy: 67.7%

Step 3: Distribution
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Sports  │  │ Baking  │  │   CS    │
│ Client  │  │ Client  │  │ Client  │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     │ Receive    │ Receive    │ Receive
     │ Global     │ Global     │ Global
     │ Model      │ Model      │ Model
     │            │            │

Step 4: Fine-tuning
     │            │            │
     │ Adapt to   │ Adapt to   │ Adapt to
     │ local      │ local      │ local
     │ data       │ data       │ data
     │            │            │
     ▼            ▼            ▼
  Acc: 72%    Acc: 75%    Acc: 73%

═══════════════════════════════════════════════════════════════
Result: Improved personalized models for all users!
```

## Training Timeline

```
Time: 0s ──────────────────────────────────────────────────> 120s

├─ Initialize Models (0-5s)
│  └─ Build LSTM architecture
│  └─ Initialize weights
│  └─ Compile optimizers
│
├─ Local Training Phase 1 (5-45s)
│  ├─ Sports Client: 20 epochs
│  ├─ Baking Client: 20 epochs
│  └─ CS Client: 20 epochs
│
├─ Federated Averaging (45-50s)
│  ├─ Collect weights
│  ├─ Compute weighted average
│  └─ Create global model
│
├─ Model Distribution (50-55s)
│  ├─ Send to Sports Client
│  ├─ Send to Baking Client
│  └─ Send to CS Client
│
└─ Fine-tuning Phase (55-120s)
   ├─ Sports Client: 10 epochs
   ├─ Baking Client: 10 epochs
   └─ CS Client: 10 epochs

Result: Ready for predictions!
```

## Prediction Flow

```
User Types: "the game was"
           │
           ▼
┌──────────────────────────────────────┐
│ 1. Tokenization                      │
│    ["the", "game", "was"]            │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 2. Padding                           │
│    ["the", "the", "the",             │
│     "game", "was"]                   │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 3. Index Conversion                  │
│    [0, 0, 0, 45, 3]                  │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 4. Model Inference                   │
│    LSTM Forward Pass                 │
│    → Embedding                       │
│    → LSTM Layers                     │
│    → Dense Layers                    │
│    → Softmax                         │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 5. Probability Distribution          │
│    [0.35, 0.22, 0.15, 0.08, ...]    │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 6. Top-K Selection                   │
│    Top 5 predictions                 │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ 7. Display Results                   │
│    • amazing (35%) ← High            │
│    • incredible (22%) ← Medium       │
│    • exciting (15%) ← Medium         │
│    • great (8%) ← Low                │
│    • good (5%) ← Low                 │
└──────────────────────────────────────┘
```

## Privacy Comparison

```
Traditional ML (❌ Not Private)
═══════════════════════════════════════════════════════════════

User Device                          Central Server
┌─────────────┐                     ┌─────────────┐
│ "my password│────── Raw Data ────▶│ Stores ALL  │
│  is 12345"  │                     │ user data   │
│             │                     │             │
│ "bank acc   │────── Raw Data ────▶│ Can see     │
│  #98765"    │                     │ everything  │
└─────────────┘                     └─────────────┘
                                           │
                                           ▼
                                    ⚠️ Privacy Risk!
                                    • Data breaches
                                    • Unauthorized access
                                    • Surveillance


Federated Learning (✅ Private)
═══════════════════════════════════════════════════════════════

User Device                          Central Server
┌─────────────┐                     ┌─────────────┐
│ "my password│                     │ Receives    │
│  is 12345"  │ ─┐                  │ only model  │
│             │  │                  │ weights     │
│ "bank acc   │  │ Model Weights   │             │
│  #98765"    │  └────────────────▶│ Cannot see  │
│             │    (~2MB)           │ raw data    │
│ Local Model │                     │             │
│ Training    │                     │ Aggregates  │
└─────────────┘                     └─────────────┘
                                           │
                                           ▼
                                    ✅ Privacy Preserved!
                                    • No raw data shared
                                    • GDPR compliant
                                    • Secure by design
```

## Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  app.js (Main Controller)                            │  │
│  │  • Manages application state                         │  │
│  │  • Coordinates training                              │  │
│  │  • Handles UI updates                                │  │
│  └────┬─────────────────────────────────────────────────┘  │
│       │                                                     │
│       ├──────────────┬──────────────┬──────────────┐       │
│       │              │              │              │       │
│  ┌────▼────┐    ┌────▼────┐    ┌────▼────┐   ┌────▼────┐ │
│  │ Client  │    │ Client  │    │ Client  │   │ Server  │ │
│  │ Sports  │    │ Baking  │    │   CS    │   │ FedAvg  │ │
│  └────┬────┘    └────┬────┘    └────┬────┘   └────┬────┘ │
│       │              │              │              │       │
│  ┌────▼────┐    ┌────▼────┐    ┌────▼────┐       │       │
│  │  Model  │    │  Model  │    │  Model  │       │       │
│  │  LSTM   │    │  LSTM   │    │  LSTM   │       │       │
│  └────┬────┘    └────┬────┘    └────┬────┘       │       │
│       │              │              │              │       │
│  ┌────▼────────────────▼──────────────▼────────────▼────┐ │
│  │         TensorFlow.js (ML Framework)                  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## File Dependencies

```
index.html
    │
    ├─── styles.css (UI styling)
    │
    ├─── vocabulary.js (Data)
    │    ├─ VOCABULARY.sports
    │    ├─ VOCABULARY.baking
    │    ├─ VOCABULARY.cs
    │    ├─ TRAINING_DATA.sports
    │    ├─ TRAINING_DATA.baking
    │    └─ TRAINING_DATA.cs
    │
    ├─── model.js (Neural Network)
    │    └─ LanguageModel class
    │         ├─ buildModel()
    │         ├─ train()
    │         └─ predict()
    │
    ├─── federatedLearning.js (FL Algorithm)
    │    ├─ FederatedLearningServer
    │    │   ├─ federatedAveraging()
    │    │   └─ distributeGlobalModel()
    │    └─ FederatedClient
    │        └─ localTraining()
    │
    └─── app.js (Main Application)
         └─ FederatedKeyboardApp
              ├─ initializeClients()
              ├─ startFederatedTraining()
              ├─ handleInput()
              └─ displayPredictions()
```

## Memory Layout

```
Browser Memory (~500MB Total)
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│ TensorFlow.js Runtime                          ~100MB        │
├─────────────────────────────────────────────────────────────┤
│ Sports Model (LSTM + weights)                  ~150MB        │
├─────────────────────────────────────────────────────────────┤
│ Baking Model (LSTM + weights)                  ~150MB        │
├─────────────────────────────────────────────────────────────┤
│ CS Model (LSTM + weights)                      ~150MB        │
├─────────────────────────────────────────────────────────────┤
│ Training Data & Vocabulary                     ~1MB          │
├─────────────────────────────────────────────────────────────┤
│ UI & Application State                         ~10MB         │
├─────────────────────────────────────────────────────────────┤
│ Temporary Tensors (during training)            Variable      │
└─────────────────────────────────────────────────────────────┘
```

## Use These Diagrams

- **In Presentation**: Draw on whiteboard or show on slides
- **For Understanding**: Reference while reading code
- **For Explanation**: Help others understand the system
- **For Documentation**: Include in reports or papers

---

**Tip**: These diagrams are designed to be drawn on a whiteboard during your presentation for maximum impact!
